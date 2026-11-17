// Renders persisted visual preferences; does not perform native window operations.
import type { SettingsState } from "./useSettings";
import { SettingRow } from "./SettingRow";
import { strings as s } from "./strings";
export function AppearanceSettings({ state }: { state: SettingsState }) {
  const fields = [
    [
      "iconSize",
      s.iconSize,
      [
        ["small", s.smallIcons],
        ["medium", s.compactIcons],
        ["large", s.largeIcons],
      ],
    ],
    [
      "menuBackground",
      s.background,
      [
        ["none", s.noBackground],
        ["soft", s.softBackground],
        ["solid", s.solidBackground],
      ],
    ],
    [
      "appNames",
      s.appNames,
      [
        ["hover", s.hoverNames],
        ["hidden", s.hideNames],
      ],
    ],
    [
      "labelPosition",
      s.labelPosition,
      [
        ["auto", s.besideIcon],
        ["top", s.aboveMenu],
        ["bottom", s.belowMenu],
      ],
    ],
    [
      "theme",
      s.theme,
      [
        ["light", s.lightTheme],
        ["dark", s.darkTheme],
        ["system", s.system],
      ],
    ],
  ] as const;
  return (
    <>
      {fields.map(([key, label, options]) => (
        <SettingRow key={key} title={label}>
          <select
            aria-label={label}
            value={state.config[key]}
            disabled={state.busy}
            onChange={(event) =>
              void state.update({ [key]: event.target.value })
            }
          >
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </SettingRow>
      ))}
    </>
  );
}
