
// electron/main.js — FULL UPDATED VERSION
// Includes:
// - Universal OneDrive detection (shared ECNP logs folder)
// - User-specific daily logs (avoid overwrite)
// - MSAL redirect protocol forwarding
// - Single-instance lock (Electron best practice)
// - Logs override
// - Tasks IPC
// - Daily log IPC
// - Monthly Excel reports IPC
// - Settings IPC

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const XLSX = require("xlsx");

/* -------------------------------------------------------------------------- */
/*                 1. UNIVERSAL ONEDRIVE SHARED FOLDER DETECTION              */
/* -------------------------------------------------------------------------- */

// Locate ANY OneDrive* folder under %USERPROFILE%,
// then locate the "Office - Documents" subtree (ECNP Shared Library)
function findECNPLogsFolder() {
  const root = process.env.USERPROFILE;
  if (!root) return null;

  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith("OneDrive"))
    .map(e => path.join(root, e.name));

  for (const oneDriveRoot of entries) {
    const officeDocs = path.join(oneDriveRoot, "Office - Documents");
    if (fs.existsSync(officeDocs)) {
      return path.join(
        officeDocs,
        "General",
        "ICT",
        "Timetracking",
        "ecnp-time-tracking-app",
        "logs"
      );
    }
  }
  return null;
}

// Use universal detection:
const autoLogs = findECNPLogsFolder();
if (!autoLogs) {
  throw new Error("ECNP shared OneDrive folder ('Office - Documents') not found on this PC.");
}

// Default logs directory
let LOGS_DIR = autoLogs;

// Allow admin runtime override
global._LOGS_DIR_OVERRIDE = null;
function effectiveLogsDir() {
  return global._LOGS_DIR_OVERRIDE || LOGS_DIR;
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDirSync(effectiveLogsDir());


/* -------------------------------------------------------------------------- */
/*                 2. SINGLE INSTANCE + MSAL PROTOCOL FORWARDING              */
/* -------------------------------------------------------------------------- */

let mainWindow = null;
let pendingRedirectUri = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", (_event, argv) => {
  const uri = argv.find(a => a && a.startsWith("msal://"));
  if (uri) {
    pendingRedirectUri = uri;
    if (mainWindow) {
      mainWindow.webContents.send("msal-redirect", uri);
    }
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS open-url
app.on("open-url", (event, url) => {
  event.preventDefault();
  pendingRedirectUri = url;
  if (mainWindow) mainWindow.webContents.send("msal-redirect", url);
});

// Windows: deep link may appear on launch args
if (process.platform === "win32") {
  const arg = process.argv.find(a => a && a.startsWith("msal://"));
  if (arg) pendingRedirectUri = arg;
}


/* -------------------------------------------------------------------------- */
/*                               3. CREATE WINDOW                             */
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

  ipcMain.on("renderer-ready", () => {
    if (pendingRedirectUri) {
      mainWindow.webContents.send("msal-redirect", pendingRedirectUri);
      pendingRedirectUri = null;
    }
  });
}

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient("msal");
  createWindow();
});


/* -------------------------------------------------------------------------- */
/*                            4. LOAD & SAVE TASKS                            */
/* -------------------------------------------------------------------------- */

function tasksFile() {
  return path.join(effectiveLogsDir(), "tasks.json");
}

async function loadTasks() {
  try {
    const txt = await fsp.readFile(tasksFile(), "utf8");
    const data = JSON.parse(txt);
    return Array.isArray(data) ? data : data.tasks || [];
  } catch {
    return ["Focus work", "Meetings", "Support", "Admin"];
  }
}

async function saveTasks(requester, tasks) {
  if (requester !== "admin") throw new Error("Only admin can save tasks.");
  await fsp.writeFile(tasksFile(), JSON.stringify(tasks, null, 2), "utf8");
  return true;
}

ipcMain.handle("tasks:load", () => loadTasks());
ipcMain.handle("tasks:save", (_e, data) => saveTasks(data.requester, data.tasks));


