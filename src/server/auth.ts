import type { Person } from "@/lib/types";
import { ApiError } from "./http";
import type { SqlDb } from "./sql";
type PersonRow = Omit<Person, "active"> & { active: number };
const COLUMNS = "id, name, avatarColor, title, email, role, active";
export const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  name: r.name,
  avatarColor: r.avatarColor,
  title: r.title,
  email: r.email,
  role: r.role,
  active: Boolean(r.active),
});
export async function listPeople(db: SqlDb) {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM Assignee
       ORDER BY active DESC, CASE role WHEN 'super_admin' THEN 0 ELSE 1 END, id`,
    )
    .all<PersonRow>();
  return results.map(toPerson);
}
export async function findPerson(
  db: SqlDb,
  where: "id" | "email",
  value: string,
) {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM Assignee WHERE ${where} = ?`)
    .bind(value)
    .first<PersonRow>();
  return row ? toPerson(row) : null;
}
/** The email Cloudflare Access signed this request in with, if any. */
export function accessEmail(request: Request) {
  return (
    request.headers
      .get("cf-access-authenticated-user-email")
      ?.trim()
      .toLowerCase() || null
  );
}
export const NOT_ENROLLED = "NOT_ENROLLED";
/**
 * Who is making this request.
 *
 * In production (requireAccess) Cloudflare Access has already limited
 * sign-in and adds the person's email header; here we also
 * require that email to belong to an active, enrolled person. Locally,
 * with no Access in front, requests act as the super admin.
 */
export async function getCurrentUser(
  db: SqlDb,
  request: Request,
  { requireAccess = false } = {},
): Promise<Person> {
  const email = accessEmail(request);
  if (!email) {
    if (requireAccess) throw new ApiError("Please sign in first.", 401);
    const admin = (await listPeople(db)).find((p) => p.role === "super_admin");
    if (!admin) throw new ApiError("No super admin is set up.", 500);
    return admin;
  }
  const person = await findPerson(db, "email", email);
  if (!person || !person.active)
    throw new ApiError(
      "You're signed in, but you haven't been added to this workspace yet. Ask your workspace admin to enroll you.",
      403,
      NOT_ENROLLED,
    );
  return person;
}
export function requireSuperAdmin(user: Person) {
  if (user.role !== "super_admin")
    throw new ApiError("Only the super admin can manage people.", 403);
}
