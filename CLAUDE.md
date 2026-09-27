# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> `AGENTS.md` is auto-written by `next dev` (see `node_modules/next/dist/docs/`). Don't hand-edit it; commit it with your work if it changes. It warns that this is **Next.js 16** with breaking changes vs. older versions — consult `node_modules/next/dist/docs/` before writing framework code.

## Project

Inventory / Request Management System: item requests, multi-level approval workflow, status tracking, and reporting (CSV/PDF). Next.js 16 App Router · React 19 · Tailwind v4 · PostgreSQL · Prisma 6. The full lifecycle is implemented: create/edit draft → submit → multi-level approve/reject → fulfil (decrements stock), plus an admin area for items, categories, users, and approval workflows, and five raw-SQL reports with CSV/PDF export.

## Commands

```bash
npm run dev            # Next dev server (Turbopack)
npm run build          # production build (also Turbopack in Next 16)
npm run lint           # eslint
npx tsc --noEmit       # typecheck (no dedicated script)
npx next typegen       # regenerate PageProps/LayoutProps/RouteContext globals if stale

npm run db:migrate     # prisma migrate dev  — create + apply a migration
npm run db:deploy      # prisma migrate deploy — apply migrations (prod/CI)
npm run db:seed        # reset + reseed demo data (tsx prisma/seed.ts)
npm run db:reset       # drop → migrate → seed
npm run db:studio      # Prisma Studio GUI
npm run db:generate    # regenerate the client (also runs on postinstall)
```

No test runner is configured. `.env` needs `DATABASE_URL` and `SESSION_SECRET` (≥16 chars, or `lib/session-token.ts` throws at import). Demo accounts after seeding use password `password123` (`admin@mayora.test`, `direktur@…`, `finance@…`, `mgr.it@…`, `staff.it@…`).

## Architecture

### Prisma client lives at `lib/generated/prisma`

Custom generator output. **Import from `@/lib/generated/prisma`, never `@prisma/client`.** The folder is gitignored (rebuilt by `postinstall`) and excluded from `tsconfig.json` and `eslint.config.mjs`. `lib/prisma.ts` exports the singleton `prisma`.

### Auth is a hand-rolled signed-cookie session, split in two layers

- `lib/session-token.ts` — pure `jose` JWT encode/decode (HS256). **No `next/headers`, no `server-only`**, so `proxy.ts` can import it too. Owns `SESSION_COOKIE_NAME`, `TTL_DAYS`, `SessionPayload` (`{ userId, role }`).
- `lib/session.ts` — `server-only`; the `next/headers` cookie read/write (`createSession` / `readSessionCookie` / `destroySession`).
- `proxy.ts` — Next 16's renamed `middleware.ts`. Optimistic gate only: verifies the cookie signature (no DB), redirects unauthenticated → `/login?next=…` and authenticated-on-`/login` → `/dashboard`.
- `lib/dal.ts` — the real authorization boundary. `getCurrentUser` / `requireUser` / `requirePermission`, each wrapped in React `cache()`. Every protected server component, server action, and route handler must call one of these — the proxy is not sufficient.
- `lib/rbac.ts` — `Role` enum + `Permission` union + `MATRIX` + `can(role, permission)`. Check permissions here or in the DAL, not with ad-hoc role comparisons in components.

### Route groups

`app/(auth)/` = public (login). `app/(app)/` = protected; its `layout.tsx` calls `requireUser()`. Server Actions live in `app/actions/*.ts` with `"use server"` and re-verify auth themselves (`login`, `logout` in `app/actions/auth.ts`).

### Approval workflow model (the core domain concept)

`ApprovalWorkflow` + ordered `ApprovalStage` rows are a **template**, selected for a request by its `estimatedTotal` against `minAmount`/`maxAmount` (seed: Standar <10M → 1 stage, Menengah 10–50M → 2, Tinggi >50M → 3). On submit, the stages are copied into per-request `ApprovalStep` instances that carry the actual decisions. `RequestActivity` is the append-only audit trail powering status tracking. `RequestItem.name` is a snapshot so history survives catalog edits. `StockMovement` rows are written when a request is fulfilled.

