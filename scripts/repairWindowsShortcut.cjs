// Repairs only jinav's Start-menu shortcut with a content-addressed icon.
// Does not clear Windows caches or change unrelated shortcuts.
const { app, shell } = require("electron");
const {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} = require("node:fs");
const { resolve, join } = require("node:path");
const { createHash } = require("node:crypto");
app.whenReady().then(() => {
  try {
    if (process.platform !== "win32") throw Error("Windows only");
    const root = resolve(__dirname, ".."),
      target = join(root, "out/jinav-win32-x64/jinav.exe"),
      link = join(
        app.getPath("appData"),
        "Microsoft/Windows/Start Menu/Programs/jinav.lnk",
      );
    if (!existsSync(target)) throw Error("Build the Windows package first");
    if (
      existsSync(link) &&
      shell.readShortcutLink(link).target.toLowerCase() !== target.toLowerCase()
    )
      throw Error(
        "Existing jinav shortcut targets another installation; left unchanged",
      );
    const bytes = readFileSync(join(root, "resources/icon.ico")),
      hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16),
      directory = join(app.getPath("appData"), "jinav/branding"),
      icon = join(directory, `jinav-${hash}.ico`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(icon, bytes);
    const options = {
      target,
      args: "--settings",
      cwd: root,
      icon,
      iconIndex: 0,
      appUserModelId: "com.jinav.desktop",
      description: "Open jinav",
    };
    if (!shell.writeShortcutLink(link, "create", options))
      throw Error("Shortcut update failed");
    const actual = shell.readShortcutLink(link);
    if (
      actual.icon !== icon ||
      actual.appUserModelId !== options.appUserModelId
    )
      throw Error("Shortcut metadata verification failed");
    process.stdout.write(
      "Verified jinav shortcut with explicit, content-addressed logo icon.\n",
    );
    app.exit(0);
  } catch (error) {
    process.stderr.write(error.message + "\n");
    app.exit(1);
  }
});
