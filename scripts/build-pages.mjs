import { spawnSync } from "node:child_process";
import { rm, writeFile, readdir, stat } from "node:fs/promises";
import { build } from "esbuild";
/*
 * Builds the Cloudflare Pages upload in ./out:
 *   1. a static export of the pages (STATIC_EXPORT=1, see next.config.ts)
 *   2. out/_worker.js, the API + routing worker (worker/index.ts)
 *   3. ganttly-pages.zip, ready for the dashboard's direct upload
 */
const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
await rm("out", { recursive: true, force: true });
run("pnpm", ["exec", "next", "build", "--webpack"], {
  STATIC_EXPORT: "1",
  NEXT_TELEMETRY_DISABLED: "1",
});
await build({
  entryPoints: ["worker/index.ts"],
  outfile: "out/_worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  conditions: ["worker", "browser"],
  alias: { "@": "./src" },
  logLevel: "warning",
});
// Pages serves this file as headers for static assets; the worker adds its
// own security headers to every response.
await writeFile(
  "out/_headers",
  "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n",
);
let files = 0;
async function count(dir) {
  for (const name of await readdir(dir)) {
    const p = `${dir}/${name}`;
    if ((await stat(p)).isDirectory()) await count(p);
    else files++;
  }
}
await count("out");
await rm("ganttly-pages.zip", { force: true });
run("bash", ["-c", "cd out && zip -qr ../ganttly-pages.zip ."]);
console.log(`Pages bundle ready: out/ (${files} files) and ganttly-pages.zip`);
