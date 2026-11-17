// Converts the supplied vector into PNG, Windows ICO and macOS ICNS resources.
const { app, BrowserWindow, nativeImage } = require("electron");
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
app.disableHardwareAcceleration();
app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      width: 256,
      height: 256,
      show: false,
      transparent: true,
      frame: false,
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const svg = readFileSync(resolve("resources/jinav-logo.svg")).toString(
      "base64",
    );
    await window.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>html,body{margin:0;background:transparent}img{display:block;width:1024px;height:1024px}</style><img src="data:image/svg+xml;base64,${svg}">`,
        ),
    );
    await window.webContents.executeJavaScript(
      "document.querySelector('img').decode()",
    );
    const image = nativeImage.createFromDataURL(
      await window.webContents.executeJavaScript(
        "(()=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;canvas.getContext('2d').drawImage(document.querySelector('img'),0,0,1024,1024);return canvas.toDataURL('image/png');})()",
      ),
    );
    const png = (size) =>
      image.resize({ width: size, height: size, quality: "best" }).toPNG();
    writeFileSync(resolve("resources/icon.png"), png(512));
    const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256],
      header = Buffer.alloc(6 + sizes.length * 16),
      images = [];
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    sizes.forEach((size, index) => {
      // Windows' small-icon loaders need DIB frames; retain PNG only at 256px.
      const resized = image.resize({
        width: size,
        height: size,
        quality: "best",
      });
      let bytes = resized.toPNG();
      if (size < 256) {
        const pixels = resized.toBitmap(),
          maskStride = Math.ceil(size / 32) * 4;
        bytes = Buffer.alloc(40 + size * size * 4 + maskStride * size);
        bytes.writeUInt32LE(40, 0);
        bytes.writeInt32LE(size, 4);
        bytes.writeInt32LE(size * 2, 8);
        bytes.writeUInt16LE(1, 12);
        bytes.writeUInt16LE(32, 14);
        bytes.writeUInt32LE(size * size * 4 + maskStride * size, 20);
        for (let y = 0; y < size; y++) {
          pixels.copy(
            bytes,
            40 + (size - y - 1) * size * 4,
            y * size * 4,
            (y + 1) * size * 4,
          );
        }
      }
      const p = 6 + index * 16;
      header[p] = size === 256 ? 0 : size;
      header[p + 1] = size === 256 ? 0 : size;
      header.writeUInt16LE(1, p + 4);
      header.writeUInt16LE(32, p + 6);
      header.writeUInt32LE(bytes.length, p + 8);
      header.writeUInt32LE(offset, p + 12);
      offset += bytes.length;
      images.push(bytes);
    });
    writeFileSync(
      resolve("resources/icon.ico"),
      Buffer.concat([header, ...images]),
    );
    const chunks = [
      ["icp4", 16],
      ["icp5", 32],
      ["icp6", 64],
      ["ic07", 128],
      ["ic08", 256],
      ["ic09", 512],
      ["ic10", 1024],
    ].map(([type, size]) => {
      const bytes = png(size),
        chunk = Buffer.alloc(8);
      chunk.write(type);
      chunk.writeUInt32BE(bytes.length + 8, 4);
      return Buffer.concat([chunk, bytes]);
    });
    const icns = Buffer.alloc(8);
    icns.write("icns");
    icns.writeUInt32BE(8 + chunks.reduce((sum, c) => sum + c.length, 0), 4);
    writeFileSync(
      resolve("resources/icon.icns"),
      Buffer.concat([icns, ...chunks]),
    );
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    process.stderr.write(error.message);
    app.exit(1);
  });
