import { copyFile, access, mkdir } from "node:fs/promises";
// Local development: create .env and the data/ folder for the SQLite file.
try {
  await access(".env");
} catch {
  await copyFile(".env.example", ".env");
}
await mkdir("data", { recursive: true });
