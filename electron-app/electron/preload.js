
// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronMSAL", {
  onRedirect: (cb) => ipcRenderer.on("msal-redirect", (_e, url) => cb(url)),
  notifyReady: () => ipcRenderer.send("renderer-ready")
});

// App APIs
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
  overrideLogsDir: (requester, newPath) => ipcRenderer.invoke("settings:overrideLogsDir", { requester, newPath })
});
