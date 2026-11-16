// Runs one bounded native CLI request without a shell; does not retry mutations.
import { spawn } from "node:child_process";
export async function cliProcess(
  executable: string,
  args: readonly string[],
  signal: AbortSignal,
  input?: string,
): Promise<unknown> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      bytes = 0,
      settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(value);
    };
    const abort = () => {
      child.kill();
      finish(
        new Error("Cancelled; a dispatched action may already have happened."),
      );
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(
        new Error(
          "Driver timed out; delivery is uncertain. Re-observe before continuing.",
        ),
      );
    }, 20000);
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 2 * 1024 * 1024) {
        child.kill();
        finish(new Error("Driver output exceeded limit"));
      } else output += chunk;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) {
        child.kill();
        finish(new Error("Driver diagnostic output exceeded limit"));
      }
    });
    child.on("error", () =>
      finish(
        new Error(
          "Native driver could not start. Reinstall the matching application package.",
        ),
      ),
    );
    child.on("close", () => {
      try {
        finish(undefined, JSON.parse(output));
      } catch {
        finish(
          new Error(
            "Driver returned an invalid JSON response; delivery may be uncertain.",
          ),
        );
      }
    });
    child.stdin.on("error", () => {
      /* Process exit is handled by close; never log submitted text. */
    });
    child.stdin.end(input);
    if (signal.aborted) abort();
  });
}
