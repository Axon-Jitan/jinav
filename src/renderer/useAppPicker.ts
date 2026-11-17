// Manages staged app selection; permissions change only after confirmation.
import { useEffect, useState } from "react";
import type { AppEntry } from "../shared/config";
import { pickerApps } from "../shared/pickerApps";
export function useAppPicker(
  selected: readonly AppEntry[],
  onError: (message: string) => void,
) {
  const [entries, setEntries] = useState<AppEntry[]>([]);
  const [staged, setStaged] = useState([...selected]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUtilities, setShowUtilities] = useState(false);
  useEffect(() => {
    let alive = true;
    void window.jinav.discover().then((result) => {
      if (!alive) return;
      if (result.ok) setEntries(result.value);
      else onError(result.error);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [onError]);
  const toggle = (entry: AppEntry) =>
    setStaged((current) =>
      current.some((app) => app.id === entry.id)
        ? current.filter((app) => app.id !== entry.id)
        : [...current, entry],
    );
  const manual = async () => {
    const result = await window.jinav.manualApp();
    if (!result.ok) onError(result.error);
    else if (result.value) {
      const entry = result.value;
      setEntries((current) =>
        current.some((app) => app.id === entry.id)
          ? current
          : [entry, ...current],
      );
      setQuery(entry.name);
      setStaged((current) =>
        !current.some((app) => app.id === entry.id)
          ? [...current, entry]
          : current,
      );
    }
  };
  const changed =
    staged.length !== selected.length ||
    staged.some((app, i) => app.id !== selected[i]?.id);
  const visible = pickerApps(
    entries,
    query,
    showUtilities,
    selected.map((entry) => entry.id),
  );
  const allShownSelected =
    visible.entries.length > 0 &&
    visible.entries.every((entry) => staged.some((app) => app.id === entry.id));
  const selectShown = () =>
    setStaged((current) =>
      allShownSelected
        ? current.filter(
            (app) => !visible.entries.some((entry) => entry.id === app.id),
          )
        : [
            ...current,
            ...visible.entries.filter(
              (entry) => !current.some((app) => app.id === entry.id),
            ),
          ],
    );
  return {
    ...visible,
    allShownSelected,
    selectShown,
    staged,
    query,
    setQuery,
    loading,
    saving,
    setSaving,
    showUtilities,
    setShowUtilities,
    toggle,
    manual,
    changed,
  };
}
