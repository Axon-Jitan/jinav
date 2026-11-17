// Checks the native icon of only the test-owned jinav window, without thumbnails.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const profile = await mkdtemp(join(tmpdir(), "jinav-icon-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
let desktop;
try {
  desktop = await _electron.launch({
    executablePath: resolve("out/jinav-win32-x64/jinav.exe"),
    args: ["--settings", `--user-data-dir=${profile}`],
    env,
  });
  await desktop.firstWindow();
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(
          (w) =>
            w.webContents.getURL().includes("view=settings") && w.isVisible(),
        ),
      ),
    )
    .toBe(true);
  const icons = await desktop.evaluate(
    async ({ BrowserWindow, desktopCapturer, nativeImage }, expectedPath) => {
      const ownWindow = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("view=settings"),
      );
      const sources = await desktopCapturer.getSources({
        types: ["window"],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: true,
      });
      const icon = sources.find(
        (source) => source.id === ownWindow.getMediaSourceId(),
      )?.appIcon;
      if (!icon || icon.isEmpty())
        throw Error("Windows did not return jinav's native window icon");
      const result = {};
      {
        const normalize = (image) =>
          nativeImage
            .createFromBuffer(image.toPNG())
            .resize({ width: 32, height: 32 })
            .toBitmap();
        const actual = normalize(icon);
        const expected = normalize(nativeImage.createFromPath(expectedPath));
        let error = 0;
        for (let i = 0; i < actual.length; i++)
          error += Math.abs(actual[i] - expected[i]);
        result.window = {
          bytes: icon.toPNG().toString("base64"),
          meanError: error / actual.length,
        };
      }
      return result;
    },
    resolve("resources/icon.png"),
  );
  await mkdir("evidence/icons", { recursive: true });
  for (const [size, { bytes, meanError }] of Object.entries(icons)) {
    await writeFile(
      `evidence/icons/windows-${size}.png`,
      Buffer.from(bytes, "base64"),
    );
    if (!Number.isFinite(meanError) || meanError > 15)
      throw Error(
        `Windows ${size} icon differs from jinav logo (mean pixel error ${meanError.toFixed(2)})`,
      );
  }
  process.stdout.write(
    "Verified the packaged jinav window's native icon matches the supplied logo. No UI thumbnails captured.\n",
  );
} finally {
  if (desktop) await desktop.close();
  if (!profile.startsWith(join(tmpdir(), "jinav-icon-")))
    throw Error("Unexpected profile path");
  await rm(profile, { recursive: true, force: true });
}
