
// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Core app APIs
contextBridge.exposeInMainWorld("ecnp", {
  // Tasks
  loadTasks: () => ipcRenderer.invoke("tasks:load"),
  saveTasks: (requester, tasks) =>
    ipcRenderer.invoke("tasks:save", { requester, tasks }),

  // Logs
  appendDaily: (payload) => ipcRenderer.invoke("logs:appendDaily", payload),

  // Reports
  generateMonthly: (year, month) =>
    ipcRenderer.invoke("reports:generateMonthly", { year, month }),

  // Settings & log folder
  getLogsDir: () => ipcRenderer.invoke("settings:getLogsDir"),
  openLogsDir: () => ipcRenderer.invoke("settings:openLogsDir"),
  writeTestLog: () => ipcRenderer.invoke("settings:writeTestLog"),
  overrideLogsDir: (requester, newPath) =>
    ipcRenderer.invoke("settings:overrideLogsDir", { requester, newPath }),

  // Startup toggle
  setLaunchTray: (enable) =>
    ipcRenderer.invoke("settings:setLaunchTray", enable)
});

// Timer / tray bridge
contextBridge.exposeInMainWorld("ecnpTimer", {
  notifyState: (state) => ipcRenderer.send("timer:state", { state }),
  onGlobalToggle: (cb) => ipcRenderer.on("global-toggle", cb),
  trayHide: () => ipcRenderer.send("tray:hide"),

  // NEW: Update tray hover tooltip
  updateTooltip: (text) => ipcRenderer.send("tray:updateTooltip", text)
});
