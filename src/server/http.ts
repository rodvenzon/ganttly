import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    /** Machine-readable reason the client can act on, e.g. NOT_ENROLLED. */
    public code?: string,
  ) {
    super(message);
  }
}
export async function response<T>(handler: () => Promise<T>) {
  try {
    return Response.json(await handler(), {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const status =
      e instanceof ApiError
        ? e.status
        : e instanceof ZodError
          ? 400
          : e instanceof Error && e.message === "Project not found"
            ? 404
            : 500;
    const message =
      e instanceof ApiError
        ? e.message
        : e instanceof ZodError
          ? "Check the submitted fields."
          : status === 404
            ? "Project not found"
            : "Unable to save or load this workspace. Please retry.";
    if (status === 500)
      console.error("Request failed", e instanceof Error ? e.name : "Unknown");
    const code = e instanceof ApiError ? e.code : undefined;
    return Response.json(code ? { error: message, code } : { error: message }, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const accepted = new Set([
    url.origin,
    ...(host ? [`${url.protocol}//${host}`] : []),
  ]);
  if (origin && !accepted.has(origin))
    throw new ApiError("Origin not allowed", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("Expected JSON", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Missing request body");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100000) {
        await reader.cancel();
        throw new ApiError("Request too large", 413);
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of parts) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ApiError("Invalid JSON");
  }
}
