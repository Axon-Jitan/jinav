// Exposes real connection status and independent computer-use scope.
import { useState } from "react";
import type { Bootstrap } from "../shared/bridge";
import type { SettingsState } from "./useSettings";
import { AppAccessControl } from "./AppAccessControl";
import { SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";
import { strings as s } from "./strings";
import { TaskLimits } from "./TaskLimits";
export function AskSettings({
  state,
  bootstrap,
}: {
  state: SettingsState;
  bootstrap: Bootstrap;
}) {
  const [status, setStatus] = useState("");
  const c = state.config;
  return (
    <>
      {!bootstrap.modelProvisioned && (
        <p className="hint managed-notice" role="status">
          {s.itSetupPending}
        </p>
      )}
      <h2 className="section-label">{s.access}</h2>
      <SettingRow title={s.enable}>
        <Toggle
          label={s.enable}
          disabled={state.busy}
          value={c.aiEnabled}
          onChange={(value) => void state.update({ aiEnabled: value })}
        />
      </SettingRow>
      {c.aiEnabled && (
        <div className="assistant-consent">
          <p className="hint">{s.cloud}</p>
          <label className="check">
            <input
              aria-label={s.consent}
              type="checkbox"
              checked={c.cloudConsent}
              disabled={state.busy}
              onChange={(e) =>
                void state.update({ cloudConsent: e.target.checked })
              }
            />
            {s.consent}
          </label>
        </div>
      )}
      <AppAccessControl state={state} />
      <SettingRow title={s.screenAccess} hint={s.taskAppObservationHint}>
        <span>{s.taskAppObservation}</span>
      </SettingRow>
      <button
        onClick={() =>
          void window.jinav
            .driverStatus()
            .then((r) => setStatus(r.ok ? r.value : r.error))
        }
      >
        {s.status}
      </button>
      <h2 className="section-label">{s.control}</h2>
      <SettingRow
        title={s.pauseMouse}
        hint={bootstrap.inputMonitoring ? undefined : s.monitorUnavailable}
      >
        <Toggle
          label={s.pauseMouse}
          disabled={state.busy}
          value={c.pauseOnUserInput}
          onChange={(value) => void state.update({ pauseOnUserInput: value })}
        />
      </SettingRow>
      <SettingRow title={s.confirmExternal} hint={s.alwaysConfirm}>
        <span className="setting-value">{s.alwaysRequired}</span>
      </SettingRow>
      <SettingRow title={s.physical} hint={s.physicalHint}>
        <Toggle
          label={s.physical}
          disabled={state.busy}
          value={c.physicalInput}
          onChange={(value) => void state.update({ physicalInput: value })}
        />
      </SettingRow>
      <SettingRow title={s.confirmDeletion} hint={s.alwaysConfirm}>
        <span className="setting-value">{s.alwaysRequired}</span>
      </SettingRow>
      <SettingRow title={s.stop}>
        <kbd>Esc</kbd>
      </SettingRow>
      <TaskLimits state={state} />
      <h2 className="section-label">{s.history}</h2>
      <SettingRow title={s.keepHistory} hint={s.historyOff}>
        <Toggle
          label={s.keepHistory}
          disabled={state.busy}
          value={c.keepTaskHistory}
          onChange={(value) => void state.update({ keepTaskHistory: value })}
        />
      </SettingRow>
      <button
        onClick={() =>
          void window.jinav.clearHistory().then((r) => {
            if (r.ok) setStatus(s.taskSummaryCleared);
            else state.onError(r.error);
          })
        }
      >
        {s.clear}
      </button>
      <p className="hint" role="status">
        {status}
      </p>
    </>
  );
}
