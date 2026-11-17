// Starts a user-session focus helper from the foreground launcher process.
// Uses normal Windows activation rules; never relaunches the target application.
import { execFile } from "node:child_process";
import { z } from "zod";
import { windowApi } from "./windowApi";
const targetSchema = z
  .object({
    id: z.string().regex(/^\d+$/).max(30),
    app: z.string().min(1).max(260),
  })
  .strict();
const script = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; ${windowApi}
$r=ConvertFrom-Json ([Console]::In.ReadToEnd());
$match=@([JinavWindows]::Inventory()) | Where-Object {$_.id -eq $r.id -and $_.app -eq $r.app};
$ok=$false;if($match){$ok=[JinavWindows]::Focus([IntPtr][long]$r.id)};
ConvertTo-Json -InputObject @{ok=$ok} -Compress;`;
export async function focusWindow(
  id: string,
  app: string,
  signal?: AbortSignal,
) {
  const target = targetSchema.parse({ id, app });
  signal?.throwIfAborted();
  const output = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
      {
        windowsHide: true,
        shell: false,
        timeout: 8000,
        maxBuffer: 16384,
        signal,
      },
      (error, stdout) => {
        if (error)
          reject(
            Error(
              "Windows could not activate this window. Try selecting it from the taskbar.",
            ),
          );
        else resolve(stdout);
      },
    );
    child.stdin?.on("error", () => {
      /* Completion reports helper failures. */
    });
    child.stdin?.end(JSON.stringify(target));
  });
  signal?.throwIfAborted();
  return z
    .object({ ok: z.boolean() })
    .parse(JSON.parse(output.replace(/^\uFEFF/, "").trim())).ok;
}
