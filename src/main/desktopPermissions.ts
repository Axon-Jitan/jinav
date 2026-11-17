// Validates backend permission status without observing application content.
import { z } from "zod";
const status = z.object({
  ok: z.literal(true),
  data: z.object({
    permissions: z.object({
      accessibility: z.object({ state: z.string() }),
      automation: z.object({ state: z.string() }),
    }),
  }),
});
export function desktopPermissions(value: unknown) {
  const parsed = status.safeParse(value);
  if (
    !parsed.success ||
    !["granted", "not_required"].includes(
      parsed.data.data.permissions.accessibility.state,
    ) ||
    !["granted", "not_required"].includes(
      parsed.data.data.permissions.automation.state,
    )
  )
    throw Error(
      "Desktop permissions are unavailable. Check Accessibility consent for this jinav installation and the signed-in desktop session.",
    );
}
