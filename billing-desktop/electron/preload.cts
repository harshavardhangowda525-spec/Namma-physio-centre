// Exposes a minimal, explicit bridge. The renderer never gets Node.js access.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  savePdf: (opts: { fileName: string; landscape?: boolean }) => ipcRenderer.invoke("pdf:save", opts),
  chooseFolder: () => ipcRenderer.invoke("dialog:folder"),
  chooseBackupFile: () => ipcRenderer.invoke("dialog:backupFile"),
  openDataFolder: () => ipcRenderer.invoke("app:openDataFolder"),
});
