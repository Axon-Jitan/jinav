// Checks labels avoid the wheel at screen edges and across display origins.
import { expect, it } from "vitest";
import { tooltipBounds } from "./tooltipBounds";
import { menuBounds } from "./menuBounds";
it("honors above/below preferences with safe fallback at display edges", () => {
  const wheel = { x: 300, y: 300, width: 160, height: 160 };
  const area = { x: 0, y: 0, width: 1200, height: 800 };
  const point = { x: 422, y: 338 };
  const size = { width: 120, height: 32 };
  expect(tooltipBounds(wheel, point, area, size, "top").y).toBeLessThan(
    wheel.y,
  );
  expect(tooltipBounds(wheel, point, area, size, "bottom").y).toBeGreaterThan(
    wheel.y + wheel.height,
  );
  const edge = { ...wheel, y: 0 };
  expect(
    tooltipBounds(edge, { ...point, y: 30 }, area, size, "top").y,
  ).toBeGreaterThanOrEqual(0);
});
it("places crowded preview labels above or below instead of across icons", () => {
  const wheel = { x: 0, y: 0, width: 164, height: 164 },
    area = { x: -69, y: -62, width: 302, height: 288 };
  const upper = tooltipBounds(wheel, { x: 38, y: 38 }, area, {
    width: 120,
    height: 32,
  });
  const lower = tooltipBounds(wheel, { x: 126, y: 126 }, area, {
    width: 120,
    height: 32,
  });
  expect(upper.y + upper.height).toBeLessThan(0);
  expect(lower.y).toBeGreaterThan(164);
});
it("puts left and right app labels beyond the entire wheel", () => {
  const wheel = { x: 300, y: 300, width: 160, height: 160 },
    area = { x: 0, y: 0, width: 1200, height: 800 };
  expect(
    tooltipBounds(wheel, { x: 338, y: 338 }, area, { width: 120, height: 32 })
      .x + 120,
  ).toBeLessThan(wheel.x);
  expect(
    tooltipBounds(wheel, { x: 422, y: 338 }, area, { width: 120, height: 32 })
      .x,
  ).toBeGreaterThan(wheel.x + wheel.width);
});
it("keeps labels on screen without intersecting icons at corners and negative monitor coordinates", () => {
  for (const scale of [1, 1.5, 2])
    for (const x of [-1920, 0, 1920]) {
      const area = { x, y: -200, width: 1920 / scale, height: 1040 / scale };
      for (const point of [
        { x, y: -200 },
        { x: x + area.width, y: -200 },
        { x, y: area.y + area.height },
        { x: x + area.width, y: area.y + area.height },
      ]) {
        const wheel = menuBounds(point, area, 160);
        for (const local of [
          { x: 38, y: 38 },
          { x: 122, y: 38 },
          { x: 80, y: 20 },
          { x: 80, y: 140 },
        ]) {
          const b = tooltipBounds(
            wheel,
            { x: wheel.x + local.x, y: wheel.y + local.y },
            area,
            { width: 300, height: 50 },
          );
          expect(b.x).toBeGreaterThanOrEqual(area.x);
          expect(b.y).toBeGreaterThanOrEqual(area.y);
          expect(b.x + b.width).toBeLessThanOrEqual(area.x + area.width);
          expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height);
          expect(
            b.x + b.width <= wheel.x ||
              b.x >= wheel.x + wheel.width ||
              b.y + b.height <= wheel.y ||
              b.y >= wheel.y + wheel.height,
          ).toBe(true);
        }
      }
    }
});
