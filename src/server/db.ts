import type { SqlDb } from "./sql";
import { localDb } from "./sql-local";
// Local development only. Production uses the D1 binding (see worker/index.ts).
const globalDb = globalThis as typeof globalThis & { ganttlyDb?: SqlDb };
export function getDb() {
  return (globalDb.ganttlyDb ??= localDb());
}
/** Local route handler; DEMO_MODE=1 runs the public demo locally too. */
export const localHandler = async (request: Request) => {
  const { handleApi } = await import("./api");
  return handleApi(request, getDb(), { demo: process.env.DEMO_MODE === "1" });
};
