// Explains task setup without observing the desktop or granting permissions.
import { supportsTaskTarget } from "../shared/supportsTaskTarget";
import type { Bootstrap } from "../shared/bridge";
import type { TargetWindow } from "../shared/task";
import { strings as s } from "./strings";
export function promptReadiness(b: Bootstrap, target?: TargetWindow): string {
  const c = b.config;
  if (target && !supportsTaskTarget(target)) return s.setupUnsupportedTarget;
  if (!c.aiEnabled) return s.setupEnable;
  if (!b.modelConnected && !b.modelProvisioned) return s.setupModel;
  if (!c.cloudConsent) return s.setupConsent;
  if (c.appAccess === "selected" && !c.allowedApps.length) return s.setupApps;
  if (
    target &&
    c.appAccess === "selected" &&
    !c.allowedApps.some(
      (e) =>
        e.path.split(/[\\/]/).at(-1)?.toLowerCase() ===
        target.app.toLowerCase(),
    )
  )
    return s.setupTarget;
  if (!c.appCatalogConsent && (!target || c.appAccess === "all"))
    return s.setupCatalog;
  if (c.pauseOnUserInput && !b.inputMonitoring) return s.setupMonitoring;
  // Desktop readiness is refreshed by the host on submission, not cached as a UI gate.
  return "";
}