**Server actions** (all re-check auth with `getCurrentUser` + `can(...)`, do writes in one `$transaction`, and redirect on completion — `useActionState` is only used where inline field errors matter, i.e. login and the request form):

- `app/actions/requests.ts` — `saveRequest` (create **or**, when `requestId` is present, update a DRAFT; `mode=submit` runs the submit path in the same transaction — on edit it `deleteMany`s the old `RequestItem`s and recreates them), `submitExistingRequest`, `cancelRequest`.
- `app/actions/approvals.ts` — `decideApproval` on the step at `request.currentStage`: approve advances `currentStage` to the next PENDING step (status IN_REVIEW) or closes APPROVED; reject closes REJECTED and SKIPs remaining steps. Approver check is `approverId === user.id` or, for an unassigned step, `approverRole === user.role`. Empty-note-on-reject is blocked *before* the transaction.
- `app/actions/fulfillment.ts` — `fulfillRequest`: APPROVED → FULFILLED, decrements `Item.stockQty` and writes an OUT `StockMovement` per catalogued line (aggregated by item), blocking on insufficient stock; free-text lines move no stock.
- `app/actions/admin.ts` — `saveItem` / `adjustStock` / `saveCategory` / `saveUser` / `resetUserPassword` / `saveWorkflow` / `addStage` / `deleteStage`. Shared helpers: `backWith(path, {ok|error})` redirects with a flash query param, `opt()` normalises blank form fields to null, `guard(permission, backPath)`, `dbErrorMessage()` maps Prisma P2002/P2003/P2025 and the internal `AdminError`.

`lib/requests/workflow.ts` owns submit-time logic (all functions take a `Prisma.TransactionClient`): `resolveWorkflow(tx, total)`, `resolveApproverId(tx, {...})` (explicit assignee → same-department role holder → any role holder → null), `generateApprovalSteps(tx, {...})`.

A user without `request:read:any` may only file for their own department and only see their own requests. Admin section pages (`app/(app)/admin/*`) are each gated by `requirePermission(...)` and the `admin/layout.tsx` redirects out anyone with no admin permission; `_ui.tsx` there holds `Flash`, `Disclosure`, `Labeled`, `flashFrom`, `inputCls`.

### Reporting uses raw SQL on purpose

`lib/reports/queries.ts` — five `prisma.$queryRaw` functions (deliberately not the Prisma query API). Conventions there: every filter is a bound parameter (never string-concatenated), every aggregate is cast to `float8`/`int` in SQL so JS gets plain numbers, and identifiers are double-quoted because Prisma keeps table names PascalCase. `lib/reports/index.ts` is a registry mapping `slug → { title, columns, run }`. `app/api/reports/[slug]/export/route.ts` is one generic handler that drives CSV (`lib/export/csv.ts`, no deps) and PDF (`lib/export/pdf.ts`, a pdf-lib table renderer) off that registry; `app/(app)/reports/page.tsx` renders previews + download links from the same registry.

## Next.js 16 specifics that bite

- `cookies()`, `headers()`, `params`, and `searchParams` are all async / Promises.
- `middleware.ts` → `proxy.ts` (exported fn named `proxy`, Node runtime).
- `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>` are generated globals — run `npx next typegen` if they look wrong after adding routes.
- `refresh()` from `next/cache` refreshes the router after a mutation; `revalidatePath`/`revalidateTag` for cached data.

## Known warnings (not bugs)

- `next build` prints a Turbopack tracing warning from `lib/generated/prisma/runtime` (Prisma probes `.env.vault` / openssl). Cosmetic.
- Prisma CLI warns that `package.json#prisma` (the seed config) is deprecated; still works on 6.x.
- `npm audit` flags `deepmerge-ts` (high) — only via the Prisma CLI devDependency, not runtime.
- `server-only` is provided by Next, not installed standalone; a `tsx` script that imports a module pulling in `server-only` (e.g. `lib/reports/queries.ts`) will fail to resolve it outside `next`.
