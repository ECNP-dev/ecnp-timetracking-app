
// electron/main.js — FINAL WORKING VERSION

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow = null;
let pendingRedirectUri = null;

// IMPORTANT: Enforce single instance (fixes second-window problem)
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
  return;
}

app.on("second-instance", (event, argv) => {
  // Windows: protocol URL arrives as arg
  const url = argv.find(a => a.startsWith("msal://"));
  if (url) {
    pendingRedirectUri = url;
    if (mainWindow) {
      mainWindow.webContents.send("msal-redirect", url);
    }
  }

  // Focus existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS: open-url event
app.on("open-url", (event, url) => {
  event.preventDefault();
  pendingRedirectUri = url;
  if (mainWindow) {
    mainWindow.webContents.send("msal-redirect", url);
  }
});

// Windows: first launch with redirect URI
if (process.platform === "win32") {
  const url = process.argv.find(a => a.startsWith("msal://"));
  if (url) {
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
      nodeIntegration: false,
    }
  });

  const dev = !app.isPackaged;
  if (dev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // When renderer is ready, send pending redirect if any
  ipcMain.on("renderer-ready", () => {
    if (pendingRedirectUri) {
      mainWindow.webContents.send("msal-redirect", pendingRedirectUri);
      pendingRedirectUri = null;
    }
  });
}

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient("msal");
  createWindow();
});

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
