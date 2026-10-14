import type { NextConfig } from "next";
/*
 * Two builds from one codebase:
 * - Local development (`pnpm dev` / `pnpm build`): normal Next.js server with
 *   the API route handlers in src/app/api, saving to a local SQLite file.
 * - Cloudflare (`pnpm pages:build`, STATIC_EXPORT=1): a static export of the
 *   pages only. Route handlers are .ts files, so limiting page extensions to
 *   .tsx/.jsx leaves them out; worker/index.ts serves the same API from D1.
 *   (Two extensions on purpose: Next 16.4 mishandles a one-item list.)
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const config: NextConfig = {
  ...(staticExport
    ? {
        output: "export",
        pageExtensions: ["tsx", "jsx"],
        images: { unoptimized: true },
      }
    : { serverExternalPackages: ["@libsql/client", "libsql"] }),
  devIndicators: false,
  poweredByHeader: false,
};
export default config;
