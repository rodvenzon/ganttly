/**
 * Cloudflare Pages "advanced mode" worker, built to out/_worker.js.
 * - /api/*         -> the app API on the D1 binding `DB`
 * - /projects/:id  -> the single prerendered project page (projects/_),
 *                     which reads the real id from the address bar
 * - everything else -> the static export
 */
import { handleApi } from "../src/server/api";
import type { SqlDb } from "../src/server/sql";
interface Env {
  DB: SqlDb;
  /** "1" serves the public demo: no sign-in, a private sandbox per browser. */
  DEMO_MODE?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
function withHeaders(res: Response) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB)
        return Response.json(
          {
            error:
              "Database not connected. Add a D1 binding named DB to this Pages project.",
          },
          { status: 503 },
        );
      return withHeaders(
        await handleApi(request, env.DB, {
          requireAccess: env.DEMO_MODE !== "1",
          demo: env.DEMO_MODE === "1",
        }),
      );
    }
    // /projects/<id>[.txt|/rest] -> /projects/_[.txt|/rest]
    const m = url.pathname.match(/^\/projects\/([^/.]+)(.*)$/);
    if (m && m[1] !== "_") {
      const asset = new URL(url);
      asset.pathname = `/projects/_${m[2]}`;
      const res = await env.ASSETS.fetch(new Request(asset, request));
      return withHeaders(res);
    }
    return withHeaders(await env.ASSETS.fetch(request));
  },
};
export default worker;
