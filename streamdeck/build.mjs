// Buduje bin/plugin.js (esbuild, z biblioteką ws w środku) i paczkę .streamDeckPlugin (Elgato CLI).
// Użycie: npm i ws esbuild @elgato/cli && node build.mjs
import { build } from "esbuild";
await build({ entryPoints: ["src/plugin.js"], bundle: true, platform: "node", target: "node20", format: "cjs",
  outfile: "com.vipersq.kronos7.sdPlugin/bin/plugin.js", external: ["bufferutil", "utf-8-validate"], legalComments: "inline" });
console.log("bin/plugin.js gotowy");
