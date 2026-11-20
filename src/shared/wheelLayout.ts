// Populates one evenly spaced wheel page without empty application positions.
import type { AppEntry } from "./config";
import {
  wheelGeometry,
  WHEEL_PAGE_SIZE,
  DEFAULT_WHEEL_RADIUS,
} from "./wheelGeometry";
type Entry =
  | { kind: "app"; id: string; app: AppEntry }
  | { kind: "ask" | "settings"; id: string };
export function wheelLayout(
  apps: readonly AppEntry[],
  showAsk: boolean,
  radius = DEFAULT_WHEEL_RADIUS,
) {
  const entries: Entry[] = [
    ...(showAsk ? [{ kind: "ask" as const, id: "ask" }] : []),
    ...apps
      .slice(0, WHEEL_PAGE_SIZE)
      .map((app) => ({ kind: "app" as const, id: app.id, app })),
  ];
  // Keep the full wheel's familiar utility order while compacting partial pages.
  entries.splice(Math.min(3, entries.length), 0, {
    kind: "settings",
    id: "settings",
  });
  const geometry = wheelGeometry(radius, entries.length);
  return {
    ...geometry,
    entries: entries.map((entry, position) => {
      const point = geometry.positions[position];
      if (!point) throw Error("Wheel layout has no position for an entry");
      return { ...entry, position, point };
    }),
  };
}
