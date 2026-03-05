const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronMSAL", {
  onRedirect: (cb) => ipcRenderer.on("msal:redirect", (_, url) => cb(url))
});

contextBridge.exposeInMainWorld("electronAPI", {
  onStartFromTray: (cb) => ipcRenderer.on("tray:start", cb),
  onStopFromTray: (cb) => ipcRenderer.on("tray:stop", cb)
});
