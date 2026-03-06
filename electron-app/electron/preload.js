
// electron/preload.js — FINAL
// Exposes safe renderer APIs for tasks, logs, reports, settings,
// working-hours, tray/timer bridges, and startup toggle.

const { contextBridge, ipcRenderer } = require("electron");

// Core app APIs
contextBridge.exposeInMainWorld("ecnp", {
  // Tasks
  loadTasks: () => ipcRenderer.invoke("tasks:load"),
  saveTasks: (requester, tasks) => ipcRenderer.invoke("tasks:save", { requester, tasks }),

  // Logs
  appendDaily: (payload) => ipcRenderer.invoke("logs:appendDaily", payload),

  // Reports
  generateMonthly: (year, month) => ipcRenderer.invoke("reports:generateMonthly", { year, month }),

  // Settings / logs folder
  getLogsDir: () => ipcRenderer.invoke("settings:getLogsDir"),
  openLogsDir: () => ipcRenderer.invoke("settings:openLogsDir"),
  writeTestLog: () => ipcRenderer.invoke("settings:writeTestLog"),
  overrideLogsDir: (requester, newPath) => ipcRenderer.invoke("settings:overrideLogsDir", { requester, newPath }),

  // Working-hours
  getWorkingHours: (user) => ipcRenderer.invoke("settings:getWorkingHours", { user }),
  saveWorkingHours: (user, data) => ipcRenderer.invoke("settings:saveWorkingHours", { user, data }),

  // Startup toggle: launch in tray mode
  setLaunchTray: (enable) => ipcRenderer.invoke("settings:setLaunchTray", enable)
});

// Tray/timer bridge
contextBridge.exposeInMainWorld("ecnpTimer", {
  // 3-state notifier for tray icon
  notifyState: (state /* 'running'|'paused'|'stopped' */) =>
    ipcRenderer.send("timer:state", { state }),

  // Backward-compat if older code uses boolean running
  notifyStatus: (running) =>
    ipcRenderer.send("timer:status", { running }),

  // Global toggle (Ctrl+Alt+L)
  onGlobalToggle: (cb) => ipcRenderer.on("global-toggle", cb),

  // Hide tray popup (called on mouse leave)
  trayHide: () => ipcRenderer.send("tray:hide")
});
