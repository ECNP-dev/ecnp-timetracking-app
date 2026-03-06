
// electron/preload.js
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronMSAL", {
  getRedirectUri: () => {
    if (global.getMsalRedirectUri) {
      return global.getMsalRedirectUri();
    }
    return null;
  }
});
