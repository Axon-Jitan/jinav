// Gates task work during user interruption; Stop always releases pending waits.
export class PauseGate {
  private paused = false;
  private revision = 0;
  private waiters = new Set<() => void>();
  set(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.revision++;
    if (!paused) for (const wake of this.waiters) wake();
  }
  get generation() {
    return this.revision;
  }
  async wait(signal: AbortSignal) {
    signal.throwIfAborted();
    while (this.paused)
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          this.waiters.delete(wake);
          signal.removeEventListener("abort", abort);
        };
        const wake = () => {
          finish();
          resolve();
        };
        const abort = () => {
          finish();
          reject(signal.reason);
        };
        this.waiters.add(wake);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
    signal.throwIfAborted();
  }
}
