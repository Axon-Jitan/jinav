// Positions the preview caption outside the wheel within its reserved label space.
import { useLayoutEffect, useRef, useState } from "react";
import { tooltipBounds } from "../shared/tooltipBounds";
export function PreviewLabel({
  text,
  point,
  size,
  position = "auto",
}: {
  text: string;
  point: readonly [number, number];
  size: number;
  position?: "auto" | "top" | "bottom";
}) {
  const root = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{
    x: number;
    y: number;
    side: string;
  }>();
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      const label = root.current,
        card = label?.closest(".preview-card");
      if (!label || !card || !active) return;
      const margin = Math.max(
        0,
        (card.getBoundingClientRect().width - size) / 2 - 8,
      );
      const box = label.getBoundingClientRect();
      const bounds = tooltipBounds(
        { x: 0, y: 0, width: size, height: size },
        { x: point[0], y: point[1] },
        { x: -margin, y: -62, width: size + margin * 2, height: size + 124 },
        { width: box.width, height: box.height },
        position,
      );
      const side =
        bounds.x >= size
          ? "right"
          : bounds.x + bounds.width <= 0
            ? "left"
            : bounds.y + bounds.height <= 0
              ? "top"
              : "bottom";
      setPlacement((current) =>
        current?.x === bounds.x &&
        current.y === bounds.y &&
        current.side === side
          ? current
          : { x: bounds.x, y: bounds.y, side },
      );
    };
    measure();
    void document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => {
      active = false;
      window.removeEventListener("resize", measure);
    };
  }, [text, point, size, position]);
  return (
    <div
      ref={root}
      className="native-tooltip preview-caption"
      data-side={placement?.side}
      style={{
        left: placement?.x ?? 0,
        top: placement?.y ?? 0,
        visibility: placement ? "visible" : "hidden",
      }}
    >
      <span>{text}</span>
    </div>
  );
}
