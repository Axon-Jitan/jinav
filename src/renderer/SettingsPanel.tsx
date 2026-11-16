// Renders launcher configuration with optional computer-use settings.
import type { Bootstrap } from "../shared/bridge";
import { strings as s } from "./strings";
import { useSettings } from "./useSettings";
export function SettingsPanel({
  bootstrap,
  onSaved,
  onError,
}: {
  bootstrap: Bootstrap;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const state = useSettings(bootstrap.config, onSaved, onError);
  const c = state.config;
  return (
    <section className="panel settings">
      <p className="eyebrow">{bootstrap.platform}</p>
      <h1>{s.settings}</h1>
      {bootstrap.notice && <p role="status">{bootstrap.notice}</p>}
      <h2>{s.apps}</h2>
      <p className="hint">{s.appHint}</p>
      <ol className="selected-apps">
        {c.apps.map((entry, index) => (
          <li key={entry.id}>
            <span>
              {entry.icon && <img src={entry.icon} alt="" />}
              {entry.name}
            </span>
            <button
              disabled={index === 0}
              onClick={() => state.move(index, -1)}
              aria-label={`${s.up}: ${entry.name}`}
            >
              ↑
            </button>
            <button
              disabled={index === c.apps.length - 1}
              onClick={() => state.move(index, 1)}
              aria-label={`${s.down}: ${entry.name}`}
            >
              ↓
            </button>
            <button
              onClick={() =>
                state.change(
                  "apps",
                  c.apps.filter((e) => e.id !== entry.id),
                )
              }
              aria-label={`${s.remove}: ${entry.name}`}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="row">
        <button disabled={state.busy} onClick={() => void state.discover()}>
          {state.busy ? s.loading : s.discover}
        </button>
        <button onClick={() => void state.manual()}>{s.manual}</button>
      </div>
      {state.catalogue.length > 0 && (
        <>
          <input
            aria-label={s.search}
            placeholder={s.search}
            value={state.search}
            onChange={(e) => state.setSearch(e.target.value)}
          />
          <div className="catalogue">
            {state.catalogue
              .filter((e) =>
                e.name.toLowerCase().includes(state.search.toLowerCase()),
              )
              .map((entry) => (
                <button
                  key={entry.id}
                  disabled={
                    c.apps.length >= 6 || c.apps.some((e) => e.id === entry.id)
                  }
                  onClick={() => state.add(entry)}
                >
                  {entry.name}
                </button>
              ))}
          </div>
        </>
      )}
      <h2>{s.preferences}</h2>
      <label>
        {s.shortcut}
        <input
          value={c.shortcut}
          onChange={(e) => state.change("shortcut", e.target.value)}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={c.launchOnLogin}
          onChange={(e) => state.change("launchOnLogin", e.target.checked)}
        />
        {s.login}
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={c.reducedMotion}
          onChange={(e) => state.change("reducedMotion", e.target.checked)}
        />
        {s.motion}
      </label>
      <h2>{s.ai}</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={c.aiEnabled}
          onChange={(e) => state.change("aiEnabled", e.target.checked)}
        />
        {s.enable}
      </label>
      <p className="hint">{s.cloud}</p>
      <label className="check">
        <input
          type="checkbox"
          checked={c.cloudConsent}
          onChange={(e) => state.change("cloudConsent", e.target.checked)}
        />
        {s.consent}
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={c.physicalInput}
          onChange={(e) => state.change("physicalInput", e.target.checked)}
        />
        {s.physical}
      </label>
      <p className="hint">{s.physicalHint}</p>
      <p className="hint">{s.review}</p>
      <label>
        {s.model}
        <input
          value={c.model}
          onChange={(e) => state.change("model", e.target.value)}
        />
      </label>
      <label>
        {s.endpoint}
        <input
          value={c.endpoint}
          onChange={(e) => state.change("endpoint", e.target.value)}
        />
      </label>
      <label>
        {s.key}
        <input
          type="password"
          autoComplete="off"
          value={state.key}
          onChange={(e) => state.setKey(e.target.value)}
        />
      </label>
      <p className="hint">
        {bootstrap.credential}. {s.keyHint}
      </p>
      <button onClick={() => void state.saveKey()}>{s.saveKey}</button>
      <div className="limits">
        {(
          [
            ["maxSteps", s.steps],
            ["maxSeconds", s.seconds],
            ["maxTokens", s.tokens],
          ] as const
        ).map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              type="number"
              value={c[name]}
              onChange={(e) => state.change(name, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <p className="hint">{s.privacy}</p>
      <div className="row">
        <button disabled={state.busy} onClick={() => void state.check("model")}>
          {s.connection}
        </button>
        <button
          disabled={state.busy}
          onClick={() => void state.check("driver")}
        >
          {s.status}
        </button>
        <button onClick={() => void state.check("clear")}>{s.clear}</button>
      </div>
      <p role="status" className="message">
        {state.message}
      </p>
      <div className="save-bar">
        <button className="primary" onClick={() => void state.save()}>
          {s.save}
        </button>
      </div>
    </section>
  );
}
