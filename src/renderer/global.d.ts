import type { Bridge } from "../shared/bridge";
declare global {
  interface Window {
    jinav: Bridge;
  }
}
