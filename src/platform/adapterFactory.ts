// Selects platform implementations; owns all runtime platform branching.
import { windowsAdapter } from "./windows/windowsAdapter";
import { macosAdapter } from "./macos/macosAdapter";
import { linuxAdapter } from "./linux/linuxAdapter";
export function adapterFactory() {
  if (process.platform === "win32") return windowsAdapter();
  if (process.platform === "darwin") return macosAdapter();
  if (process.platform === "linux")
    return linuxAdapter(process.env.XDG_SESSION_TYPE === "wayland");
  throw Error("Unsupported operating system");
}
export function driverFilename() {
  return `agent-desktop-${process.platform}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
}
