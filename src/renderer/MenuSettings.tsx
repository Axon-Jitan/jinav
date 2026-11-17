// Renders source selection and editable manual slots with a live wheel preview.
import { useEffect, useState, useRef } from "react";
import type { AppEntry } from "../shared/config";
import type { SettingsState } from "./useSettings";
import { AppPicker } from "./AppPicker";
import { RadialMenu } from "./RadialMenu";
import { SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";
import { strings as s } from "./strings";
import { SourceSelector } from "./SourceSelector";
import { ConfirmDialog } from "./ConfirmDialog";
import { RadiusControl } from "./RadiusControl";
import { AppearanceSettings } from "./AppearanceSettings";
export function MenuSettings({
  state,
  appearance = false,
}: {
  state: SettingsState;
  appearance?: boolean;
}) {
  const c = state.config;
  const onError = state.onError;
  const [picker, setPicker] = useState(false);
  const [derived, setDerived] = useState<AppEntry[]>([]);
  const [dragged, setDragged] = useState<number>();
  const [clear, setClear] = useState(false);
  const [radius, setRadius] = useState(c.menuRadius);
  const radiusSaving = useRef(false);
  const commitRadius = () => {
    if (radiusSaving.current || radius === c.menuRadius || state.busy) return;
    radiusSaving.current = true;
    void state
      .update({ menuRadius: radius })
      .then((ok) => {
        if (!ok) setRadius(c.menuRadius);
      })
      .finally(() => {
        radiusSaving.current = false;
      });
  };
  useEffect(() => {
    let alive = true;
    void window.jinav.wheelApps().then((r) => {
      if (alive && r.ok) setDerived(r.value);
      else if (!r.ok) onError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [c, onError]);
  const entries = c.appSource === "selected" ? c.apps : derived;
  const reorder = (from: number, to: number) => {
    const apps = [...c.apps];
    const entry = apps.splice(from, 1)[0];
    if (entry) {
      apps.splice(to, 0, entry);
      void state.update({ apps });
    }
  };
  return (
    <>
      {!appearance && (
        <SettingRow title={s.showOnWheel} hint={s.sourceHint}>
          <SourceSelector
            value={c.appSource}
            disabled={state.busy}
            onChange={(appSource) => void state.update({ appSource })}
          />
        </SettingRow>
      )}
      <div className="menu-columns">
        <div className="menu-controls">
          {appearance ? (
            <>
              <h2 className="section-label">{s.menu}</h2>
              <RadiusControl
                value={radius}
                disabled={state.busy}
                onChange={setRadius}
                onCommit={commitRadius}
              />
              <AppearanceSettings state={state} />
              <h2 className="section-label">{s.feel}</h2>
              <SettingRow title={s.animation}>
                <select
                  aria-label={s.animation}
                  disabled={state.busy}
                  value={c.reducedMotion ? "reduced" : "system"}
                  onChange={(e) =>
                    void state.update({
                      reducedMotion: e.target.value === "reduced",
                    })
                  }
                >
                  <option value="system">{s.system}</option>
                  <option value="reduced">{s.motion}</option>
                </select>
              </SettingRow>
            </>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <h2>{s.sourceNames[c.appSource]}</h2>
                  <p className="hint">
                    {c.appSource === "selected"
                      ? s.dragHint
                      : s.sourceDescriptions[c.appSource]}
                  </p>
                </div>
                {c.appSource === "selected" && (
                  <button disabled={state.busy} onClick={() => setPicker(true)}>
                    {s.addApp}
                  </button>
                )}
              </div>
              <ol className="selected-apps">
                {entries.map((entry, index) => (
                  <li
                    key={entry.id}
                    draggable={c.appSource === "selected" && !state.busy}
                    onDragStart={() => setDragged(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragged !== undefined) reorder(dragged, index);
                      setDragged(undefined);
                    }}
                  >
                    <span className="app-number">{index + 1}</span>
                    <span className="small-icon">
                      {entry.icon ? (
                        <img src={entry.icon} alt="" />
                      ) : (
                        entry.name.slice(0, 1)
                      )}
                    </span>
                    <span className="app-name">{entry.name}</span>
                    {c.appSource === "selected" && (
                      <details className="app-actions">
                        <summary aria-label={`${s.change} ${entry.name}`}>
                          ⋯
                        </summary>
                        <div>
                          <button
                            disabled={state.busy || index === 0}
                            onClick={() => reorder(index, index - 1)}
                          >
                            {s.up}
                          </button>
                          <button
                            disabled={state.busy || index === c.apps.length - 1}
                            onClick={() => reorder(index, index + 1)}
                          >
                            {s.down}
                          </button>
                          <button
                            disabled={state.busy}
                            onClick={() =>
                              void state.update({
                                apps: c.apps.filter((e) => e.id !== entry.id),
                              })
                            }
                          >
                            {s.remove}
                          </button>
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
              {!entries.length && (
                <p className="hint">
                  {c.appSource === "running" ? s.noRunning : s.none}
                </p>
              )}
              {c.appSource !== "selected" && (
                <div className="ranking-note">
                  <p className="hint">{s.rankingPrivacy}</p>
                  {["recent", "frequent"].includes(c.appSource) && (
                    <button onClick={() => setClear(true)}>
                      {s.clearAppHistory}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <aside className="preview-card">
          <span>{s.preview}</span>
          <RadialMenu
            config={c}
            apps={entries}
            preview
            radius={appearance ? radius : c.menuRadius}
            launch={() => {}}
            ask={() => {}}
          />
          <small>{entries.length > 6 ? s.wheelPagesHint : s.compact}</small>
          <button
            onClick={() =>
              void window.jinav.tryMenu().then((result) => {
                if (!result.ok) onError(result.error);
              })
            }
          >
            {s.tryMenu}
          </button>
          <p className="hint">{s.tryMenuHint}</p>
        </aside>
      </div>
      {!appearance && (
        <>
          <SettingRow title={s.showAsk} hint={s.showAskHint}>
            <Toggle
              label={s.showAsk}
              disabled={state.busy}
              value={c.showAsk}
              onChange={(value) => void state.update({ showAsk: value })}
            />
          </SettingRow>
          <p className="hint utility-note">{s.utilityNote}</p>
        </>
      )}
      {picker && (
        <AppPicker
          selected={c.apps}
          onClose={() => setPicker(false)}
          onError={state.onError}
          onConfirm={(apps) => state.update({ apps })}
        />
      )}
      {clear && (
        <ConfirmDialog
          title={s.clearAppHistory}
          message={s.clearAppConfirm}
          onClose={() => setClear(false)}
          onConfirm={() =>
            void window.jinav.clearAppHistory().then((r) => {
              if (!r.ok) state.onError(r.error);
              else {
                setDerived(c.apps);
                setClear(false);
              }
            })
          }
        />
      )}
    </>
  );
}
