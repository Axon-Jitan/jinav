// Verifies menu placement across work areas expressed in Electron DIPs.
import { describe, expect, it } from "vitest";
import { menuBounds } from "./menuBounds";
describe("menu bounds", () => {
  for (const scale of [1, 1.5, 2])
    for (const origin of [
      { x: 0, y: 0 },
      { x: -1920, y: -300 },
      { x: 1920, y: 0 },
    ]) {
      const area = { ...origin, width: 1920 / scale, height: 1040 / scale };
      for (const point of [
        { x: area.x, y: area.y },
        { x: area.x + area.width, y: area.y + area.height },
        { x: area.x + area.width / 2, y: area.y + area.height / 2 },
      ])
        it(`contains menu at ${JSON.stringify(point)} at ${scale}x`, () => {
          const bounds = menuBounds(point, area);
          expect(bounds.x).toBeGreaterThanOrEqual(area.x);
          expect(bounds.y).toBeGreaterThanOrEqual(area.y);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(
            Math.ceil(area.x + area.width),
          );
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(
            Math.ceil(area.y + area.height),
          );
        });
    }
  it("shrinks to a small work area", () =>
    expect(
      menuBounds({ x: 0, y: 0 }, { x: 0, y: 0, width: 300, height: 200 }),
    ).toEqual({ x: 0, y: 0, width: 300, height: 200 }));
});
