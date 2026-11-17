// Exposes named renderer capabilities without leaking Electron primitives.
import { contextBridge, ipcRenderer } from "electron";
import { channels, type Bridge, type TooltipContent } from "../shared/bridge";
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
  settingsWindow: (command) =>
    ipcRenderer.invoke(channels.settingsWindow, command),
  prompt: () => ipcRenderer.invoke(channels.prompt),
  tryMenu: () => ipcRenderer.invoke(channels.tryMenu),
  wheelApps: () => ipcRenderer.invoke(channels.wheelApps),
  clearAppHistory: () => ipcRenderer.invoke(channels.clearAppHistory),
  pauseTask: (paused) => ipcRenderer.invoke(channels.pauseTask, paused),
  tooltip: (id) => ipcRenderer.invoke(channels.tooltip, id),
  onTooltip: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      content: TooltipContent,
    ) => callback(content);
    ipcRenderer.on(channels.tooltipText, listener);
    return () => ipcRenderer.removeListener(channels.tooltipText, listener);
  },
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
    const listener = (
      _event: Electron.IpcRendererEvent,
      view: string,
      session?: string,
    ) => callback(view, session);
    ipcRenderer.on(channels.view, listener);
    return () => ipcRenderer.removeListener(channels.view, listener);
  },
  viewReady: (session) => ipcRenderer.invoke(channels.viewReady, session),
};
contextBridge.exposeInMainWorld("jinav", bridge);
