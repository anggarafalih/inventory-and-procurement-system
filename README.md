# Inventory / Request Management System

Portal permintaan barang dengan **approval multi-level**, **tracking status**, dan
**laporan** (report generation). Dibangun dengan Next.js 16 (App Router) + PostgreSQL + Prisma.

Siklus penuh sudah jalan: **buat/ubah draf → ajukan → approval multi-level
(setujui/tolak) → pemenuhan (kurangi stok)**, ditambah area **admin** (barang,
kategori, pengguna, workflow) dan **5 laporan** SQL dengan export CSV/PDF.

## Prasyarat

- Node.js 20+
- PostgreSQL 14+ berjalan (default konfigurasi: `localhost:5432`)

## Setup

```bash
# 1. Dependencies
npm install

# 2. Environment — salin lalu isi kredensial DB & secret
cp .env.example .env
#   - DATABASE_URL : postgresql://USER:PASSWORD@HOST:5432/mayora?schema=public
#   - SESSION_SECRET : openssl rand -base64 32

# 3. Buat database (sekali)
createdb mayora        # atau: psql -c "CREATE DATABASE mayora;"

# 4. Jalankan migrasi + generate client
npm run db:migrate     # prisma migrate dev (migrasi awal sudah tersedia di prisma/migrations)

# 5. Isi data demo
npm run db:seed

# 6. Jalankan
npm run dev            # http://localhost:3000
```

### Akun demo

Semua akun memakai password **`password123`**:

| Email | Peran |
|---|---|
| `admin@mayora.test` | ADMIN |
| `direktur@mayora.test` | DIRECTOR |
| `finance@mayora.test` | FINANCE |
| `mgr.it@mayora.test` | MANAGER |
| `staff.it@mayora.test` | REQUESTER |

## Script

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:migrate` | Buat & terapkan migrasi (dev) |
| `npm run db:deploy` | Terapkan migrasi (production) |
| `npm run db:seed` | Reset & isi data demo |
| `npm run db:reset` | Drop, migrate ulang, seed |
| `npm run db:studio` | Prisma Studio (GUI data) |

## Arsitektur

```
prisma/
  schema.prisma          Model data (11 tabel + 4 enum)
  migrations/            Migrasi SQL (initial sudah di-commit)
  seed.ts               Data demo
lib/
  prisma.ts             Singleton Prisma Client
  session-token.ts      Encode/verify JWT cookie (dipakai proxy + server)
  session.ts            set/baca/hapus cookie session (server-only)
  dal.ts                verifySession, getCurrentUser, requireUser, requirePermission
  rbac.ts               Role + matriks permission
  request-number.ts     Generator nomor request (REQ-YYYY-NNNN)
  requests/workflow.ts  Resolusi workflow + generate ApprovalStep saat submit
  format.ts             Format rupiah / tanggal (id-ID)
  validation.ts         Skema Zod (login, request, laporan, master data admin)
  reports/queries.ts    Query aggregate SQL mentah ($queryRaw)
  reports/index.ts      Registry laporan (slug -> runner + kolom)
  export/csv.ts         Serialisasi CSV
  export/pdf.ts         Render tabel -> PDF (pdf-lib)
app/
  actions/auth.ts       login / logout
  actions/requests.ts   saveRequest (buat/ubah draf, +submit) / submitExistingRequest / cancelRequest
  actions/approvals.ts  decideApproval (setujui / tolak langkah aktif)
  actions/fulfillment.ts fulfillRequest (APPROVED -> FULFILLED, kurangi stok)
  actions/admin.ts      saveItem / adjustStock / saveCategory / saveUser / resetUserPassword / saveWorkflow / addStage / deleteStage
  (auth)/login/         Halaman login
  (app)/layout.tsx      Shell terproteksi (requireUser) + nav
  (app)/dashboard/      Ringkasan + stok menipis (admin)
  (app)/requests/       Daftar, buat, [id] detail (approval + keputusan + pemenuhan + pergerakan stok + riwayat), [id]/edit
  (app)/approvals/      Antrian approver: perlu diputuskan / antre / riwayat
  (app)/admin/          layout+guard, items, categories, users, workflows
  (app)/reports/        Daftar laporan + preview + tombol export
  api/reports/[slug]/export/route.ts   Endpoint download CSV/PDF
proxy.ts                Gate auth optimistic (baca cookie saja)
```

### Alur approval

1. `Request` dibuat oleh REQUESTER, nilai `estimatedTotal` dihitung dari `RequestItem`.
2. Saat submit, `ApprovalWorkflow` dipilih berdasar nilai (`Standar` < 10jt,
   `Menengah` 10–50jt, `Tinggi` > 50jt), lalu `ApprovalStage` template disalin
   menjadi `ApprovalStep` per request.
3. Approver memutuskan tiap step berurutan; `RequestActivity` mencatat perubahan
   status (audit trail).
4. Request `APPROVED` bisa di-`FULFILLED` → `StockMovement` mengurangi stok `Item`.

### Laporan (latihan SQL join/aggregate)

Semua di `lib/reports/queries.ts` memakai `$queryRaw` (bukan query API Prisma):

- **requests-by-department** — `GROUP BY` departemen + `COUNT ... FILTER` per status + `SUM`
- **approval-cycle-time** — join `ApprovalStep → User`, `AVG(decidedAt - createdAt)`
- **top-items** — join `RequestItem → Item → Category`, agregasi qty & nilai
- **monthly-trend** — `date_trunc('month', submittedAt)`
- **pending-aging** — CTE + `CASE` bucket umur approval tertunda

Export: `GET /api/reports/<slug>/export?format=csv|pdf` (filter opsional:
`from`, `to`, `departmentId`, `status`).

## Catatan

- `next build` menampilkan warning tracing dari `lib/generated/prisma/runtime`
  (Prisma mengecek `.env.vault` / versi openssl saat runtime). Kosmetik, aman diabaikan.
- Konfigurasi Prisma masih memakai `package.json#prisma` (deprecated di Prisma 7,
  tetap jalan di 6.x).
- `npm audit` melaporkan 3 isu high di `deepmerge-ts` — hanya lewat **Prisma CLI**
  (devDependency, tidak masuk runtime).
