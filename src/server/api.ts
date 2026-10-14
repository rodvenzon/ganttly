import { commandRequest } from "@/lib/api/commands";
import { getCurrentUser, listPeople, requireSuperAdmin } from "./auth";
import { body, response, ApiError } from "./http";
import { executeCommand } from "./mutate";
import { claimSuperAdmin, enrollPerson, updatePerson } from "./people";
import { createProject } from "./projects";
import {
  DEMO,
  GUEST,
  assertCanCreate,
  assertOwner,
  cleanupExpired,
  ensureVisitorDemo,
  resetVisitor,
  visitorKey,
} from "./demo";
import { listProjects, readProjectWithRevision } from "./read";
import { ensureSchema } from "./schema";
import type { SqlDb } from "./sql";
import { versionFor } from "./version";
/**
 * The whole HTTP API. The Cloudflare worker calls it with the D1 binding
 * and requireAccess; the Next.js route handlers call it with a local SQLite
 * file in development.
 *
 *   GET  /api/me                       the signed-in person
 *   POST /api/admin/claim              one-time: bind super admin to my email
 *   GET  /api/people                   directory           (super admin)
 *   POST /api/people                   enroll someone      (super admin)
 *   POST /api/people/:id               edit / remove access (super admin)
 *   GET  /api/projects                 list
 *   POST /api/projects                 create
 *   GET  /api/projects/:id             one project + version
 *   POST /api/projects/:id/commands    apply one edit
 *
 * With demo set there is no sign-in or people directory: every browser is
 * a guest with its own projects (see demo.ts), plus POST /api/demo/reset.
 */
export async function handleApi(
  request: Request,
  db: SqlDb,
  { requireAccess = false, demo = false } = {},
) {
  if (demo) {
    const visitor = visitorKey(request);
    const res = await handleDemo(request, db, visitor.key);
    if (visitor.setCookie) res.headers.append("Set-Cookie", visitor.setCookie);
    return res;
  }
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const [, resource, rawId, action] = parts;
  const id = rawId ? decodeURIComponent(rawId) : undefined;
  const method = request.method;
  return response(async () => {
    if (parts[0] !== "api" || parts.length > 4)
      throw new ApiError("Not found", 404);
    await ensureSchema(db);
    if (resource === "admin" && rawId === "claim" && method === "POST") {
      return { user: await claimSuperAdmin(db, request) };
    }
    const user = await getCurrentUser(db, request, { requireAccess });
    if (resource === "me" && !id && method === "GET") return { user };
    if (resource === "people" && !action) {
      if (!id && method === "GET") {
        requireSuperAdmin(user);
        return listPeople(db);
      }
      if (!id && method === "POST")
        return enrollPerson(db, user, await body(request));
      if (id && method === "POST")
        return updatePerson(db, user, id, await body(request));
      throw new ApiError("Method not allowed", 405);
    }
    if (resource !== "projects") throw new ApiError("Not found", 404);
    if (!id) {
      if (method === "GET") return listProjects(db);
      if (method === "POST") return createProject(db, await body(request));
    } else if (!action && method === "GET") {
      const { project, revision } = await readProjectWithRevision(db, id);
      return { project, version: await versionFor(id, revision) };
    } else if (action === "commands" && method === "POST") {
      const { baseVersion, command } = commandRequest.parse(
        await body(request),
      );
      return executeCommand(db, id, baseVersion, command, user);
    } else if (action) throw new ApiError("Not found", 404);
    throw new ApiError("Method not allowed", 405);
  });
}

async function handleDemo(request: Request, db: SqlDb, owner: string) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const [, resource, rawId, action] = parts;
  const id = rawId ? decodeURIComponent(rawId) : undefined;
  const method = request.method;
  return response(async () => {
    if (parts[0] !== "api" || parts.length > 4)
      throw new ApiError("Not found", 404);
    await ensureSchema(db, { seed: false });
    await cleanupExpired(db);
    if (resource === "me" && !id && method === "GET")
      return { user: GUEST, demo: { ttlDays: DEMO.ttlDays } };
    if (resource === "demo" && rawId === "reset" && !action) {
      if (method !== "POST") throw new ApiError("Method not allowed", 405);
      await body(request); // same-origin + JSON checks
      await resetVisitor(db, owner);
      return { ok: true };
    }
    if (resource !== "projects") throw new ApiError("Not found", 404);
    if (!id) {
      if (method === "GET") {
        await ensureVisitorDemo(db, owner);
        return listProjects(db, owner);
      }
      if (method === "POST") {
        const input = await body(request);
        await assertCanCreate(db, owner);
        return createProject(db, input, owner);
      }
      throw new ApiError("Method not allowed", 405);
    }
    if (action && action !== "commands") throw new ApiError("Not found", 404);
    await assertOwner(db, id, owner);
    if (!action && method === "GET") {
      const { project, revision } = await readProjectWithRevision(db, id);
      return { project, version: await versionFor(id, revision) };
    }
    if (action === "commands" && method === "POST") {
      const { baseVersion, command } = commandRequest.parse(
        await body(request),
      );
      return executeCommand(db, id, baseVersion, command, GUEST, {
        limits: DEMO.limits,
      });
    }
    throw new ApiError("Method not allowed", 405);
  });
}
