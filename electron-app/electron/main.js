
// electron/main.js — FINAL WORKING VERSION

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow = null;
let pendingRedirectUri = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", (event, argv) => {
  const url = argv.find(a => a && a.startsWith("msal://"));
  if (url) {
    console.log("[main] second-instance deep link:", url);
    pendingRedirectUri = url;
    if (mainWindow) {
      mainWindow.webContents.send("msal-redirect", url);
    }
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("[main] open-url deep link:", url);
  pendingRedirectUri = url;
  if (mainWindow) mainWindow.webContents.send("msal-redirect", url);
});

// Windows startup
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
}

app.whenReady().then(() => {
  const ok = app.setAsDefaultProtocolClient("msal");
  console.log("[main] protocol registration =", ok);
  createWindow();
});
