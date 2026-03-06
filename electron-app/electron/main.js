
// electron/main.js — Full merged version
// - Portable OneDrive logs
// - Single instance + deep link forwarding
// - MSAL redirect bridging
// - Tasks IPC
// - Logs IPC
// - Monthly report IPC
// - Settings IPC

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const XLSX = require("xlsx");

/* -------------------------------------------------------------------------- */
/*                        1. PORTABLE ONEDRIVE LOGS DIR                       */
/* -------------------------------------------------------------------------- */

// Detect OneDrive business folders under USERPROFILE
// OneDrive folders follow patterns like "OneDrive" or "OneDrive - TenantName" on Windows.[1](blob:https://outlook.office.com/38e45ee7-ceb5-47f2-b4e3-d0a293839b03)
function findOneDriveBusinessFolder() {
  const root = process.env.USERPROFILE;
  if (!root) return null;

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const candidates = entries
    .filter(e => e.isDirectory() && e.name.startsWith("OneDrive"))
    .map(e => path.join(root, e.name));

  if (candidates.length === 0) return null;

  // Prefer the ECNP tenant folder: "OneDrive - Stichting Buro ECNP"
  const preferred = candidates.find(c =>
    /ecnp|stichting/i.test(path.basename(c))
  );

  return preferred || candidates[0];
}

const oneDriveBase = findOneDriveBusinessFolder();
if (!oneDriveBase) {
  throw new Error("Could not find any OneDrive folder on this PC.");
}

let LOGS_DIR = path.join(
  oneDriveBase,
  "Office - Documents",
  "General",
  "ICT",
  "Timetracking",
  "ecnp-time-tracking-app",
  "logs"
);

// Allow admin override
global._LOGS_DIR_OVERRIDE = null;

function effectiveLogsDir() {
  return global._LOGS_DIR_OVERRIDE || LOGS_DIR;
}

