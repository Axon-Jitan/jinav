// Commits ordinary preference changes atomically before updating visible saved state.
import { useRef, useState } from "react";
import type { Config } from "../shared/config";
import { strings as s } from "./strings";
export function useSettings(
  initial: Config,
  onSaved: () => Promise<void>,
  onError: (message: string) => void,
) {
  const [config, setConfig] = useState(initial);
  const current = useRef(initial);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = async (patch: Partial<Config>) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const next = { ...current.current, ...patch };
      const result = await window.jinav.saveConfig(next);
      if (!result.ok) {
        onError(result.error);
        return false;
      }
      current.current = next;
      setConfig(next);
      setMessage(s.saved);
      await onSaved();
      return true;
    } catch (error) {
      onError(error instanceof Error ? error.message : s.settingsSaveError);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return { config, busy, message, update, onError };
}
export type SettingsState = ReturnType<typeof useSettings>;
