// Reproduces stale shortcut discovery without launching applications.
import { afterEach, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installedApps } from "./installedApps";
let directory = "";
afterEach(async () => {
  if (directory) {
    if (!directory.startsWith(join(tmpdir(), "jinav-installed-")))
      throw Error("Unexpected test fixture path");
    await rm(directory, { recursive: true, force: true });
  }
});
it("omits leftover shortcuts whose executable was uninstalled, retaining existing Unicode paths", async () => {
  directory = await mkdtemp(join(tmpdir(), "jinav-installed-"));
  const path = join(directory, "Editor ü test.exe");
  await writeFile(path, "discovery fixture, never executed");
  const valid = { id: "working.lnk", name: "Editor", path };
  const stale = {
    id: "old.lnk",
    name: "Deleted app",
    path: join(directory, "deleted.exe"),
  };
  expect(
    await installedApps(
      [
        valid,
        stale,
        { id: "directory.lnk", name: "Not an app", path: directory },
      ],
      [],
    ),
  ).toEqual([valid]);
  await rm(path);
  expect(await installedApps([valid], [])).toEqual([]);
});
it("requires packaged entries to have a verified current manifest registration", async () => {
  const valid = { id: "aumid:live!app", name: "Installed Store app", path: "" };
  const old = { id: "aumid:removed!app", name: "Removed Store app", path: "" };
  expect(
    await installedApps([valid, old], [{ id: valid.id, path: "verified.exe" }]),
  ).toEqual([{ ...valid, path: "verified.exe" }]);
  expect(await installedApps([old], [])).toEqual([]);
});
