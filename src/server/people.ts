import { z } from "zod";
import { ALLOWED_EMAIL_DOMAIN, COLOR_KEYS, type Person } from "@/lib/types";
import { accessEmail, findPerson, listPeople, requireSuperAdmin } from "./auth";
import { ApiError } from "./http";
import type { SqlDb } from "./sql";
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .refine(
    (e) => !ALLOWED_EMAIL_DOMAIN || e.endsWith("@" + ALLOWED_EMAIL_DOMAIN),
    `Use an @${ALLOWED_EMAIL_DOMAIN} address; only those can sign in.`,
  );
const name = z.string().trim().min(1, "Enter a name.").max(80);
const title = z.string().trim().max(80);
export const enrollSchema = z.object({ name, title, email }).strict();
export const updatePersonSchema = z
  .object({
    name: name.optional(),
    title: title.optional(),
    email: email.nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();
function friendly(error: unknown): never {
  if (error instanceof z.ZodError)
    throw new ApiError(error.issues[0]?.message ?? "Check the fields.", 400);
  if (error instanceof Error && /UNIQUE|constraint/i.test(error.message))
    throw new ApiError("Someone is already enrolled with that email.", 409);
  throw error;
}
export async function enrollPerson(db: SqlDb, user: Person, input: unknown) {
  requireSuperAdmin(user);
  let data;
  try {
    data = enrollSchema.parse(input);
  } catch (e) {
    friendly(e);
  }
  const count = (await listPeople(db)).length;
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO Assignee (id, name, avatarColor, title, email, role, active)
         VALUES (?, ?, ?, ?, ?, 'member', 1)`,
      )
      .bind(
        id,
        data.name,
        COLOR_KEYS[count % COLOR_KEYS.length],
        data.title,
        data.email,
      )
      .run();
  } catch (e) {
    friendly(e);
  }
  return findPerson(db, "id", id);
}
export async function updatePerson(
  db: SqlDb,
  user: Person,
  id: string,
  input: unknown,
) {
  requireSuperAdmin(user);
  let data;
  try {
    data = updatePersonSchema.parse(input);
  } catch (e) {
    friendly(e);
  }
  const person = await findPerson(db, "id", id);
  if (!person) throw new ApiError("Person not found", 404);
  if (
    person.id === user.id &&
    (data.active === false || data.email !== undefined)
  )
    throw new ApiError(
      "You can't remove your own access or change your own sign-in email.",
      400,
    );
  const next = { ...person, ...data };
  try {
    await db
      .prepare(
        "UPDATE Assignee SET name = ?, title = ?, email = ?, active = ? WHERE id = ?",
      )
      .bind(next.name, next.title, next.email, next.active ? 1 : 0, id)
      .run();
  } catch (e) {
    friendly(e);
  }
  return findPerson(db, "id", id);
}
/**
 * One-time setup: binds the signed-in Access email to the super admin
 * record, which starts without an email. Refused once it is set.
 */
export async function claimSuperAdmin(db: SqlDb, request: Request) {
  const signedIn = accessEmail(request);
  if (!signedIn)
    throw new ApiError("Sign in through Cloudflare Access first.", 401);
  const admin = (await listPeople(db)).find((p) => p.role === "super_admin");
  if (!admin) throw new ApiError("No super admin record exists.", 500);
  if (admin.email)
    throw new ApiError("The super admin has already been set up.", 409);
  await db
    .prepare(
      "UPDATE Assignee SET email = ? WHERE id = ? AND role = 'super_admin' AND email IS NULL",
    )
    .bind(signedIn, admin.id)
    .run();
  return findPerson(db, "id", admin.id);
}
