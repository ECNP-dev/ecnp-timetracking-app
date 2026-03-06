
// electron/main.js — FINAL
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow = null;
let pendingRedirectUri = null;

// Enforce single instance (required on Windows/Linux for deep-links)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// When a second instance is launched (e.g., by msal://redirect on Win)
app.on("second-instance", (_event, argv) => {
  const url = argv.find(a => a && a.startsWith("msal://"));
  if (url) {
    console.log("[main] second-instance deep link:", url);
    pendingRedirectUri = url;
    if (mainWindow) mainWindow.webContents.send("msal-redirect", url);
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS delivers deep link via open-url
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("[main] open-url deep link:", url);
  pendingRedirectUri = url;
  if (mainWindow) mainWindow.webContents.send("msal-redirect", url);
});

// Windows: deep link may be on the initial command line
if (process.platform === "win32") {
  const url = process.argv.find(a => a && a.startsWith("msal://"));
  if (url) {
    console.log("[main] startup deep link:", url);
    pendingRedirectUri = url;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const dev = !app.isPackaged;
  if (dev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // renderer will ping us when it's ready to receive a possible URI
  ipcMain.on("renderer-ready", () => {
    if (pendingRedirectUri) {
      console.log("[main] sending pending deep link:", pendingRedirectUri);
      mainWindow.webContents.send("msal-redirect", pendingRedirectUri);
      pendingRedirectUri = null;
    }
  });
}

app.whenReady().then(() => {
  // Register protocol handler at runtime (needed for Windows portable builds)
  const ok = app.setAsDefaultProtocolClient("msal");
  console.log("[main] setAsDefaultProtocolClient('msal') =", ok);
  createWindow();
});
