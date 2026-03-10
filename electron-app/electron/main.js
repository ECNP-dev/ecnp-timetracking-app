
// electron/main.js — FINAL UPDATED VERSION
// Features:
// - Universal OneDrive logs folder detection
// - Monthly subfolder logs + user CSV format
// - Tray system (tray icon, popup window, minimize-to-tray)
// - Tray icon color changes (green when running, gray when stopped/paused)
// - Tray hover tooltip (current task + elapsed time)
// - Global shortcut (Ctrl+Alt+L)
// - Auto-create Desktop shortcut on first run (with app-icon-256.png)
// - Launch in tray mode only from Startup shortcut
// - Settings: override logs, open logs, test write, startup toggle
// - Monthly task/user Excel report

const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  globalShortcut
} = require("electron");

const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const XLSX = require("xlsx");

/* -------------------------------------------------------------------------- */
/*  1. OneDrive Shared Folder Detection                                        */
/* -------------------------------------------------------------------------- */

function findECNPLogsFolder() {
  const root = process.env.USERPROFILE;
  if (!root) return null;

  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("OneDrive"))
    .map((e) => path.join(root, e.name));

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

const autoLogs = findECNPLogsFolder();
if (!autoLogs) throw new Error("ECNP shared OneDrive folder not found.");

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
/*  2. Window & Tray State                                                    */
/* -------------------------------------------------------------------------- */

let mainWindow = null;
let trayWindow = null;
let tray = null;
let isQuitting = false;

// Icons (must exist under electron/assets/)
const trayGray = path.join(__dirname, "assets", "icon-gray.png");
const trayGreen = path.join(__dirname, "assets", "icon-green.png");
const appIcon = path.join(__dirname, "assets", "app-icon-256.png");

// Launch in tray mode ONLY when started from Startup shortcut
const launchedInTray =
  process.argv.includes("--tray") && process.env.RUN_FROM_STARTUP === "1";

// Prevent multiple instances
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
/*  3. Auto-create Desktop Shortcut on First Run                               */
/* -------------------------------------------------------------------------- */

function autoCreateDesktopShortcut() {
  const flag = path.join(app.getPath("userData"), "desktop-shortcut-created.flag");
  if (fs.existsSync(flag)) return;

  try {
    const desktopLink = path.join(app.getPath("desktop"), "ECNP Time Tracker.lnk");

    shell.writeShortcutLink(desktopLink, {
      target: process.execPath,
      description: "ECNP Time Tracker",
      icon: appIcon
    });

    fs.writeFileSync(flag, "created");
    console.log("[Shortcut] Desktop shortcut created:", desktopLink);
  } catch (err) {
    console.error("[Shortcut] Failed:", err);
  }
}

/* -------------------------------------------------------------------------- */
/*  4. Main Window Setup                                                       */
/* -------------------------------------------------------------------------- */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const dev = !app.isPackaged;
  if (dev) mainWindow.loadURL("http://localhost:3000");
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  // Minimize-to-tray behavior
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  5. Tray Popup Window                                                      */
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
    icon: appIcon,
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
/*  6. Tray Icon & Menu                                                        */
/* -------------------------------------------------------------------------- */

