const { app, BrowserWindow, protocol, Menu, Tray } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");

let win;
let tray;
let deepLinkUrl = null;

app.setAsDefaultProtocolClient("msal");

app.on("open-url", (event, url) => {
  event.preventDefault();
  deepLinkUrl = url;
  if (win) win.webContents.send("msal:redirect", url);
});

function createWindow() {
  win = new BrowserWindow({
    width: 360,
    height: 620,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const url = isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../dist/index.html")}`;
  win.loadURL(url);

  if (deepLinkUrl) {
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("msal:redirect", deepLinkUrl);
    });
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, "icon.png"));
  tray.setToolTip("ECNP Time Tracker");

  const menu = Menu.buildFromTemplate([
    { label: "Show", click: () => win.show() },
    { label: "Hide", click: () => win.hide() },
    { type: "separator" },
    { label: "Start Tracking", click: () => win.webContents.send("tray:start") },
    { label: "Stop Tracking", click: () => win.webContents.send("tray:stop") },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);

  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});
