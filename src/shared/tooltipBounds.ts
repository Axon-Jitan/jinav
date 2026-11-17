// Places a label outside the whole wheel within the display work area.
import type { Bounds } from "./menuBounds";
export function tooltipBounds(
  wheel: Bounds,
  point: { x: number; y: number },
  area: Bounds,
  size: { width: number; height: number },
  placement: "auto" | "top" | "bottom" = "auto",
): Bounds {
  const gap = 12;
  const width = Math.min(size.width, area.width),
    height = Math.min(size.height, area.height);
  const clampX = (x: number) =>
    Math.max(area.x, Math.min(x, area.x + area.width - width));
  const clampY = (y: number) =>
    Math.max(area.y, Math.min(y, area.y + area.height - height));
  const sides = {
    left: {
      x: wheel.x - width - gap,
      y: clampY(point.y - height / 2),
      width,
      height,
    },
    right: {
      x: wheel.x + wheel.width + gap,
      y: clampY(point.y - height / 2),
      width,
      height,
    },
    top: {
      x: clampX(point.x - width / 2),
      y: wheel.y - height - gap,
      width,
      height,
    },
    bottom: {
      x: clampX(point.x - width / 2),
      y: wheel.y + wheel.height + gap,
      width,
      height,
    },
  };
  const dx = point.x - (wheel.x + wheel.width / 2),
    dy = point.y - (wheel.y + wheel.height / 2);
  const preferred =
    placement !== "auto"
      ? sides[placement]
      : Math.abs(dx) < 10
        ? dy < 0
          ? sides.top
          : sides.bottom
        : dx < 0
          ? sides.left
          : sides.right;
  const candidates = [
    preferred,
    dy < 0 ? sides.top : sides.bottom,
    sides.left,
    sides.right,
    sides.top,
    sides.bottom,
  ];
  const result = candidates.find(
    (b) =>
      b.x >= area.x &&
      b.y >= area.y &&
      b.x + b.width <= area.x + area.width &&
      b.y + b.height <= area.y + area.height,
  ) ?? { ...preferred, x: clampX(preferred.x), y: clampY(preferred.y) };
  return { ...result, x: Math.round(result.x), y: Math.round(result.y) };
}
