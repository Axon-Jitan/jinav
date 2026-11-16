// Replaces shortcuts transactionally without removing a working registration on conflict.
export interface ShortcutApi {
  register(key: string, callback: () => void): boolean;
  unregister(key: string): void;
}
export class ShortcutRegistrar {
  current = "";
  constructor(
    private readonly api: ShortcutApi,
    private readonly callback: () => void,
  ) {}
  replace(next: string): boolean {
    if (next === this.current) return true;
    try {
      if (!this.api.register(next, this.callback)) return false;
    } catch {
      return false;
    }
    if (this.current) this.api.unregister(this.current);
    this.current = next;
    return true;
  }
}
