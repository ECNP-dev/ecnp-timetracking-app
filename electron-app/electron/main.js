
// electron/main.js — UPDATED VERSION
// Includes:
// - Universal OneDrive detection
// - User-specific daily logs (monthly subfolders)
// - Tray system (tray icon, popup, minimize-to-tray)
// - Tray icon state updates (green/gray)
// - Global shortcut (Ctrl+Alt+L)
// - Launch in tray mode at startup
// - Auto-create desktop shortcut on first run (using app-icon-256.png)
// - Tasks, logs, monthly reports IPC

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const XLSX = require("xlsx");

/* -------------------------------------------------------------------------- */
/* 1. UNIVERSAL ONEDRIVE SHARED FOLDER DETECTION                              */
/* -------------------------------------------------------------------------- */

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
        officeDocs, "General", "ICT", "Timetracking",
        "ecnp-time-tracking-app", "logs"
      );
    }
  }
  return null;
}

const autoLogs = findECNPLogsFolder();
if (!autoLogs) throw new Error("ECNP shared OneDrive folder ('Office - Documents') not found.");

let LOGS_DIR = autoLogs;
global._LOGS_DIR_OVERRIDE = null;

function effectiveLogsDir() {
  return global._LOGS_DIR_OVERRIDE || LOGS_DIR;
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDirSync(effectiveLogsDir());

/* -------------------------------------------------------------------------- */
/* 2. MAIN + TRAY WINDOWS                                                     */
/* -------------------------------------------------------------------------- */

let mainWindow = null;
let trayWindow = null;
let tray = null;
let isQuitting = false;

// tray icons MUST exist at electron/assets/
const trayGray = path.join(__dirname, "assets", "icon-red.png");
const trayGreen = path.join(__dirname, "assets", "icon-green.png");

// Only start in tray mode if invoked BY startup shortcut (RUN_FROM_STARTUP=1)
const launchedInTray =
  process.argv.includes("--tray") &&
  process.env.RUN_FROM_STARTUP === "1";

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on("before-quit", () => { isQuitting = true; });

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

/* -------------------------------------------------------------------------- */
/* 3. AUTO-CREATE DESKTOP SHORTCUT ON FIRST RUN                               */
/* -------------------------------------------------------------------------- */

function autoCreateDesktopShortcut() {
  const flag = path.join(app.getPath("userData"), "desktop-shortcut-created.flag");
  if (fs.existsSync(flag)) return;

  try {
    const desktop = path.join(app.getPath("desktop"), "ECNP Time Tracker.lnk");
    const iconPath = path.join(__dirname, "assets", "app-icon-256.png");

    shell.writeShortcutLink(desktop, {
      target: process.execPath,
      description: "ECNP Time Tracker",
      icon: iconPath
    });

    fs.writeFileSync(flag, "done");
    console.log("[Shortcut] Desktop shortcut created.");
  } catch (err) {
    console.error("[Shortcut] Failed to create desktop shortcut:", err);
  }
}

/* -------------------------------------------------------------------------- */
/* 4. CREATE MAIN WINDOW                                                      */
/* -------------------------------------------------------------------------- */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(__dirname, "assets", "app-icon-256.png"), // <-- new app icon
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const dev = !app.isPackaged;
  if (dev) mainWindow.loadURL("http://localhost:3000");
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  // Minimize-to-tray: closing hides app
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

/* -------------------------------------------------------------------------- */
/* 5. TRAY WINDOW + POPUP                                                     */
/* -------------------------------------------------------------------------- */

function openTrayWindow() {
  if (trayWindow) {
    trayWindow.show();
    trayWindow.focus();
    return;
  }

  trayWindow = new BrowserWindow({
    width: 320,
    height: 260,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const dev = !app.isPackaged;
  if (dev) trayWindow.loadURL("http://localhost:3000/#/tray");
  else trayWindow.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "tray" });

  trayWindow.once("ready-to-show", () => trayWindow.show());
  trayWindow.on("blur", () => trayWindow?.hide());
  trayWindow.on("closed", () => { trayWindow = null; });
}

/* -------------------------------------------------------------------------- */
/* 6. TRAY ICON + MENU                                                        */
/* -------------------------------------------------------------------------- */

function registerTray() {
  tray = new Tray(trayGray);
  tray.setToolTip("ECNP Time Tracker");

  tray.on("click", () => openTrayWindow());

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Mini Timer", click: () => openTrayWindow() },
    { label: "Open Full App", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } }
  ]));
}

/* -------------------------------------------------------------------------- */
/* 7. GLOBAL SHORTCUT                                                         */
/* -------------------------------------------------------------------------- */

function registerGlobalShortcut() {
  const ok = globalShortcut.register("CommandOrControl+Alt+L", () => {
    if (trayWindow) trayWindow.webContents.send("global-toggle");
    if (mainWindow) mainWindow.webContents.send("global-toggle");
    if (!mainWindow?.isVisible() && !trayWindow?.isVisible()) openTrayWindow();
  });
  if (!ok) console.warn("Global shortcut registration failed.");
}

