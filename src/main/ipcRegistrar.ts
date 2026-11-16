// Validates trusted IPC callers; converts operational failures into typed results.
import { ipcMain, type BrowserWindow } from "electron";
export function ipcRegistrar(window: BrowserWindow) {
  return (
    channel: string,
    handler: (payload: unknown) => Promise<unknown> | unknown,
  ) => {
    ipcMain.handle(channel, async (event, payload: unknown) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !event.senderFrame.url.startsWith("file://")
      )
        return { ok: false, error: "Untrusted IPC caller" };
      try {
        return { ok: true, value: await handler(payload) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Operation failed",
        };
      }
    });
  };
}
