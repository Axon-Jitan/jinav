// Captures the native compositor over a disposable two-colour test backdrop.
import { writeFile } from "node:fs/promises";
export async function captureWheel(desktop, path) {
  const png = await desktop.evaluate(
    async ({ BrowserWindow, screen, desktopCapturer }) => {
      const wheel = BrowserWindow.getAllWindows().find(
        (w) => !w.webContents.getURL().includes("view="),
      );
      if (!wheel?.isVisible()) throw Error("The real wheel must be visible");
      const b = wheel.getBounds(),
        display = screen.getDisplayMatching(b),
        scale = display.scaleFactor;
      const backdrop = new BrowserWindow({
        x: b.x - 4,
        y: b.y - 4,
        width: b.width + 8,
        height: b.height + 8,
        frame: false,
        show: false,
        focusable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      try {
        await backdrop.loadURL(
          "data:text/html," +
            encodeURIComponent(
              '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><body style="margin:0;background:linear-gradient(90deg,#c5dded 50%,#f0d9bd 50%);height:100vh"></body>',
            ),
        );
        backdrop.showInactive();
        wheel.moveTop();
        wheel.focus();
        await new Promise((resolve) => setTimeout(resolve, 250));
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: {
            width: Math.round(display.size.width * scale),
            height: Math.round(display.size.height * scale),
          },
        });
        const source = sources.find((s) => s.display_id === String(display.id));
        if (!source) throw Error("No matching display capture");
        const actual = source.thumbnail.getSize(),
          sx = actual.width / display.size.width,
          sy = actual.height / display.size.height;
        return source.thumbnail
          .crop({
            x: Math.round((b.x - display.bounds.x) * sx),
            y: Math.round((b.y - display.bounds.y) * sy),
            width: Math.round(b.width * sx),
            height: Math.round(b.height * sy),
          })
          .toPNG()
          .toString("base64");
      } finally {
        backdrop.destroy();
      }
    },
  );
  await writeFile(path, Buffer.from(png, "base64"));
}
