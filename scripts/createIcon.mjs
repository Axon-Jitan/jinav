// Generates the application's geometric PNG tray asset without external image dependencies.
import { deflateSync } from "node:zlib";
import { writeFile, mkdir } from "node:fs/promises";
const size = 32;
const raw = Buffer.alloc(size * (1 + size * 4));
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const dots = [
      [16, 7],
      [7, 22],
      [25, 22],
    ];
    const dot = dots.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= 12);
    const inside = (x - 16) ** 2 + (y - 16) ** 2 < 245;
    raw.set(
      dot ? [184, 243, 209, 255] : inside ? [32, 59, 67, 255] : [0, 0, 0, 0],
      i,
    );
  }
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, bytes) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, bytes])));
  return Buffer.concat([length, type, bytes, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
await mkdir("resources", { recursive: true });
await writeFile(
  "resources/icon.png",
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
