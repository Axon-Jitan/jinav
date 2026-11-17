// Verifies shortcut replacement preserves a usable fallback.
import { expect, it, vi } from "vitest";
import { ShortcutRegistrar } from "./shortcutRegistrar";
it("ignores repeated native key-down until a release event", () => {
  let pressed: (() => void) | undefined;
  const callback = vi.fn();
  const registrar = new ShortcutRegistrar(
    {
      register: (_key, handler) => {
        pressed = handler;
        return true;
      },
      unregister: vi.fn(),
    },
    callback,
  );
  registrar.trackRelease(true);
  registrar.replace("Ctrl+Alt+Space");
  pressed?.();
  pressed?.();
  pressed?.();
  expect(callback).toHaveBeenCalledOnce();
  registrar.release();
  pressed?.();
  expect(callback).toHaveBeenCalledTimes(2);
});
it("retains the old registration on conflict", () => {
  const api = {
    register: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    unregister: vi.fn(),
  };
  const service = new ShortcutRegistrar(api, () => {});
  expect(service.replace("Alt+Shift+Space")).toBe(true);
  expect(service.replace("Ctrl+X")).toBe(false);
  expect(service.current).toBe("Alt+Shift+Space");
  expect(api.unregister).not.toHaveBeenCalled();
});
it("unregisters old only after registering replacement", () => {
  const events: string[] = [];
  const service = new ShortcutRegistrar(
    {
      register: (key) => {
        events.push("register " + key);
        return true;
      },
      unregister: (key) => {
        events.push("unregister " + key);
      },
    },
    () => {},
  );
  service.replace("A");
  service.replace("B");
  expect(events).toEqual(["register A", "register B", "unregister A"]);
});
