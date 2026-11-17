// Normalizes explicit shortcut input; never observes keyboard activity itself.
const aliases: Record<string, string> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  cmd: "Command",
  command: "Command",
  meta: "Super",
  win: "Super",
  super: "Super",
  commandorcontrol: "CommandOrControl",
  cmdorctrl: "CommandOrControl",
};
const order = ["CommandOrControl", "Ctrl", "Alt", "Shift", "Command", "Super"];
const keys = [
  "Space",
  "Enter",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Up",
  "Down",
  "Left",
  "Right",
  "Plus",
  "Minus",
  "Comma",
  "Period",
  "Slash",
  "Backslash",
  "Semicolon",
  "Quote",
  "Backquote",
  "BracketLeft",
  "BracketRight",
  "Equal",
];
export function shortcutInput(value: string): string | undefined {
  const parts = value.split("+").map((part) => part.trim());
  const last = parts.pop();
  if (!last || parts.length === 0) return;
  const modifiers = parts.map((part) => aliases[part.toLowerCase()]);
  if (
    modifiers.some((part) => !part) ||
    new Set(modifiers).size !== modifiers.length
  )
    return;
  const name = last.replace(/^Arrow/i, "");
  const key =
    /^[a-z0-9]$/i.test(name) || /^F([1-9]|1[0-9]|2[0-4])$/i.test(name)
      ? name.toUpperCase()
      : keys.find((key) => key.toLowerCase() === name.toLowerCase());
  if (!key) return;
  return [
    ...order.filter((modifier) => modifiers.includes(modifier)),
    key,
  ].join("+");
}
export function shortcutFromKey(event: {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}): string | undefined {
  if (
    event.repeat ||
    ["Control", "Alt", "Shift", "Meta", "AltGraph", "Escape", "Tab"].includes(
      event.key,
    )
  )
    return;
  const modifiers = [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    event.metaKey ? "Super" : "",
  ].filter(Boolean);
  const key =
    event.code === "Space" ? "Space" : event.key === "+" ? "Plus" : event.key;
  return shortcutInput([...modifiers, key].join("+"));
}
