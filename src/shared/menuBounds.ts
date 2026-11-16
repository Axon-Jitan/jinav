// Clamps launcher bounds in display-independent coordinates.
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function menuBounds(
  cursor: { x: number; y: number },
  area: Bounds,
  size = 420,
): Bounds {
  const width = Math.min(size, area.width),
    height = Math.min(size, area.height);
  return {
    x: Math.round(
      Math.max(
        area.x,
        Math.min(cursor.x - width / 2, area.x + area.width - width),
      ),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(cursor.y - height / 2, area.y + area.height - height),
      ),
    ),
    width,
    height,
  };
}
