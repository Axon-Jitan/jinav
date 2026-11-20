// Splits a frozen app list into reachable wheel pages without limiting saved apps.
import type { AppEntry } from "./config";
import { WHEEL_PAGE_SIZE } from "./wheelGeometry";
export function wheelPages(apps: readonly AppEntry[], requested: number) {
  const pageSize = WHEEL_PAGE_SIZE,
    count = Math.max(1, Math.ceil(apps.length / pageSize));
  const page = Math.max(
    0,
    Math.min(count - 1, Number.isFinite(requested) ? Math.floor(requested) : 0),
  );
  return {
    page,
    count,
    apps: apps.slice(page * pageSize, (page + 1) * pageSize),
  };
}
