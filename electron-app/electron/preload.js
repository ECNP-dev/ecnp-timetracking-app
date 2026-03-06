
// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("auth", {
  login: () => ipcRenderer.invoke("auth:login")
});
