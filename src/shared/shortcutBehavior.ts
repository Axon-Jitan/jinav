// Decides whether a repeated inactive-menu shortcut should dismiss the menu.
export function shortcutClosesMenu(
  style: "toggle" | "open",
  visible: boolean,
  mode: string,
) {
  return visible && mode === "menu" && style === "toggle";
}
