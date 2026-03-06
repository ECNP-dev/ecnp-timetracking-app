
// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronMSAL", {
  onRedirect: (callback) => ipcRenderer.on("msal-redirect", (e, url) => callback(url)),
  notifyReady: () => ipcRenderer.send("renderer-ready")
});
