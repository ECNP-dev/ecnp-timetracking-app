
// electron/preload.js
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

  // Settings and logs folder
  getLogsDir: () => ipcRenderer.invoke("settings:getLogsDir"),
  openLogsDir: () => ipcRenderer.invoke("settings:openLogsDir"),
  writeTestLog: () => ipcRenderer.invoke("settings:writeTestLog"),
  overrideLogsDir: (requester, newPath) =>
    ipcRenderer.invoke("settings:overrideLogsDir", { requester, newPath }),

  // Startup: launch app in tray mode
  setLaunchTray: (enable) => ipcRenderer.invoke("settings:setLaunchTray", enable)
});

// Timer / tray bridge
contextBridge.exposeInMainWorld("ecnpTimer", {
  notifyState: (state) => ipcRenderer.send("timer:state", { state }),
  onGlobalToggle: (cb) => ipcRenderer.on("global-toggle", cb),
  trayHide: () => ipcRenderer.send("tray:hide")
});
