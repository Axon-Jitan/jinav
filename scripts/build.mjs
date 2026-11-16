// Compiles desktop entry points; does not start the application.
import { build } from "esbuild";
import { build as viteBuild } from "vite";
await build({
  entryPoints: [
    "src/main/main.ts",
    "src/preload/preload.ts",
    "src/tasks/worker.ts",
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  outbase: "src",
  outdir: "dist",
  external: ["electron"],
  sourcemap: true,
});
await viteBuild();
