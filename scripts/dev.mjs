import { spawnSync } from "node:child_process";
// Polling avoids per-file watcher exhaustion in restricted desktop workspaces.
const child = spawnSync(
  "pnpm",
  [
    "exec",
    "next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      WATCHPACK_POLLING: process.env.WATCHPACK_POLLING ?? "1000",
    },
  },
);
process.exit(child.status ?? 1);
