const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,

    title: "Compliance Intelligence OS",

    backgroundColor: "#ffffff",

    autoHideMenuBar: true,

    show: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    },
  });

  // Developer Tools
  mainWindow.webContents.openDevTools({ mode: "detach" });

  // Debug Logs
  mainWindow.webContents.on("did-start-navigation", (_, url) => {
    console.log("[START]", url);
  });

  mainWindow.webContents.on("did-redirect-navigation", (_, url) => {
    console.log("[REDIRECT]", url);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[FINISH]", mainWindow.webContents.getURL());
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_, errorCode, errorDescription, validatedURL) => {
      console.log("[FAILED]");
      console.log("URL :", validatedURL);
      console.log("CODE:", errorCode);
      console.log("DESC:", errorDescription);
    }
  );

  mainWindow.webContents.on("render-process-gone", (_, details) => {
    console.log("[RENDER PROCESS GONE]", details);
  });

  mainWindow.webContents.on("console-message", (_, level, message) => {
    console.log("[BROWSER]", message);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Next.js Login
  mainWindow.loadURL("http://127.0.0.1:3000/login");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});