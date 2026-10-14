import { it, expect } from "vitest";
import { body, response, ApiError } from "@/server/http";
it("accepts same-origin JSON and rejects cross-origin, malformed, or oversized bodies", async () => {
  const req = (text: string, origin = "https://stride.example") =>
    new Request("https://stride.example/api/projects", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: text,
    });
  expect(await body(req('{"name":"Project"}'))).toEqual({ name: "Project" });
  await expect(body(req("{}", "https://other.example"))).rejects.toMatchObject({
    status: 403,
  });
  await expect(body(req("{"))).rejects.toMatchObject({ status: 400 });
  await expect(body(req("x".repeat(100001)))).rejects.toMatchObject({
    status: 413,
  });
});
it("returns an actionable conflict response without caching", async () => {
  const result = await response(async () => {
    throw new ApiError("Reload the latest plan", 409);
  });
  expect(result.status).toBe(409);
  expect(await result.json()).toEqual({ error: "Reload the latest plan" });
  expect(result.headers.get("cache-control")).toBe("no-store");
});

it("accepts the actual Host when Next normalizes the request URL", async () => {
  const request = new Request("http://localhost:3000/api/projects", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
    },
    body: "{}",
  });
  expect(await body(request)).toEqual({});
});
