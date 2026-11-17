// Verifies compact radius limits preserve target separation and neutral center.
import { expect, it } from "vitest";
import {
  wheelGeometry,
  MIN_WHEEL_RADIUS,
  MAX_WHEEL_RADIUS,
  WHEEL_TARGET_SIZE,
  DEFAULT_WHEEL_RADIUS,
} from "./wheelGeometry";
import { configSchema, defaultConfig } from "./config";
it("keeps eight 44-pixel targets separate at every supported radius", () => {
  for (let radius = MIN_WHEEL_RADIUS; radius <= MAX_WHEEL_RADIUS; radius++) {
    const layout = wheelGeometry(radius);
    for (let i = 0; i < 8; i++) {
      const a = layout.positions[i],
        b = layout.positions[(i + 1) % 8];
      if (!a || !b) throw Error("Missing wheel position");
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(
        WHEEL_TARGET_SIZE,
      );
      expect(
        Math.hypot(a[0] - layout.size / 2, a[1] - layout.size / 2) -
          WHEEL_TARGET_SIZE / 2,
      ).toBeGreaterThan(35);
      for (const coordinate of a) {
        expect(coordinate - WHEEL_TARGET_SIZE / 2).toBeGreaterThanOrEqual(0);
        expect(coordinate + WHEEL_TARGET_SIZE / 2).toBeLessThanOrEqual(
          layout.size,
        );
      }
    }
  }
});
it("migrates existing profiles without changing their radius and rejects unsafe settings", () => {
  const old: Record<string, unknown> = { ...defaultConfig };
  delete old.menuRadius;
  expect(configSchema.parse(old).menuRadius).toBe(DEFAULT_WHEEL_RADIUS);
  expect(
    configSchema.safeParse({ ...defaultConfig, menuRadius: 20 }).success,
  ).toBe(false);
  expect(
    configSchema.safeParse({ ...defaultConfig, menuRadius: 999 }).success,
  ).toBe(false);
  expect(wheelGeometry(-1).radius).toBe(MIN_WHEEL_RADIUS);
  expect(wheelGeometry(999).radius).toBe(MAX_WHEEL_RADIUS);
});