/* -------------------------------------------------------------------------- */
/*                       5. DAILY LOGS — USER-SPECIFIC FILES                 */
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

  // SAFE USERNAME (avoid invalid filename chars)
  const safeUser = user.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Final filename per user
  const file = path.join(
    effectiveLogsDir(),
    `${yyyy}-${mm}-${dd}__${safeUser}.csv`
  );

  const header = "date,user,task,minutes\r\n";

  if (!fs.existsSync(file)) {
    ensureDirSync(effectiveLogsDir());
    await fsp.writeFile(file, header, "utf8");
  }

  const lines = entries
    .map(e =>
      `${csvEscape(dateISO)},${csvEscape(user)},${csvEscape(e.task)},${csvEscape(
        e.minutes
      )}\r\n`
    )
    .join("");

  await fsp.appendFile(file, lines, "utf8");
  return file;
}

ipcMain.handle("logs:appendDaily", (_e, payload) => appendDailyLogs(payload));


/* -------------------------------------------------------------------------- */
/*                         6. MONTHLY REPORT (XLSX)                           */
/* -------------------------------------------------------------------------- */

function parseCSV(text) {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");

  return rows.map(row => {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (inQ) {
        if (c === '"' && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") {
          out.push(cur);
          cur = "";
        } else cur += c;
      }
    }
    out.push(cur);

    const obj = {};
    headers.forEach((h, i) => (obj[h] = out[i]));
    obj.minutes = Number(obj.minutes || 0);
    return obj;
  });
}

async function generateMonthlyReport({ year, month }) {
  const yyyy = Number(year);
  const mm = String(Number(month)).padStart(2, "0");
  const dir = effectiveLogsDir();

  const files = await fsp.readdir(dir);
  const monthFiles = files.filter(
    f => f.startsWith(`${yyyy}-${mm}-`) && f.endsWith(".csv")
  );

  let rows = [];
  for (const f of monthFiles) {
    const txt = await fsp.readFile(path.join(dir, f), "utf8");
    rows.push(...parseCSV(txt));
  }

  // Aggregate
  const days = new Date(yyyy, Number(mm), 0).getDate();
  const tasksSet = new Set(rows.map(r => r.task));
  const taskList = Array.from(tasksSet).sort();

  const byTaskDay = {};
  rows.forEach(r => {
    const day = Number(r.date.split("-")[2]);
    byTaskDay[r.task] ??= {};
    byTaskDay[r.task][day] = (byTaskDay[r.task][day] || 0) + r.minutes;
  });

  const totalsSheet = [
    ["Task", ...Array.from({ length: days }, (_, i) => i + 1), "Total (mins)"]
  ];

  taskList.forEach(task => {
    let total = 0;
    const row = [task];
    for (let d = 1; d <= days; d++) {
      const v = byTaskDay[task]?.[d] || 0;
      total += v;
      row.push(v);
    }
    row.push(total);
    totalsSheet.push(row);
  });

  // User breakdown
  const users = Array.from(new Set(rows.map(r => r.user))).sort();
  const byTaskUser = {};

  rows.forEach(r => {
    byTaskUser[r.task] ??= {};
    byTaskUser[r.task][r.user] =
      (byTaskUser[r.task][r.user] || 0) + r.minutes;
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

ipcMain.handle("reports:generateMonthly", (_e, data) =>
  generateMonthlyReport(data)
);


/* -------------------------------------------------------------------------- */
/*                                7. SETTINGS IPC                              */
/* -------------------------------------------------------------------------- */

ipcMain.handle("settings:getLogsDir", () => effectiveLogsDir());

ipcMain.handle("settings:openLogsDir", () => {
  shell.openPath(effectiveLogsDir());
  return true;
});

ipcMain.handle("settings:writeTestLog", async () => {
  const file = path.join(effectiveLogsDir(), "test_write.txt");
  await fsp.writeFile(file, "OK");
  return file;
});

ipcMain.handle("settings:overrideLogsDir", async (_e, { requester, newPath }) => {
  if (requester !== "admin") throw new Error("Only admin can override logs directory.");
  if (!newPath) throw new Error("Invalid path.");

  ensureDirSync(newPath);
  global._LOGS_DIR_OVERRIDE = newPath;

  return true;
});
