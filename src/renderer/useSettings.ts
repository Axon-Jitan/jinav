// Coordinates settings edits without directly accessing native services.
import { useState } from "react";
import type { Config, AppEntry } from "../shared/config";
export function useSettings(
  initial: Config,
  onSaved: () => Promise<void>,
  onError: (message: string) => void,
) {
  const [config, setConfig] = useState(initial);
  const [catalogue, setCatalogue] = useState<AppEntry[]>([]);
  const [search, setSearch] = useState("");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const change = <K extends keyof Config>(name: K, value: Config[K]) =>
    setConfig((current) => ({
      ...current,
      [name]: value,
      ...(name === "endpoint" ? { cloudConsent: false } : {}),
    }));
  const discover = async () => {
    setBusy(true);
    try {
      const result = await window.jinav.discover();
      if (result.ok) setCatalogue(result.value);
      else onError(result.error);
    } finally {
      setBusy(false);
    }
  };
  const add = (entry: AppEntry) => {
    if (config.apps.length >= 6 || config.apps.some((e) => e.id === entry.id))
      return;
    change("apps", [...config.apps, entry]);
  };
  const manual = async () => {
    const result = await window.jinav.manualApp();
    if (result.ok && result.value) add(result.value);
    else if (!result.ok) onError(result.error);
  };
  const move = (index: number, offset: number) => {
    const list = [...config.apps];
    const item = list[index];
    if (!item || index + offset < 0 || index + offset >= list.length) return;
    list.splice(index, 1);
    list.splice(index + offset, 0, item);
    change("apps", list);
  };
  const save = async () => {
    const result = await window.jinav.saveConfig(config);
    if (!result.ok) onError(result.error);
    else {
      setMessage(result.value);
      await onSaved();
    }
  };
  const saveKey = async () => {
    const result = await window.jinav.saveKey(key);
    if (result.ok) {
      setMessage(result.value);
      setKey("");
    } else onError(result.error);
  };
  const check = async (which: "model" | "driver" | "clear") => {
    setBusy(true);
    try {
      const result = await (which === "model"
        ? window.jinav.testModel()
        : which === "driver"
          ? window.jinav.driverStatus()
          : window.jinav.clearHistory());
      if (result.ok)
        setMessage(
          typeof result.value === "string" ? result.value : "History cleared",
        );
      else onError(result.error);
    } finally {
      setBusy(false);
    }
  };
  return {
    config,
    catalogue,
    search,
    setSearch,
    key,
    setKey,
    message,
    busy,
    change,
    discover,
    add,
    manual,
    move,
    save,
    saveKey,
    check,
  };
}
