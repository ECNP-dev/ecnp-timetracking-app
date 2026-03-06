
// electron/main.js — MSAL Node flow (no custom protocol needed)
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { loginInteractive } = require("./auth");

let mainWindow = null;

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

ipcMain.handle("auth:login", async () => {
  const res = await loginInteractive();
  // Return only the fields your UI needs
  return {
    account: res.account,
    accessToken: res.accessToken,
    idToken: res.idToken,
    expiresOn: res.expiresOn
  };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
