
// electron/main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");

let redirectUriFromOS = null;

// REGISTER CUSTOM PROTOCOL: msal://redirect
app.setAsDefaultProtocolClient("msal");

// macOS: URL arrives via this event when app is already open
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("MSAL redirect received (open-url):", url);
  redirectUriFromOS = url;
});

// Windows: protocol call when app is launched with msal://
if (process.platform === "win32" && process.argv.length >= 2) {
  for (const arg of process.argv) {
    if (arg.startsWith("msal://")) {
      console.log("MSAL redirect received on startup:", arg);
      redirectUriFromOS = arg;
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL("http://localhost:3000");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Expose the redirect URI to preload
global.getMsalRedirectUri = () => redirectUriFromOS;
``
