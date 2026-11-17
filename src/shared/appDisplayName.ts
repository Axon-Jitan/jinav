// Gives known executable fallback labels their familiar application names.
const names: Readonly<Record<string, string>> = {
  explorer: "File Explorer",
  chrome: "Google Chrome",
  msedge: "Microsoft Edge",
  notepad: "Notepad",
  mspaint: "Paint",
  calc: "Calculator",
  winword: "Microsoft Word",
  powerpnt: "Microsoft PowerPoint",
  excel: "Microsoft Excel",
  outlook: "Microsoft Outlook",
};
export function appDisplayName(name: string) {
  return names[name.toLowerCase()] ?? name;
}
