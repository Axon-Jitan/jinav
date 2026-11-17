// Verifies discovery presentation preserves access to real installed apps.
import { describe, expect, it } from "vitest";
import { pickerApps } from "./pickerApps";
const apps = [
  "64-bit Data Source Administrator",
  "Custom Work App",
  "Microsoft Word",
  "Add a new dco-win virtual network adapter",
  "Notepad",
  "Administrative Tools",
].map((name) => ({ id: name, name, path: name }));
describe("pickerApps", () => {
  it("uses familiar built-in names and preserves a selected identity when duplicate registrations exist", () => {
    const copies = [
      { id: "classic", name: "notepad", path: "classic.exe" },
      { id: "store", name: "Notepad", path: "store.exe" },
      { id: "files", name: "explorer", path: "explorer.exe" },
    ];
    const results = pickerApps(copies, "", false, ["store"]).entries;
    expect(results.map((app) => app.name)).toEqual([
      "File Explorer",
      "Notepad",
    ]);
    expect(results.find((app) => app.name === "Notepad")?.id).toBe("store");
  });
  it("puts familiar installed apps first without adding suggestions that are not installed", () => {
    expect(pickerApps(apps, "", false).entries.map((app) => app.name)).toEqual([
      "Microsoft Word",
      "Notepad",
      "Custom Work App",
    ]);
  });
  it("keeps system shortcuts available on request and in search", () => {
    expect(pickerApps(apps, "", false).hiddenCount).toBe(3);
    expect(pickerApps(apps, "", true).entries).toHaveLength(6);
    expect(pickerApps(apps, " DATA source ", false).entries[0]?.name).toBe(
      apps[0]?.name,
    );
  });
  it("matches words regardless of order and handles empty results without mutating discovery", () => {
    expect(pickerApps(apps, "word micro", false).entries[0]?.name).toBe(
      "Microsoft Word",
    );
    expect(pickerApps(apps, "uninstalled", false).entries).toEqual([]);
    expect(apps[0]?.name).toBe("64-bit Data Source Administrator");
  });
});