function registerTray() {
  tray = new Tray(trayGray);
  tray.setToolTip("ECNP Time Tracker");

  tray.on("click", () => openTrayWindow());

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Mini Timer", click: () => openTrayWindow() },
      {
        label: "Open Full Window",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

/* -------------------------------------------------------------------------- */
/*  7. Global Shortcut                                                         */
/* -------------------------------------------------------------------------- */

function registerGlobalShortcut() {
  const ok = globalShortcut.register("CommandOrControl+Alt+L", () => {
    trayWindow?.webContents.send("global-toggle");
    mainWindow?.webContents.send("global-toggle");

    if (!mainWindow?.isVisible() && !trayWindow?.isVisible()) openTrayWindow();
  });

  if (!ok) console.warn("[Hotkey] Failed to register Ctrl+Alt+L");
}

/* -------------------------------------------------------------------------- */
/*  8. App Ready                                                               */
/* -------------------------------------------------------------------------- */

app.whenReady().then(() => {
  // Create desktop shortcut once
  autoCreateDesktopShortcut();

  registerTray();
  registerGlobalShortcut();

  if (launchedInTray) {
    // Delay ensures trayWindow doesn't auto-hide
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
/*  9. Tray State Updates + Hide                                               */
/* -------------------------------------------------------------------------- */

ipcMain.on("timer:state", (_e, { state }) => {
  if (!tray) return;
  tray.setImage(state === "running" ? trayGreen : trayGray);
});

// Hide tray popup on mouse leave (called from tray UI)
ipcMain.on("tray:hide", () => trayWindow?.hide());

// NEW: tooltip updates
ipcMain.on("tray:updateTooltip", (_e, text) => {
  if (tray) tray.setToolTip(text);
});

/* -------------------------------------------------------------------------- */
/*  10. Tasks Load/Save                                                        */
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
/*  11. Daily Logs (Monthly Subfolders)                                       */
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
    .map(
      (e) =>
        `${csvEscape(dateISO)},${csvEscape(user)},${csvEscape(
          e.task
        )},${csvEscape(e.minutes)}\r\n`
    )
    .join("");

  await fsp.appendFile(file, lines, "utf8");
  return file;
}

ipcMain.handle("logs:appendDaily", (_e, p) => appendDailyLogs(p));

/* -------------------------------------------------------------------------- */
/*  12. Monthly Excel Report                                                   */
/* -------------------------------------------------------------------------- */

function parseCSV(text) {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");

  return rows.map((row) => {
    const out = [];
    let cur = "",
      q = false;

    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (q) {
        if (c === '"' && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          q = false;
        } else cur += c;
      } else {
        if (c === '"') q = true;
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

  const base = effectiveLogsDir();
  const monthDir = path.join(base, `${yyyy}-${mm}`);
  ensureDirSync(monthDir);

  const files = await fsp.readdir(monthDir);
  const csvFiles = files.filter((f) => f.endsWith(".csv"));

  let rows = [];
  for (const f of csvFiles) {
    const text = await fsp.readFile(path.join(monthDir, f), "utf8");
    rows.push(...parseCSV(text));
  }

  const days = new Date(yyyy, Number(mm), 0).getDate();
  const tasksSet = new Set(rows.map((r) => r.task));
  const taskList = Array.from(tasksSet).sort();

  const byTaskDay = {};
  rows.forEach((r) => {
    const day = Number(r.date.split("-")[2]);
    byTaskDay[r.task] ??= {};
    byTaskDay[r.task][day] = (byTaskDay[r.task][day] || 0) + r.minutes;
  });

  const totalsSheet = [
    ["Task", ...Array.from({ length: days }, (_, i) => i + 1), "Total (mins)"]
  ];

  taskList.forEach((task) => {
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

  const users = Array.from(new Set(rows.map((r) => r.user))).sort();

  const byTaskUser = {};
  rows.forEach((r) => {
    byTaskUser[r.task] ??= {};
    byTaskUser[r.task][r.user] =
      (byTaskUser[r.task][r.user] || 0) + r.minutes;
  });

  const byUserSheet = [["Task", ...users, "Total (mins)"]];

  taskList.forEach((task) => {
    let total = 0;
    const row = [task];
    users.forEach((u) => {
      const v = byTaskUser[task]?.[u] || 0;
      total += v;
      row.push(v);
    });
    row.push(total);
    byUserSheet.push(row);
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(totalsSheet),
    "Monthly Totals"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(byUserSheet),
    "By User"
  );

  const outFile = path.join(monthDir, `ECNP-Report-${yyyy}-${mm}.xlsx`);
  XLSX.writeFile(workbook, outFile);

  return outFile;
}

ipcMain.handle("reports:generateMonthly", (_e, p) =>
  generateMonthlyReport(p)
);

/* -------------------------------------------------------------------------- */
/*  13. Settings API                                                           */
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
  if (requester !== "admin") throw new Error("Only admin can override logs folder.");
  if (!newPath) throw new Error("Invalid path.");
  ensureDirSync(newPath);
  global._LOGS_DIR_OVERRIDE = newPath;
  return true;
});

// Startup shortcut toggle
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
