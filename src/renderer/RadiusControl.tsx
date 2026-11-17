// Edits radial distance with a live draft and explicit gesture-end persistence.
import { MIN_WHEEL_RADIUS, MAX_WHEEL_RADIUS } from "../shared/wheelGeometry";
import { strings as s } from "./strings";
export function RadiusControl({
  value,
  disabled,
  onChange,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="radius-control">
      <div className="radius-heading">
        <label htmlFor="menu-radius">{s.menuRadius}</label>
        <output htmlFor="menu-radius">{value} px</output>
      </div>
      <p className="hint" id="radius-hint">
        {s.radiusHint}
      </p>
      <input
        id="menu-radius"
        type="range"
        min={MIN_WHEEL_RADIUS}
        max={MAX_WHEEL_RADIUS}
        step={2}
        value={value}
        disabled={disabled}
        aria-describedby="radius-hint"
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
      <div className="radius-endpoints">
        <span>{s.radiusClose}</span>
        <span>{s.radiusSpacious}</span>
      </div>
    </div>
  );
}
