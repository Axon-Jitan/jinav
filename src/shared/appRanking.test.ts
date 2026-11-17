// Verifies deterministic launch ranking independently of manual slots and activation.
import { expect, it } from "vitest";
import { appRanking, type AppUsage } from "./appRanking";
import { defaultConfig } from "./config";
const now = 1800000000000;
const apps = ["a", "b", "c", "d"].map((id) => ({
  id,
  name: id,
  path: id + ".exe",
}));
const usage: AppUsage[] = [
  { id: "a", launches: [now - 31 * 86400000], activated: now },
  { id: "b", launches: [now - 100, now - 200], activated: now - 500 },
  { id: "c", launches: [now - 100, now - 200], activated: now - 1000 },
];
it("uses distinct latest launches for recent, including closed apps older than 30 days", () => {
  expect(
    appRanking(
      { ...defaultConfig, appSource: "recent", apps: apps.slice(3) },
      apps,
      usage,
      [],
      now,
    ).map((e) => e.id),
  ).toEqual(["b", "c", "a", "d"]);
});
it("expires old frequency counts and breaks ties by launch time then stable ID", () => {
  expect(
    appRanking(
      { ...defaultConfig, appSource: "frequent" },
      apps,
      usage,
      [],
      now,
    ).map((e) => e.id),
  ).toEqual(["b", "c"]);
});
it("never fills currently open from closed manual selections", () => {
  const config = { ...defaultConfig, appSource: "running" as const, apps };
  expect(
    appRanking(config, apps, usage, ["c", "b"], now).map((e) => e.id),
  ).toEqual(["b", "c"]);
  expect(appRanking(config, apps, usage, [], now)).toEqual([]);
  expect(config.apps).toEqual(apps);
});
it("fills history shortages without duplicates and returns an independent session list", () => {
  const config = { ...defaultConfig, apps, appSource: "recent" as const };
  const result = appRanking(config, apps, usage, [], now);
  result.reverse();
  expect(config.apps.map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
  expect(appRanking(config, apps, [], [], now)).toEqual(apps);
});
