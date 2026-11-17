// Edits explicit application permissions independently of launcher slots.
import { useState } from "react";
import type { SettingsState } from "./useSettings";
import { SettingRow } from "./SettingRow";
import { AppPicker } from "./AppPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { strings as s } from "./strings";
export function AppAccessControl({ state }: { state: SettingsState }) {
  const [picker, setPicker] = useState(false),
    [confirm, setConfirm] = useState(false);
  const c = state.config;
  return (
    <>
      <SettingRow
        title={s.allowedApps}
        hint={
          c.appAccess === "all"
            ? s.allAppsHint
            : c.allowedApps.map((app) => app.name).join(", ") || s.none
        }
      >
        <select
          aria-label={s.applicationAccess}
          value={c.appAccess}
          disabled={state.busy}
          onChange={(e) => {
            if (e.target.value === "all") setConfirm(true);
            else void state.update({ appAccess: "selected" });
          }}
        >
          <option value="selected">{s.selectedAccess}</option>
          <option value="all">{s.allAccess}</option>
        </select>
        {c.appAccess === "selected" && (
          <button disabled={state.busy} onClick={() => setPicker(true)}>
            {s.chooseApps}
          </button>
        )}
      </SettingRow>
      {picker && (
        <AppPicker
          selected={c.allowedApps}
          purpose="permissions"
          onConfirm={(allowedApps) =>
            state.update({ allowedApps, appCatalogConsent: true })
          }
          onClose={() => setPicker(false)}
          onError={state.onError}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={s.allAccessTitle}
          message={s.allAccessDisclosure}
          confirmLabel={s.allowAllApps}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            void state
              .update({ appAccess: "all", appCatalogConsent: true })
              .then((ok) => {
                if (ok) setConfirm(false);
              });
          }}
        />
      )}
    </>
  );
}
