// Renders startup preferences and the approved toggle activation contract.
import { useState } from "react";
import type { SettingsState } from "./useSettings";
import { SettingRow } from "./SettingRow";
import { ShortcutDialog } from "./ShortcutDialog";
import { Toggle } from "./Toggle";
import { strings as s } from "./strings";
export function GeneralSettings({ state }: { state: SettingsState }) {
  const [shortcut, setShortcut] = useState(false);
  const c = state.config;
  return (
    <>
      <h2 className="section-label">{s.activation}</h2>
      <SettingRow
        title={s.openMenu}
        hint={c.activationStyle === "toggle" ? s.toggleHint : s.openOnlyHint}
      >
        <div className="keycaps">
          {c.shortcut.split("+").map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
        </div>
        <button className="text-button" onClick={() => setShortcut(true)}>
          {s.change}
        </button>
      </SettingRow>
      <SettingRow title={s.activationStyle}>
        <select
          aria-label={s.activationStyle}
          value={c.activationStyle}
          disabled={state.busy}
          onChange={(e) =>
            void state.update({
              activationStyle: e.target.value as typeof c.activationStyle,
            })
          }
        >
          <option value="toggle">{s.toggleStyle}</option>
          <option value="open">{s.openOnly}</option>
        </select>
      </SettingRow>
      <h2 className="section-label">{s.startup}</h2>
      <SettingRow title={s.launchSignIn}>
        <Toggle
          label={s.launchSignIn}
          value={c.launchOnLogin}
          disabled={state.busy}
          onChange={(value) => void state.update({ launchOnLogin: value })}
        />
      </SettingRow>
      <SettingRow title={s.startQuietly} hint={s.quietHint}>
        <Toggle
          label={s.startQuietly}
          value={c.startQuietly}
          disabled={state.busy}
          onChange={(value) => void state.update({ startQuietly: value })}
        />
      </SettingRow>
      <h2 className="section-label">{s.keyboard}</h2>
      <p className="hint">{s.keyboardReference}</p>
      {[
        [s.navigate, "← ↑ ↓ → / Tab"],
        [s.activate, "Enter"],
        [s.dismiss, "Esc"],
      ].map(([title, key]) => (
        <SettingRow key={title} title={title ?? ""}>
          <kbd>{key}</kbd>
        </SettingRow>
      ))}
      {shortcut && (
        <ShortcutDialog state={state} onClose={() => setShortcut(false)} />
      )}
    </>
  );
}
