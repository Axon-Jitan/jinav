// Defines bounded radial spacing with non-overlapping 44-pixel circular targets.
export const MIN_WHEEL_RADIUS = 58;
export const MAX_WHEEL_RADIUS = 110;
export const DEFAULT_WHEEL_RADIUS = 60;
export const WHEEL_TARGET_SIZE = 44;
export const WHEEL_SIZE = DEFAULT_WHEEL_RADIUS * 2 + WHEEL_TARGET_SIZE;
export const applicationPositions = [1, 2, 4, 5, 6, 7] as const;
export function wheelGeometry(value = DEFAULT_WHEEL_RADIUS) {
  const radius = Math.min(
    MAX_WHEEL_RADIUS,
    Math.max(
      MIN_WHEEL_RADIUS,
      Number.isFinite(value) ? Math.round(value) : DEFAULT_WHEEL_RADIUS,
    ),
  );
  const size = radius * 2 + WHEEL_TARGET_SIZE,
    center = size / 2;
  const positions = Array.from({ length: 8 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 4;
    return [
      Math.round((center + Math.cos(angle) * radius) * 1000) / 1000,
      Math.round((center + Math.sin(angle) * radius) * 1000) / 1000,
    ] as const;
  });
  return { radius, size, positions };
}
