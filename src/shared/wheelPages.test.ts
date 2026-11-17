// Verifies every saved app is reachable without exceeding the compact wheel layout.
import { expect, it } from "vitest";
import { wheelPages } from "./wheelPages";
import { configSchema, defaultConfig } from "./config";
const apps = Array.from({ length: 205 }, (_, index) => ({
  id: `app-${index}`,
  name: `App ${index}`,
  path: `app-${index}.exe`,
}));
it("accepts more than six launcher apps and more than one hundred permission entries", () => {
  const result = configSchema.parse({
    ...defaultConfig,
    apps,
    allowedApps: apps,
  });
  expect(result.apps).toHaveLength(205);
  expect(result.allowedApps).toHaveLength(205);
  expect(
    configSchema.safeParse({ ...defaultConfig, apps: [apps[0], apps[0]] })
      .success,
  ).toBe(false);
});
it("pages the full list in stable order without omitting or duplicating entries", () => {
  const count = wheelPages(apps, 0).count;
  expect(count).toBe(35);
  const reachable = Array.from(
    { length: count },
    (_, page) => wheelPages(apps, page).apps,
  ).flat();
  expect(reachable).toEqual(apps);
  expect(wheelPages(apps, 999).apps).toEqual(apps.slice(204));
  expect(wheelPages([], 0)).toMatchObject({ page: 0, count: 1, apps: [] });
});
