// Hosts a bounded native window protocol outside Electron's event loop.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { windowApi } from "./windowApi";
import { z } from "zod";
const windowsSchema = z.array(
  z.object({
    id: z.string(),
    app: z.string(),
    title: z.string(),
    focused: z.boolean(),
  }),
);
const script = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); ${windowApi}
[Console]::Out.WriteLine('{"ready":true}');
while($line=[Console]::ReadLine()) { try { $r=ConvertFrom-Json $line;
 if($r.kind -eq 'inventory') { $result=@{ok=$true;data=@([JinavWindows]::Inventory())} }
 elseif($r.kind -eq 'foreground') { $result=@{ok=$true;data=[JinavWindows]::Current()} }
 elseif($r.kind -eq 'focus' -and $r.id -match '^\\d+$') { $match=@([JinavWindows]::Inventory()) | Where-Object {$_.id -eq $r.id -and $_.app -eq $r.app}; if($match){$h=[IntPtr][long]$r.id; [void][JinavWindows]::ShowWindowAsync($h,9); [void][JinavWindows]::SetForegroundWindow($h); $result=@{ok=([JinavWindows]::GetForegroundWindow() -eq $h)}}else{$result=@{ok=$false}} }
 else { $result=@{ok=$false} }; [Console]::Out.WriteLine((ConvertTo-Json -InputObject $result -Depth 6 -Compress))
 } catch { [Console]::Out.WriteLine('{"ok":false}') }
}`;
export class WindowService {
  private isReady = false;
  private child: ChildProcessWithoutNullStreams | undefined;
  private buffer = "";
  private receive: ((value: unknown) => void) | undefined;
  private fail: ((error: Error) => void) | undefined;
  private ready: Promise<void> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private ensureReady() {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(script, "utf16le").toString("base64"),
        ],
        { windowsHide: true, shell: false },
      );
      this.child = child;
      const timer = setTimeout(() => {
        child.kill();
        reject(Error("Native window service startup timed out"));
      }, 10000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        this.buffer += chunk;
        if (this.buffer.length > 4 * 1024 * 1024) {
          child.kill();
          this.fail?.(Error("Window inventory exceeded its limit"));
          return;
        }
        let index;
        while ((index = this.buffer.indexOf("\n")) >= 0) {
          const line = this.buffer.slice(0, index);
          this.buffer = this.buffer.slice(index + 1);
          try {
            const value: unknown = JSON.parse(line);
            if (z.object({ ready: z.literal(true) }).safeParse(value).success) {
              clearTimeout(timer);
              this.isReady = true;
              resolve();
            } else this.receive?.(value);
          } catch {
            this.fail?.(Error("Native window service returned invalid data"));
          }
        }
      });
      child.stderr.resume();
      child.stdin.on("error", () =>
        this.fail?.(Error("Native window service disconnected")),
      );
      const failed = () => {
        if (this.child !== child) return;
        clearTimeout(timer);
        const error = Error(
          "Native window service unavailable. Restart jinav in the signed-in desktop session.",
        );
        reject(error);
        this.fail?.(error);
        this.ready = undefined;
        this.isReady = false;
        this.child = undefined;
      };
      child.on("error", failed);
      child.on("exit", failed);
    });
    return this.ready;
  }
  private request(command: object): Promise<unknown> {
    const result = this.queue.then(async () => {
      await this.ensureReady();
      return new Promise<unknown>((resolve, reject) => {
        const finish = (error?: Error, value?: unknown) => {
          clearTimeout(timer);
          this.receive = undefined;
          this.fail = undefined;
          if (error) reject(error);
          else resolve(value);
        };
        const timer = setTimeout(() => {
          this.child?.kill();
          finish(Error("Native window request timed out."));
        }, 8000);
        this.receive = (value) => finish(undefined, value);
        this.fail = (error) => finish(error);
        this.child?.stdin.write(JSON.stringify(command) + "\n");
      });
    });
    this.queue = result.catch(() => {
      /* Caller receives the failure; keep the request queue usable. */
    });
    return result;
  }
  async windows() {
    const result = z
      .object({ ok: z.literal(true), data: windowsSchema })
      .parse(await this.request({ kind: "inventory" }));
    return result.data;
  }
  prepare() {
    void this.ensureReady().catch(() => {
      /* Requests report startup failures; launcher remains usable. */
    });
  }
  async foreground() {
    if (!this.isReady) return undefined;
    const result = z
      .object({ ok: z.literal(true), data: windowsSchema.element.nullable() })
      .parse(await this.request({ kind: "foreground" }));
    return result.data ?? undefined;
  }
  async focus(id: string, app: string) {
    const result = z
      .object({ ok: z.boolean() })
      .parse(await this.request({ kind: "focus", id, app }));
    if (!result.ok)
      throw Error(
        "Windows refused foreground focus. Select the existing window from the taskbar; jinav did not open a duplicate.",
      );
  }
  dispose() {
    this.child?.kill();
  }
}
