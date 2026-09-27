# Inventory & Procurement System

A web portal for **internal item requests** with a **multi-level approval workflow**,
**status tracking**, **inventory control**, and **reporting** (CSV / PDF export).

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

The full request lifecycle is implemented:

```
Draft ──► Submitted ──► In review (stage 1 … n) ──► Approved ──► Fulfilled (stock decremented)
  │                              │
  └──► Cancelled                 └──► Rejected
```

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Roles & permissions](#roles--permissions)
- [Approval workflow](#approval-workflow)
- [Reports](#reports)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
- [Known warnings](#known-warnings)

---

## Features

**Requests**
- Create requests with multiple line items, picked from the catalogue or entered as free text
- Save as draft, edit, submit, or cancel
- Request numbers are generated automatically (`REQ-YYYY-NNNN`)
- The detail page shows approval progress, each decision with its note, stock movements, and a full activity history

**Multi-level approval**
- The approval chain depends on the request's total value (1, 2, or 3 stages)
- Approvers get a queue with three tabs: *to decide*, *upcoming*, and *history*
- Approve moves the request to the next stage. Reject requires a note and closes the request.
- Every status change goes into an append-only audit trail

**Inventory**
- Item catalogue with SKU, unit, unit price, stock quantity, and minimum stock
- Nested categories
- Fulfilling an approved request decrements stock and blocks if stock is insufficient
- Manual stock adjustments, all recorded as stock movements
- The dashboard shows a low-stock alert

**Administration**
- Manage items, categories, users (including password reset), and approval workflows/stages

**Reporting**
- Five analytical reports written in raw SQL, with an on-screen preview
- Export to **CSV** or **PDF**, with filters for date range, department, and status

**Security**
- Signed JWT session cookie (HS256, `jose`) and bcrypt password hashing
- Role-based access control, checked on the server in every page, server action, and route handler

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Database | PostgreSQL 14+ |
| ORM | Prisma 6 (plus raw SQL for reports) |
| Validation | Zod 4 |
| Auth | `jose` (JWT) + `bcryptjs` |
| PDF export | `pdf-lib` |

---

## Getting started

### Prerequisites

- Node.js **20+**
- PostgreSQL **14+** running (default `localhost:5432`)

### Installation

```bash
# 1. Clone
git clone https://github.com/anggarafalih/inventory-and-procurement-system.git
cd inventory-and-procurement-system

# 2. Install dependencies (also generates the Prisma client)
npm install

# 3. Configure environment
cp .env.example .env
#   DATABASE_URL   = postgresql://USER:PASSWORD@HOST:5432/mayora?schema=public
#   SESSION_SECRET = at least 16 chars, e.g. `openssl rand -base64 32`

# 4. Create the database (once)
createdb mayora            # or: psql -c "CREATE DATABASE mayora;"

# 5. Apply migrations
npm run db:migrate

# 6. Seed demo data
npm run db:seed

# 7. Run
npm run dev                # http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret used to sign session cookies (≥ 16 characters) |
| `SESSION_TTL_DAYS` | – | Session lifetime in days (default `7`) |

---

## Demo accounts

After `npm run db:seed`, every account uses the password **`password123`**:

| Email | Role |
|---|---|
| `admin@mayora.test` | ADMIN |
| `direktur@mayora.test` | DIRECTOR |
| `finance@mayora.test` | FINANCE |
| `mgr.it@mayora.test` | MANAGER |
| `staff.it@mayora.test` | REQUESTER |

The seed also creates 5 departments, a category tree, 13 catalogue items, and 3 approval workflows.

---

## Roles & permissions

| Permission | REQUESTER | MANAGER | FINANCE | DIRECTOR | ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|
| Create requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve / reject | | ✅ | ✅ | ✅ | ✅ |
| View all requests | | | | ✅ | ✅ |
| View reports | | ✅ | ✅ | ✅ | ✅ |
| Fulfil requests (move stock) | | | | | ✅ |
| Manage catalogue & stock | | | | | ✅ |
| Manage workflows | | | | | ✅ |
| Manage users | | | | | ✅ |

Users without *view all requests* can file requests only for their own department, and can see only their own requests plus the ones waiting on them.

The permission matrix lives in `lib/rbac.ts`. `lib/dal.ts` (`requireUser` / `requirePermission`) enforces it on the server. `proxy.ts` is only a quick cookie check that sends logged-out users to the login page; it doesn't enforce permissions.

---

## Approval workflow

An `ApprovalWorkflow` is a **template**. It is picked by the request's estimated total:

| Workflow | Total value (IDR) | Stages |
|---|---|---|
| **Standar** | < 10,000,000 | Manager |
| **Menengah** | 10,000,000 – 50,000,000 | Manager → Finance |
| **Tinggi** | ≥ 50,000,000 | Manager → Finance → Director |

On submit, the workflow's `ApprovalStage`s are copied into per-request `ApprovalStep`s.
Each step is assigned to a specific approver when possible, in this order:

1. The approver named on the stage
2. Someone with the stage's role in the requester's department
3. Anyone with that role

If none of these match, the step stays open to anyone with that role.

Steps are decided in order:
- **Approve** moves the request to the next pending step, or marks it `APPROVED` after the last step.
- **Reject** (a note is required) marks the request `REJECTED` and skips the remaining steps.

Admins can edit workflows, their value ranges, and their stages in **Admin → Workflows**.

---

## Reports

All reports live in `lib/reports/queries.ts` and deliberately use `prisma.$queryRaw` (parameterised SQL) rather than the Prisma query API:

| Slug | What it shows | SQL techniques |
|---|---|---|
| `requests-by-department` | Request count and value per department, split by status | `GROUP BY`, `COUNT … FILTER`, `SUM` |
| `approval-cycle-time` | Decisions and average decision time per approver | `JOIN`, `AVG(interval)` |
| `top-items` | Most requested items by quantity and value | multi-table `JOIN`, aggregates |
| `monthly-trend` | Requests submitted per month | `date_trunc('month', …)` |
| `pending-aging` | Pending approvals grouped by age | CTE, `CASE` buckets |

**Export endpoint**

```
GET /api/reports/<slug>/export?format=csv|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD&departmentId=…&status=…
```

---

## Data model

11 tables and 4 enums (`prisma/schema.prisma`):

| Model | Purpose |
|---|---|
| `Department`, `User` | Organisation and accounts (with `Role`) |
| `Category`, `Item` | Catalogue: nested categories, items with stock levels |
| `ApprovalWorkflow`, `ApprovalStage` | Approval templates, chosen by value range |
| `Request`, `RequestItem` | Requests and their lines (item name is copied onto the line so history survives catalogue edits) |
| `ApprovalStep` | The approval decisions on each request |
| `RequestActivity` | Append-only audit trail |
| `StockMovement` | Stock ledger (`IN` / `OUT` / `ADJUSTMENT`) |

**Enums:** `Role`, `RequestStatus` (`DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`, `FULFILLED`), `ApprovalDecision`, `StockMovementType`.

---

## Project structure

```
prisma/
  schema.prisma            Data model
  migrations/              SQL migrations
  seed.ts                  Demo data
lib/
  prisma.ts                Prisma client singleton (generated client in lib/generated/prisma)
  session-token.ts         JWT encode/verify (shared by proxy + server)
  session.ts               Cookie read/write (server-only)
  dal.ts                   getCurrentUser / requireUser / requirePermission
  rbac.ts                  Roles + permission matrix
  requests/workflow.ts     Workflow resolution + approval step generation
  request-number.ts        REQ-YYYY-NNNN generator
  validation.ts            Zod schemas
  format.ts                IDR currency / date formatting (id-ID)
  reports/                 Raw SQL queries + report registry
  export/                  CSV and PDF renderers
app/
  (auth)/login/            Login page
  (app)/dashboard/         Summary + low-stock alert
  (app)/requests/          List, create, detail, edit
  (app)/approvals/         Approver queue
  (app)/reports/           Report previews + export
  (app)/admin/             Items, categories, users, workflows
  actions/                 Server actions (auth, requests, approvals, fulfillment, admin)
  api/reports/[slug]/export/  CSV/PDF download endpoint
proxy.ts                   Redirects logged-out users to /login (cookie check only)
```

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run db:migrate` | Create and apply a migration (dev) |
| `npm run db:deploy` | Apply migrations (production / CI) |
| `npm run db:seed` | Reset and reseed demo data |
| `npm run db:reset` | Drop → migrate → seed |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |

---

## Known warnings

These are harmless and can be ignored:

- `next build` prints a Turbopack tracing warning from `lib/generated/prisma/runtime` (Prisma looks for `.env.vault` / the OpenSSL version).
- Prisma warns that `package.json#prisma` (the seed config) is deprecated. It still works on 6.x.
- `npm audit` flags `deepmerge-ts`. It only comes in through the Prisma CLI dev dependency and isn't part of the runtime.
