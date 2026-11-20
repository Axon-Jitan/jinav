// Checks actionable setup guidance independently from the host's permission enforcement.
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../shared/config";
import type { Bootstrap } from "../shared/bridge";
import { promptReadiness } from "./promptReadiness";
import { strings as s } from "./strings";
const ready: Bootstrap = {
  config: {
    ...defaultConfig,
    aiEnabled: true,
    cloudConsent: true,
    appCatalogConsent: true,
    allowedApps: [
      { id: "editor", name: "Editor", path: "C:\\Apps\\editor.exe" },
    ],
  },
  notice: "",
  credential: "",
  platform: "win32",
  modelProvisioned: true,
  inputMonitoring: true,
};
describe("promptReadiness", () => {
  it("explains an empty AI app list even when launcher apps exist", () => {
    expect(
      promptReadiness({
        ...ready,
        config: {
          ...ready.config,
          apps: ready.config.allowedApps,
          allowedApps: [],
        },
      }),
    ).toBe(s.setupApps);
  });
  it("requires explicit AI and privacy permission", () => {
    expect(
      promptReadiness({
        ...ready,
        config: { ...ready.config, aiEnabled: false },
      }),
    ).toBe(s.setupEnable);
    expect(
      promptReadiness({
        ...ready,
        config: { ...ready.config, cloudConsent: false },
      }),
    ).toBe(s.setupConsent);
  });
  it("explains unconfigured model and unavailable input monitoring", () => {
    expect(promptReadiness({ ...ready, modelProvisioned: false })).toBe(
      s.setupModel,
    );
    expect(promptReadiness({ ...ready, inputMonitoring: false })).toBe(
      s.setupMonitoring,
    );
  });
  it("requires app-name consent for automatic or all-app context", () => {
    expect(
      promptReadiness({
        ...ready,
        config: { ...ready.config, appCatalogConsent: false },
      }),
    ).toBe(s.setupCatalog);
    expect(
      promptReadiness({
        ...ready,
        config: { ...ready.config, appAccess: "all", allowedApps: [] },
      }),
    ).toBe("");
  });
  it("checks selected window scope and supports case-insensitive executable names", () => {
    expect(
      promptReadiness(ready, { id: "1", app: "Other.exe", title: "Other" }),
    ).toBe(s.setupTarget);
    expect(
      promptReadiness(ready, { id: "2", app: "EDITOR.EXE", title: "Editor" }),
    ).toBe("");
  });
  it("allows a new attempt after a cached desktop failure; host rechecks live status", () => {
    expect(promptReadiness({ ...ready, desktopUnavailable: true })).toBe("");
  });
});