/* -------------------------------------------------------------------------- */
/* 8. APP READY                                                               */
/* -------------------------------------------------------------------------- */

app.whenReady().then(() => {

  // Auto-create desktop shortcut
  autoCreateDesktopShortcut();

  // Register tray and global hotkey
  registerTray();
  registerGlobalShortcut();

  // Launch in tray only when invoked from Startup
  if (launchedInTray) {
    setTimeout(() => {
      openTrayWindow();
      trayWindow?.focus();
    }, 300);
  } else {
    createMainWindow();
  }
});

app.on("will-quit", () => globalShortcut.unregisterAll());

/* -------------------------------------------------------------------------- */
/* 9. IPC: TRAY STATE + HIDE                                                  */
/* -------------------------------------------------------------------------- */

ipcMain.on("timer:state", (_e, { state }) => {
  if (!tray) return;
  tray.setImage(state === "running" ? trayGreen : trayGray);
});

ipcMain.on("tray:hide", () => trayWindow?.hide());

/* -------------------------------------------------------------------------- */
/* 10. TASKS LOAD/SAVE                                                        */
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
ipcMain.handle("tasks:save", (_e, d) => saveTasks(d.requester, d.tasks));

/* -------------------------------------------------------------------------- */
/* 11. DAILY LOGS (MONTHLY SUBFOLDERS)                                        */
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

  const monthDir = path.join(effectiveLogsDir(), `${yyyy}-${mm}`);
  ensureDirSync(monthDir);

  const safeUser = (user || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const file = path.join(monthDir, `${yyyy}-${mm}-${dd}__${safeUser}.csv`);

  const header = "date,user,task,minutes\r\n";
  if (!fs.existsSync(file)) {
    await fsp.writeFile(file, header, "utf8");
  }

  const lines = entries
    .map(e => `${csvEscape(dateISO)},${csvEscape(user)},${csvEscape(e.task)},${csvEscape(e.minutes)}\r\n`)
    .join("");

  await fsp.appendFile(file, lines, "utf8");
  return file;
}

ipcMain.handle("logs:appendDaily", (_e, p) => appendDailyLogs(p));

/* -------------------------------------------------------------------------- */
/* 12. MONTHLY REPORT (YEAR/MONTH SELECT)                                     */
/* -------------------------------------------------------------------------- */

function parseCSV(text) {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");

  return rows.map(row => {
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (q) {
        if (c === '"' && row[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ",") { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);

    const obj = {};
    headers.forEach((h, i) => obj[h] = out[i]);
    obj.minutes = Number(obj.minutes || 0);
    return obj;
  });
}

async function generateMonthlyReport({ year, month }) {
  const yyyy = Number(year);
  const mm = String(Number(month)).padStart(2, "0");

  const base = effectiveLogsDir();
  const monthDir = path.join(base, `${yyyy}-${mm}`);
  ensureDirSync(monthDir);

  const files = await fsp.readdir(monthDir);
  const monthFiles = files.filter(f => f.endsWith(".csv"));

  let rows = [];
  for (const f of monthFiles) {
    const txt = await fsp.readFile(path.join(monthDir, f), "utf8");
    rows.push(...parseCSV(txt));
  }

  const days = new Date(yyyy, Number(mm), 0).getDate();
  const tasksSet = new Set(rows.map(r => r.task));
  const taskList = Array.from(tasksSet).sort();

  const byTaskDay = {};
  rows.forEach(r => {
    const day = Number(r.date.split("-")[2]);
    byTaskDay[r.task] ??= {};
    byTaskDay[r.task][day] = (byTaskDay[r.task][day] || 0) + r.minutes;
  });

  const totalsSheet = [["Task", ...Array.from({ length: days }, (_, i) => i + 1), "Total (mins)"]];
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

  const users = Array.from(new Set(rows.map(r => r.user))).sort();
  const byTaskUser = {};
  rows.forEach(r => {
    byTaskUser[r.task] ??= {};
    byTaskUser[r.task][r.user] =
      (byTaskUser[r.task][r.user] || 0) + r.minutes;
  });

  const byUserSheet = [["Task", ...users, "Total (mins)"]];
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

  const outFile = path.join(monthDir, `ECNP-Report-${yyyy}-${mm}.xlsx`);
  XLSX.writeFile(wb, outFile);

  return outFile;
}

ipcMain.handle("reports:generateMonthly", (_e, d) => generateMonthlyReport(d));

/* -------------------------------------------------------------------------- */
/* 13. SETTINGS (LOGS + STARTUP)                                              */
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

// Startup shortcut
ipcMain.handle("settings:setLaunchTray", async (_e, enable) => {
  const startupDir = path.join(
    process.env.APPDATA,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup"
  );

  const shortcut = path.join(startupDir, "ECNP-TimeTracker.lnk");

  if (enable) {
    shell.writeShortcutLink(shortcut, {
      target: process.execPath,
      args: ["--tray"],
      description: "ECNP Time Tracker",
      env: { RUN_FROM_STARTUP: "1" }
    });
    return true;
  } else {
    try { fs.unlinkSync(shortcut); } catch {}
    return false;
  }
});
