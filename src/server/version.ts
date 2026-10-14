/**
 * The version string the client echoes back on every save. It is derived
 * from the project's saved revision, which each successful save increments,
 * so any save since the client last loaded makes its version stale.
 * Uses Web Crypto so the same code runs in Node and on Cloudflare.
 */
export async function versionFor(projectId: string, revision: number) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${projectId}:${revision}`),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
