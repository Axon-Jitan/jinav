// Owns the driver's transient snapshot cache beneath jinav's private data directory.
import { mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
export class TaskCache {
  constructor(readonly root: string) {}
  async reset() {
    await rm(this.root, { recursive: true, force: true });
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }
  path(runId: string) {
    if (!/^[a-f0-9-]{36}$/.test(runId))
      throw Error("Invalid cache run identifier");
    return join(this.root, runId);
  }
  async remove(path: string) {
    if (dirname(path) !== this.root) throw Error("Invalid cache cleanup path");
    await rm(path, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}
