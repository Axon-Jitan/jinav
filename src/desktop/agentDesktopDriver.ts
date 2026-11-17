// Maps validated actions to agent-desktop 1.3.1 commands; never enables headed mode implicitly.
import { z } from "zod";
import { cliProcess } from "./cliProcess";
import type { DesktopDriver, Observation } from "./desktopDriver";
const disposition = z.object({ delivery: z.string(), retry: z.string() });
const envelope = z.object({
  version: z.literal("2.6"),
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({ code: z.string(), disposition: disposition.optional() })
    .passthrough()
    .optional(),
});
export class AgentDesktopDriver implements DesktopDriver {
  private physicalStarted = false;
  constructor(
    private readonly executable: string,
    private readonly session: string,
  ) {}
  private async run(args: string[], signal: AbortSignal, input?: string) {
    return envelope.parse(
      await cliProcess(
        this.executable,
        [...args, "--session", this.session],
        signal,
        input,
      ),
    );
  }
  async status(signal: AbortSignal) {
    return this.run(["status"], signal);
  }
  async allWindows(signal: AbortSignal) {
    const result = await this.run(["list-windows"], signal);
    if (!result.ok)
      throw Error(
        `Window inventory refused: ${result.error?.code ?? "UNKNOWN"}`,
      );
    return z
      .array(
        z.object({ id: z.string(), app_name: z.string(), title: z.string() }),
      )
      .parse(result.data)
      .map((window) => ({
        id: window.id,
        app: window.app_name,
        title: window.title,
      }));
  }
  async focusWindow(target: { id: string; app: string }, signal: AbortSignal) {
    const result = await this.run(
      [
        "focus-window",
        "--window-id",
        target.id,
        "--app",
        target.app,
        "--headed",
      ],
      signal,
    );
    if (!result.ok)
      throw Error(
        `Windows could not focus the approved application (${result.error?.code ?? "UNKNOWN"}). Select its window manually.`,
      );
  }
  async listWindows(application: string, signal: AbortSignal) {
    const result = await this.run(
      ["list-windows", "--app", application],
      signal,
    );
    if (!result.ok)
      throw Error(
        `Application window inventory refused: ${result.error?.code ?? "UNKNOWN"}`,
      );
    return z
      .array(
        z.object({ id: z.string(), app_name: z.string(), title: z.string() }),
      )
      .parse(result.data)
      .filter(
        (window) => window.app_name.toLowerCase() === application.toLowerCase(),
      )
      .map((window) => ({
        id: window.id,
        app: window.app_name,
        title: window.title,
      }));
  }
  async observe(
    target: Parameters<DesktopDriver["observe"]>[0],
    signal: AbortSignal,
  ): Promise<Observation> {
    const result = await this.run(
      [
        "snapshot",
        "--app",
        target.app,
        "--window-id",
        target.id,
        "--timeout-ms",
        "8000",
      ],
      signal,
    );
    if (!result.ok)
      throw Error(
        `Observation refused: ${result.error?.code ?? "UNKNOWN"}. Check window availability and permissions.`,
      );
    const text = JSON.stringify(result.data);
    if (text.length > 100000)
      throw Error(
        "The selected window exposes too much UI text. Use a smaller application window or a manual step.",
      );
    const refs = new Set<string>();
    function collect(value: unknown): void {
      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }
      if (value && typeof value === "object")
        for (const [key, item] of Object.entries(value)) {
          if (
            key === "ref_id" &&
            typeof item === "string" &&
            /^@[\w-]+:e\d+$/.test(item)
          )
            refs.add(item);
          else collect(item);
        }
    }
    collect(result.data);
    const metadata = z
      .object({
        complete: z.literal(true),
        app: z.string(),
        window: z.object({ id: z.string() }),
      })
      .parse(result.data);
    if (
      metadata.window.id !== target.id ||
      metadata.app.toLowerCase() !== target.app.toLowerCase()
    )
      throw Error("Observation target changed or is out of scope.");
    return { text, refs };
  }
  async execute(
    action: Parameters<DesktopDriver["execute"]>[0],
    target: Parameters<DesktopDriver["execute"]>[1],
    physical: boolean,
    signal: AbortSignal,
  ) {
    let args: string[], input: string | undefined;
    switch (action.kind) {
      case "click":
        args = ["click", action.ref];
        break;
      case "set-value":
      case "type":
        args = [action.kind, action.ref, "--stdin"];
        input = action.text;
        break;
      case "press":
        args = [
          "press",
          action.key,
          "--app",
          target.app,
          "--window-id",
          target.id,
        ];
        break;
      default:
        throw Error("This action is not a desktop operation");
    }
    if (action.kind === "type" || action.kind === "press") {
      if (!physical) throw Error("Physical input permission is required.");
      if (this.physicalStarted) {
        const inventory = await this.run(
          ["list-windows", "--app", target.app],
          signal,
        );
        const windows = z
          .array(z.object({ id: z.string(), is_focused: z.boolean() }))
          .parse(inventory.data);
        if (
          !inventory.ok ||
          !windows.some((w) => w.id === target.id && w.is_focused)
        )
          throw Error(
            "Target focus changed. Stopped before physical input; select fresh context in a new task.",
          );
      }
      args.push("--headed");
      this.physicalStarted = true;
    }
    const result = await this.run(args, signal, input);
    const parsed = disposition.safeParse(
      result.ok
        ? (result.data as { disposition?: unknown })?.disposition
        : result.error?.disposition,
    );
    return {
      ok: result.ok,
      code: result.error?.code,
      delivery: parsed.success ? parsed.data.delivery : "unknown",
      safeRetry:
        parsed.success &&
        parsed.data.retry === "safe" &&
        parsed.data.delivery === "not_delivered",
    };
  }
}
