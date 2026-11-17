// Organizes discovered apps for selection; never invents installed entries.
import type { AppEntry } from "./config";
import { appDisplayName } from "./appDisplayName";
const utilities =
  /data source|administrative tools|windows tools|virtual network adapter|command prompt|powershell|registry editor|component services|computer management|event viewer|local security|odbc|performance monitor|resource monitor|recovery drive|^services$|system configuration|task scheduler|windows defender firewall|windows memory diagnostic/i;
const familiar =
  /^(microsoft )?(word|excel|outlook|powerpoint|access|onenote|teams|edge|notepad|calculator|paint|photos|file explorer|explorer|google chrome|chrome|firefox|safari|visual studio code|code|slack|zoom|7-zip file manager)(\s|$)/i;
export function pickerApps(
  entries: readonly AppEntry[],
  query: string,
  showUtilities: boolean,
  selectedIds: readonly string[] = [],
) {
  const named = entries.map((entry) => ({
    ...entry,
    name: appDisplayName(entry.name),
  }));
  // Only coalesce known Windows built-ins; arbitrary same-named shortcuts stay distinct.
  const builtins = /^(Notepad|Paint|Calculator|File Explorer)$/;
  const grouped = new Map<string, AppEntry>();
  for (const entry of named) {
    const identity = builtins.test(entry.name) ? entry.name : entry.id;
    const previous = grouped.get(identity);
    if (
      !previous ||
      (selectedIds.includes(entry.id) && !selectedIds.includes(previous.id))
    )
      grouped.set(identity, entry);
  }
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = [...grouped.values()].filter((entry) =>
    words.every((word) => entry.name.toLocaleLowerCase().includes(word)),
  );
  const visible = matches.filter(
    (entry) => words.length > 0 || showUtilities || !utilities.test(entry.name),
  );
  visible.sort(
    (a, b) =>
      Number(familiar.test(b.name)) - Number(familiar.test(a.name)) ||
      a.name.localeCompare(b.name),
  );
  return { entries: visible, hiddenCount: matches.length - visible.length };
}
