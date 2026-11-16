// Exposes named renderer capabilities without leaking Electron primitives.
import { contextBridge, ipcRenderer } from "electron";
import { channels, type Bridge } from "../shared/bridge";
import type { TaskState } from "../shared/task";
const bridge: Bridge = {
  bootstrap: () => ipcRenderer.invoke(channels.bootstrap),
  discover: () => ipcRenderer.invoke(channels.discover),
  manualApp: () => ipcRenderer.invoke(channels.manualApp),
  saveConfig: (config) => ipcRenderer.invoke(channels.saveConfig, config),
  launch: (id, windowId) =>
    ipcRenderer.invoke(channels.launch, { id, windowId }),
  windows: () => ipcRenderer.invoke(channels.windows),
  hide: () => ipcRenderer.invoke(channels.hide),
  settings: () => ipcRenderer.invoke(channels.settings),
  saveKey: (key) => ipcRenderer.invoke(channels.saveKey, key),
  testModel: () => ipcRenderer.invoke(channels.testModel),
  driverStatus: () => ipcRenderer.invoke(channels.driverStatus),
  startTask: (request) => ipcRenderer.invoke(channels.startTask, request),
  stopTask: () => ipcRenderer.invoke(channels.stopTask),
  approve: (allow) => ipcRenderer.invoke(channels.approve, allow),
  clearHistory: () => ipcRenderer.invoke(channels.clearHistory),
  taskState: () => ipcRenderer.invoke(channels.taskState),
  onTask: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: TaskState) =>
      callback(state);
    ipcRenderer.on(channels.task, listener);
    return () => ipcRenderer.removeListener(channels.task, listener);
  },
  chooseVerificationFile: () =>
    ipcRenderer.invoke(channels.chooseVerificationFile),
  onView: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, view: string) =>
      callback(view);
    ipcRenderer.on(channels.view, listener);
    return () => ipcRenderer.removeListener(channels.view, listener);
  },
};
contextBridge.exposeInMainWorld("jinav", bridge);
