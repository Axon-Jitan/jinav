// Verifies shortcut replacement preserves a usable fallback.
import { expect, it, vi } from "vitest";
import { ShortcutRegistrar } from "./shortcutRegistrar";
it("routes an existing shortcut into the focused recorder without removing its registration", () => {
  let pressed: (() => void) | undefined;
  const callback = vi.fn(),
    captured = vi.fn(() => true),
    unregister = vi.fn();
  const registrar = new ShortcutRegistrar(
    {
      register: (_key, handler) => {
        pressed = handler;
        return true;
      },
      unregister,
    },
    callback,
  );
  registrar.replace("Alt+Shift+Space");
  registrar.capture = captured;
  pressed?.();
  expect(captured).toHaveBeenCalledWith("Alt+Shift+Space");
  expect(callback).not.toHaveBeenCalled();
  expect(unregister).not.toHaveBeenCalled();
  registrar.capture = () => false;
  pressed?.();
  expect(callback).toHaveBeenCalledOnce();
  registrar.capture = undefined;
  pressed?.();
  expect(callback).toHaveBeenCalledTimes(2);
});
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
