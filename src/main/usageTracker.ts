// Counts first visible windows of new primary processes, independently of activation.
import type { DesktopEvent } from "../platform/platformAdapter";
import type { ConfigStore } from "./configStore";
import type { AppCatalogue } from "./appCatalogue";
import type { UsageStore } from "./usageStore";
export class UsageTracker {
  private seen = new Set<string>();
  constructor(
    private readonly store: ConfigStore,
    private readonly catalogue: AppCatalogue,
    private readonly usage: UsageStore,
    private readonly started = Date.now(),
  ) {}
  async accept(event: DesktopEvent) {
    if (event.kind !== "window") return;
    const entry = this.catalogue.entries.find(
      (e) => e.path.toLowerCase() === event.app.toLowerCase(),
    );
    if (!entry) return;
    const isNew = !this.seen.has(event.processId);
    this.seen.add(event.processId);
    if (this.store.config.appSource === "selected") return;
    if (this.seen.size > 10000)
      this.seen.delete(this.seen.values().next().value ?? "");
    const ticks = event.processId.split("-")[1];
    if (!ticks || !/^\d+$/.test(ticks)) return;
    const processStarted = Number(
      (BigInt(ticks) - 621355968000000000n) / 10000n,
    );
    const launched =
      isNew &&
      processStarted >= this.started &&
      ["recent", "frequent"].includes(this.store.config.appSource);
    if (launched || event.activated)
      await this.usage.record(entry.id, launched, Date.now(), event.activated);
  }
}
