// Verifies partial pages use every angular position without changing saved app order.
import { expect, it } from "vitest";
import { wheelLayout } from "./wheelLayout";
import { wheelPages } from "./wheelPages";
const apps = Array.from({ length: 13 }, (_, i) => ({
  id: `app-${i}`,
  name: `App ${i}`,
  path: `app-${i}.exe`,
}));
it("evenly fills circles for every app count and Ask visibility", () => {
  for (const count of [0, 1, 2, 3, 4, 5, 6])
    for (const showAsk of [false, true]) {
      const selected = apps.slice(0, count),
        layout = wheelLayout(selected, showAsk);
      expect(layout.entries).toHaveLength(count + 1 + Number(showAsk));
      expect(
        layout.entries.filter((e) => e.kind === "app").map((e) => e.id),
      ).toEqual(selected.map((e) => e.id));
      const angles = layout.entries.map(
        (e) =>
          (Math.atan2(
            e.point[1] - layout.size / 2,
            e.point[0] - layout.size / 2,
          ) +
            Math.PI * 2.5) %
          (Math.PI * 2),
      );
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i],
          b = angles[(i + 1) % angles.length];
        if (a === undefined || b === undefined) throw Error("Missing angle");
        const gap = i === angles.length - 1 ? b + Math.PI * 2 - a : b - a;
        expect(gap).toBeCloseTo((Math.PI * 2) / angles.length, 4);
      }
      expect(layout.entries.filter((e) => e.kind === "settings")).toHaveLength(
        1,
      );
      expect(layout.entries.some((e) => e.kind === "ask")).toBe(showAsk);
    }
});
it("compacts removal and partial last pages with no stale positions", () => {
  const selected = apps.slice(0, 6),
    remaining = selected.filter((e) => e.id !== "app-2");
  const full = wheelLayout(selected, true),
    reduced = wheelLayout(remaining, true);
  expect(full.entries).toHaveLength(8);
  expect(reduced.entries).toHaveLength(7);
  expect(reduced.entries.map((e) => e.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(reduced.entries.some((e) => e.id === "app-2")).toBe(false);
  expect(selected).toEqual(apps.slice(0, 6));
  const final = wheelLayout(wheelPages(apps, 2).apps, true);
  expect(final.entries.map((e) => e.id)).toEqual(["ask", "app-12", "settings"]);
  expect(
    final.entries.find((e) => e.kind === "settings")?.point[0],
  ).toBeLessThan(final.size / 2);
});
