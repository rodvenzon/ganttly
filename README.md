# Ganttly

A drag-and-drop Gantt planner: one timeline per project, dependencies that reschedule themselves, task details, comments and an Excel report. Built as a vibe-coded take on TeamGantt.

The hosted version runs as a **public demo**: no sign-up, and every browser gets its own private sandbox seeded with a sample project.

## Run locally

Install Node.js 22+ and pnpm, then run from this folder:

```sh
pnpm i && pnpm db:seed && pnpm dev
```

Open **http://127.0.0.1:3000**. The seed command creates `.env`, a local SQLite database in `data/`, and a sample project with 4 phases, 40 tasks, 10 dependencies and 5 people. Locally every request acts as the workspace admin. Add `DEMO_MODE=1` to `.env` to run the public demo instead.

## Use the planner

- Open a project. Switch between day, week, and month zoom.
- Drag a bar to move dates; drag its edges to resize.
- Drag a connector dot onto another bar to link a successor. Dates cascade forward, preserving duration. Circular links are rejected.
- Drag a left-side grip to reorder a task. Drop on a phase heading to append to that phase.
- Drag across an unscheduled task row to set its dates. Escape cancels a gesture.
- Click a bar or task name to open details. Double-click a name, or press F2, to rename inline.
- Use **Add work** for tasks, milestones, and phases.
- Save task dates, progress, color, and multiple assignees in the drawer. Add dependencies and comments there too.
- Create, rename, archive, and restore projects from the project list.

Task dates are inclusive calendar dates. A finish-to-start successor starts no earlier than the day after its predecessor ends. Moving a predecessor earlier never pulls successors earlier automatically.

## Two editions, one codebase

|               | Public demo (`DEMO_MODE=1`)                                                             | Team workspace (default)                                      |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Sign-in       | None                                                                                    | Cloudflare Access in front of the site                        |
| Who sees what | Each browser sees only its own projects (a random visitor cookie)                       | Everyone enrolled sees every project                          |
| People        | A shared sample team; edits are credited to "Guest"                                     | People page: the super admin enrols, edits and removes people |
| Limits        | 5 projects per visitor; 200 tasks, 30 phases, 300 links, 300 comments per project       | None                                                          |
| Clean-up      | Visitor projects are deleted 3 days after they were created; **Reset demo** starts over | None                                                          |

Demo rules live in `src/server/demo.ts`; expired sandboxes are swept lazily, at most once an hour, by ordinary requests, so no cron job is needed.

In the team edition the super admin record starts without an email and is bound once with `POST /api/admin/claim` while signed in through Access. Set `ALLOWED_EMAIL_DOMAIN` in `src/lib/types.ts` to restrict enrolment to one company domain.

## Stack and folders

| Area        | Implementation                                                    |
| ----------- | ----------------------------------------------------------------- |
| App and API | Next.js 16 App Router, strict TypeScript                          |
| UI          | React, Tailwind theme tokens, inline SVG logo                     |
| Timeline    | Custom SVG, virtual rows and date columns, dnd-kit                |
| Dates       | date-fns, ISO date-only strings                                   |
| State       | Zustand interaction state, TanStack Query optimistic server cache |
| Data        | Plain SQL on Cloudflare D1; a local SQLite file in development    |
| Cloudflare  | Pages: static export + `_worker.js` API, D1 binding `DB`          |
| Tests       | Vitest, temporary real SQLite databases, HTTP smoke script        |

```text
src/app                 Thin pages and API routes
src/components/gantt    Timeline, shared viewport, gestures, SVG arrows
src/components/tasks    Task drawer sections
src/components/projects Project list and workspace
src/components/ui       Reusable primitives
src/lib/scheduling      Pure date, geometry, graph and cascade functions
src/lib/api             Typed commands, optimistic cache and HTTP client
src/server              Identity, SQL schema/migrations, reads, atomic writes, API router
worker/index.ts         Cloudflare Pages worker: API on D1 + project routing
seed.ts                 Idempotent demo seed
tests                   Scheduling, commands, HTTP boundaries, persistence
scripts                 Setup, API verification and the Cloudflare Pages build
```

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

With the local server running in another terminal:

```sh
pnpm test:api
```

The API check creates an isolated verification project, tests edits and conflicts, then removes only that project. Keep `API_URL` and `.env` pointed at the same local instance.

## Deploy to Cloudflare (Pages + D1)

The app is built as static pages plus one worker (`_worker.js`) that serves the API from a D1 database.

```sh
pnpm pages:build     # -> out/ and ganttly-pages.zip
pnpm pages:dev       # optional: that exact build on simulated D1 at :8788
```

One-time setup:

1. Create a D1 database (e.g. `ganttly-db`). Leave it empty: tables are created on the first request, and later schema changes in `MIGRATIONS` (`src/server/schema.ts`) apply themselves the same way.
2. Create a Pages project, then Settings -> Bindings -> add a **D1 database** binding named `DB`.
3. For the public demo, add the environment variable `DEMO_MODE` = `1`. Leave it out (and put Cloudflare Access in front) for a private team workspace.

To publish: Workers & Pages -> your project -> Create deployment -> upload `ganttly-pages.zip`, or run `wrangler pages deploy out`.

Each save is a single D1 batch guarded by `Project.revision`: if someone else saved in between, nothing is written and the client reloads the latest plan. See `src/server/mutate.ts`.
