// Lays out one labelled preference with its accessible control.
import type { ReactNode } from "react";
export function SettingRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <div className="row-title">{title}</div>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}