function ensureDirSync(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDirSync(effectiveLogsDir());


/* -------------------------------------------------------------------------- */
/*                     2. SINGLE INSTANCE + PROTOCOL HANDLING                 */
/* -------------------------------------------------------------------------- */

// Electron recommends using requestSingleInstanceLock for deep links.[2](https://www.mindfulchase.com/explore/troubleshooting-tips/cloud-platforms-and-services/troubleshooting-azure-functions-common-issues-and-solutions.html)
let mainWindow = null;
let pendingRedirectUri = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", (_event, argv) => {
  const url = argv.find(a => a && a.startsWith("msal://"));
  if (url) {
    pendingRedirectUri = url;
    if (mainWindow) mainWindow.webContents.send("msal-redirect", url);
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS protocol routing
app.on("open-url", (event, url) => {
  event.preventDefault();
  pendingRedirectUri = url;
  if (mainWindow) mainWindow.webContents.send("msal-redirect", url);
});

// Windows: deep link may be on initial command line
if (process.platform === "win32") {
  const url = process.argv.find(a => a && a.startsWith("msal://"));
  if (url) pendingRedirectUri = url;
}


/* -------------------------------------------------------------------------- */
/*                             3. MAIN WINDOW                                 */
/* -------------------------------------------------------------------------- */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const dev = !app.isPackaged;
  if (dev) mainWindow.loadURL("http://localhost:3000");
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  // When renderer is ready, deliver pending redirect
  ipcMain.on("renderer-ready", () => {
    if (pendingRedirectUri) {
      mainWindow.webContents.send("msal-redirect", pendingRedirectUri);
      pendingRedirectUri = null;
    }
  });
}

app.whenReady().then(() => {
  // Register msal:// protocol (runtime registration is required for Windows portable builds)[1](blob:https://outlook.office.com/38e45ee7-ceb5-47f2-b4e3-d0a293839b03)
  app.setAsDefaultProtocolClient("msal");
  createWindow();
});


/* -------------------------------------------------------------------------- */
/*                         4. TASKS LOAD/SAVE IPC                             */
/* -------------------------------------------------------------------------- */

const TASKS_FILE = path.join(effectiveLogsDir(), "tasks.json");

async function loadTasks() {
  try {
    const txt = await fsp.readFile(TASKS_FILE, "utf8");
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : parsed.tasks || [];
  } catch {
    return ["Focus work", "Meetings", "Support", "Admin"];
  }
}

async function saveTasks(requester, tasks) {
  if (requester !== "admin") throw new Error("Only admin can save tasks.");
  const file = TASKS_FILE;

  await fsp.writeFile(file, JSON.stringify(tasks, null, 2), "utf8");
  return true;
}

ipcMain.handle("tasks:load", () => loadTasks());
ipcMain.handle("tasks:save", (_e, { requester, tasks }) => saveTasks(requester, tasks));


/* -------------------------------------------------------------------------- */
/*                         5. DAILY LOGS (CSV) IPC                            */
/* -------------------------------------------------------------------------- */

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function appendDailyLogs({ dateISO, user, entries }) {
  const d = new Date(dateISO);
  if (isNaN(d)) throw new Error("Invalid dateISO");

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const file = path.join(effectiveLogsDir(), `${yyyy}-${mm}-${dd}.csv`);
  const header = "date,user,task,minutes\r\n";

  if (!fs.existsSync(file)) await fsp.writeFile(file, header, "utf8");

  const lines = entries
    .map(e => `${csvEscape(dateISO)},${csvEscape(user)},${csvEscape(e.task)},${csvEscape(e.minutes)}\r\n`)
    .join("");

  await fsp.appendFile(file, lines, "utf8");

  return file;
}

ipcMain.handle("logs:appendDaily", (_e, payload) => appendDailyLogs(payload));


/* -------------------------------------------------------------------------- */
/*                   6. MONTHLY REPORT (XLSX) IPC                             */
/* -------------------------------------------------------------------------- */

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map(row => {
    const parts = [];
    let cur = "", q = false;

    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (q) {
        if (ch === '"' && row[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ",") { parts.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    parts.push(cur);

    const obj = {};
    header.forEach((h, idx) => obj[h] = parts[idx]);
    obj.minutes = Number(obj.minutes || 0);
    return obj;
  });
}

async function generateMonthlyReport({ year, month }) {
  const yyyy = Number(year);
  const mm = String(Number(month)).padStart(2, "0");

  const dir = effectiveLogsDir();
  const files = await fsp.readdir(dir);

  const monthFiles = files.filter(f => f.startsWith(`${yyyy}-${mm}-`) && f.endsWith(".csv"));

  let rows = [];
  for (const f of monthFiles) {
    const full = path.join(dir, f);
    const txt = await fsp.readFile(full, "utf8");
    rows.push(...parseCSV(txt));
  }

  /* Build "Monthly Totals" sheet */
  const daysInMonth = new Date(yyyy, Number(mm), 0).getDate();
  const tasksSet = new Set(rows.map(r => r.task));
  const taskList = Array.from(tasksSet).sort();

  const byTaskDay = {};
  rows.forEach(r => {
    const day = Number(r.date.split("-")[2]);
    byTaskDay[r.task] ??= {};
    byTaskDay[r.task][day] = (byTaskDay[r.task][day] || 0) + r.minutes;
  });

  const totalsSheet = [
    ["Task", ...Array.from({ length: daysInMonth }, (_, i) => i + 1), "Total (mins)"]
  ];

  taskList.forEach(task => {
    let total = 0;
    const row = [task];
    for (let d = 1; d <= daysInMonth; d++) {
      const v = byTaskDay[task]?.[d] || 0;
      total += v;
      row.push(v);
    }
    row.push(total);
    totalsSheet.push(row);
  });

  /* Build "By User" sheet */
  const users = Array.from(new Set(rows.map(r => r.user))).sort();
  const byTaskUser = {};

  rows.forEach(r => {
    byTaskUser[r.task] ??= {};
    byTaskUser[r.task][r.user] = (byTaskUser[r.task][r.user] || 0) + r.minutes;
  });

  const byUserSheet = [
    ["Task", ...users, "Total (mins)"]
  ];

  taskList.forEach(task => {
    let total = 0;
    const row = [task];
    users.forEach(u => {
      const v = byTaskUser[task]?.[u] || 0;
      total += v;
      row.push(v);
    });
    row.push(total);
    byUserSheet.push(row);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totalsSheet), "Monthly Totals");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byUserSheet), "By User");

  const outFile = path.join(dir, `ECNP-Report-${yyyy}-${mm}.xlsx`);
  XLSX.writeFile(wb, outFile);

  return outFile;
}

ipcMain.handle("reports:generateMonthly", (_e, payload) =>
  generateMonthlyReport(payload)
);


/* -------------------------------------------------------------------------- */
/*                             7. SETTINGS IPC                                */
/* -------------------------------------------------------------------------- */

ipcMain.handle("settings:getLogsDir", () => effectiveLogsDir());

ipcMain.handle("settings:openLogsDir", () => {
  shell.openPath(effectiveLogsDir());
  return true;
});

ipcMain.handle("settings:writeTestLog", async () => {
  const f = path.join(effectiveLogsDir(), "test_write.txt");
  await fsp.writeFile(f, "OK");
  return f;
});

ipcMain.handle("settings:overrideLogsDir", async (_e, { requester, newPath }) => {
  if (requester !== "admin") throw new Error("Only admin can override logs directory.");
  if (!newPath) throw new Error("Invalid path.");

  ensureDirSync(newPath);
  global._LOGS_DIR_OVERRIDE = newPath;
  return true;
});
