// Renders text received only from the validated native tooltip service.
import { useEffect, useState } from "react";
import type { TooltipContent } from "../shared/bridge";
export function Tooltip() {
  const [content, setContent] = useState<TooltipContent>({
    text: "",
    side: "top",
  });
  useEffect(() => window.jinav.onTooltip(setContent), []);
  return (
    <div className="tooltip-stage">
      <div className="native-tooltip" data-side={content.side}>
        <span>{content.text}</span>
      </div>
    </div>
  );
}
