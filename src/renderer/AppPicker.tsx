// Presents installed-app selection without exposing OS implementation details.
import { useEffect, useRef } from "react";
import type { AppEntry } from "../shared/config";
import { strings as s } from "./strings";
import { useAppPicker } from "./useAppPicker";
import { appDisplayName } from "../shared/appDisplayName";
export function AppPicker({
  selected,
  purpose = "launcher",
  onConfirm,
  onClose,
  onError,
}: {
  selected: readonly AppEntry[];
  purpose?: "launcher" | "permissions";
  onConfirm: (apps: AppEntry[]) => Promise<boolean>;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const state = useAppPicker(selected, onError);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="app-picker"
      aria-labelledby="picker-title"
      aria-describedby="picker-description"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!state.saving) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (!state.saving) onClose();
        }
      }}
    >
      <header className="picker-header">
        <div>
          <h2 id="picker-title">
            {purpose === "launcher" ? s.pickerTitle : s.allowedApps}
          </h2>
          <p id="picker-description" className="hint">
            {purpose === "launcher" ? s.pickerDescription : s.pickerPermission}
          </p>
        </div>
        <button
          className="picker-close"
          aria-label={s.close}
          disabled={state.saving}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="picker-search">
        <span aria-hidden="true">⌕</span>
        <input
          ref={search}
          autoFocus
          aria-label={s.search}
          placeholder={s.pickerSearch}
          value={state.query}
          onChange={(e) => state.setQuery(e.target.value)}
        />
        {state.query && (
          <button
            aria-label={s.clearSearch}
            onClick={() => {
              state.setQuery("");
              search.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      <div className="picker-selection" aria-label={s.selectedApps}>
        {state.staged.length === 0 ? (
          <span className="hint">{s.pickerSelectHint}</span>
        ) : (
          state.staged.map((entry) => (
            <button
              className="picker-chip"
              key={entry.id}
              disabled={state.saving}
              aria-label={`${s.remove} ${appDisplayName(entry.name)}`}
              onClick={() => state.toggle(entry)}
            >
              {entry.icon && <img src={entry.icon} alt="" />}
              <span>{appDisplayName(entry.name)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))
        )}
      </div>
      <div className="picker-list-heading">
        <button
          className="text-button"
          disabled={state.loading || state.saving || !state.entries.length}
          onClick={state.selectShown}
        >
          {state.allShownSelected ? s.deselectShown : s.selectShown}
        </button>
        <span>
          {state.query.trim()
            ? s.searchResults
            : state.showUtilities
              ? s.allInstalledApps
              : s.installedApps}
        </span>
        <span>{state.entries.length}</span>
      </div>
      <div className="picker-list" aria-busy={state.loading}>
        {state.loading ? (
          <p className="picker-empty hint">{s.findingApps}</p>
        ) : (
          state.entries.map((entry) => {
            const checked = state.staged.some((app) => app.id === entry.id);
            return (
              <label
                key={entry.id}
                className={`picker-row ${checked ? "is-selected" : ""}`}
              >
                <span className="small-icon">
                  {entry.icon ? (
                    <img src={entry.icon} alt="" />
                  ) : (
                    entry.name.slice(0, 1)
                  )}
                </span>
                <span>{entry.name}</span>
                <input
                  aria-label={entry.name}
                  type="checkbox"
                  checked={checked}
                  disabled={state.saving}
                  onChange={() => state.toggle(entry)}
                />
              </label>
            );
          })
        )}
        {!state.loading && state.entries.length === 0 && (
          <div className="picker-empty">
            <strong>{s.noResults}</strong>
            <p className="hint">{s.pickerEmptyHint}</p>
          </div>
        )}
      </div>
      <div className="picker-secondary">
        {!state.query.trim() &&
          (state.hiddenCount > 0 || state.showUtilities) && (
            <button
              className="text-button"
              onClick={() => state.setShowUtilities(!state.showUtilities)}
            >
              {state.showUtilities ? s.hideSystemTools : s.showSystemTools}
            </button>
          )}
        <button
          className="text-button"
          disabled={state.saving}
          onClick={() => void state.manual()}
        >
          {s.manualFile}
        </button>
      </div>
      <footer>
        <span className="hint" role="status">
          {state.staged.length} {s.selected}
        </span>
        <button disabled={state.saving} onClick={onClose}>
          {s.cancel}
        </button>
        <button
          className="primary"
          disabled={state.saving || !state.changed}
          onClick={() => {
            state.setSaving(true);
            void onConfirm(state.staged).then((ok) => {
              if (ok) onClose();
              else state.setSaving(false);
            });
          }}
        >
          {state.saving
            ? s.savingApps
            : purpose === "launcher" &&
                selected.length === 0 &&
                state.staged.length > 0
              ? `${s.addSelectedApps} (${state.staged.length})`
              : s.saveSelection}
        </button>
      </footer>
    </dialog>
  );
}
