/**
 * Electron shell. Starts the local API server in-process on 127.0.0.1 (random
 * port) and opens a window onto it. No remote content is ever loaded.
 */
import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, Menu } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server/app";
import type { SecretStore } from "../server/context";

const here = path.dirname(fileURLToPath(import.meta.url));

if (!app.requestSingleInstanceLock()) app.quit();

let win: BrowserWindow | null = null;
let server: Awaited<ReturnType<typeof startServer>> | null = null;

const secretStore: SecretStore = {
  get available() {
    return safeStorage.isEncryptionAvailable();
  },
  encrypt(plain) {
    return safeStorage.isEncryptionAvailable() ? "os:" + safeStorage.encryptString(plain).toString("base64") : "plain:" + Buffer.from(plain).toString("base64");
  },
  decrypt(blob) {
    if (blob.startsWith("os:")) return safeStorage.decryptString(Buffer.from(blob.slice(3), "base64"));
    return Buffer.from(blob.replace(/^plain:/, ""), "base64").toString("utf8");
  },
};

async function createWindow() {
  const dataDir = path.join(app.getPath("userData"), "data");
  server ??= await startServer({ dataDir, port: 0, staticDir: path.join(here, "..", "dist"), secretStore });

  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: "Namma Physio Billing",
    backgroundColor: "#f6f4ef",
    show: false,
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  win.once("ready-to-show", () => win?.show());

  // Never navigate away from the local app; open external links in the browser.
  const local = (url: string) => url.startsWith(server!.url + "/") || url === server!.url;
  win.webContents.on("will-navigate", (e, url) => {
    if (!local(url)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (local(url)) return { action: "allow" };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  await win.loadURL(server.url);
}

// ---- IPC: PDF export and folder/file pickers (renderer has no Node access) ----
ipcMain.handle("pdf:save", async (e, opts: { fileName: string; landscape?: boolean; pageSize?: "A4" | { width: number; height: number } }) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return { ok: false };
  const { canceled, filePath } = await dialog.showSaveDialog(w, {
    defaultPath: path.join(app.getPath("documents"), opts.fileName.replace(/[\\/:*?"<>|]/g, "-")),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { ok: false };
  const data = await e.sender.printToPDF({ printBackground: true, landscape: !!opts.landscape, pageSize: opts.pageSize ?? "A4", margins: { marginType: "none" } });
  const fs = await import("node:fs/promises");
  await fs.writeFile(filePath, data);
  shell.showItemInFolder(filePath);
  return { ok: true, filePath };
});
ipcMain.handle("dialog:folder", async (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(w!, { properties: ["openDirectory", "createDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("dialog:backupFile", async (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(w!, { properties: ["openFile"], filters: [{ name: "Namma Physio backup", extensions: ["npcbak"] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("app:openDataFolder", () => shell.openPath(path.join(app.getPath("userData"), "data")));

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { label: "File", submenu: [{ role: "quit" }] },
      { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
      { label: "View", submenu: [{ role: "reload" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    ]),
  );
  createWindow().catch((err) => {
    dialog.showErrorBox("Namma Physio Billing could not start", String(err?.stack ?? err));
    app.quit();
  });
});
app.on("window-all-closed", async () => {
  await server?.close();
  app.quit();
});
