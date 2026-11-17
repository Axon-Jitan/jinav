// Verifies native window/activation events count a primary process launch once.
import { expect, it, vi } from "vitest";
import { UsageTracker } from "./usageTracker";
import { ConfigStore } from "./configStore";
import type { UsageStore } from "./usageStore";
import type { AppCatalogue } from "./appCatalogue";
it("ignores pre-existing processes, helpers and repeated focus events as launches", async () => {
  const store = new ConfigStore("unused");
  store.config.appSource = "frequent";
  const catalogue = {
    entries: [{ id: "editor", name: "Editor", path: "C:/editor.exe" }],
  } as unknown as AppCatalogue;
  const usage = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as UsageStore;
  const tracker = new UsageTracker(store, catalogue, usage, 1000);
  const event = {
    kind: "window" as const,
    app: "C:/editor.exe",
    id: "1",
    processId: "42-621355968020000000",
    activated: true,
  };
  await tracker.accept(event);
  await tracker.accept(event);
  await tracker.accept({ ...event, id: "2" });
  expect(usage.record).toHaveBeenNthCalledWith(
    1,
    "editor",
    true,
    expect.any(Number),
    true,
  );
  expect(usage.record).toHaveBeenNthCalledWith(
    2,
    "editor",
    false,
    expect.any(Number),
    true,
  );
  expect(usage.record).toHaveBeenNthCalledWith(
    3,
    "editor",
    false,
    expect.any(Number),
    true,
  );
  await tracker.accept({ ...event, processId: "4-621355968000000000" });
  expect(usage.record).toHaveBeenLastCalledWith(
    "editor",
    false,
    expect.any(Number),
    true,
  );
  await tracker.accept({ ...event, app: "C:/helper.exe" });
  expect(usage.record).toHaveBeenCalledTimes(4);
  store.config.appSource = "selected";
  await tracker.accept({ ...event, processId: "43-621355968020000000" });
  expect(usage.record).toHaveBeenCalledTimes(4);
});
