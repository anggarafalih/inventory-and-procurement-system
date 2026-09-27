import "server-only";

import { prisma } from "@/lib/prisma";
import type { ReportFilter } from "@/lib/validation";

/// Raw-SQL reporting layer.
///
/// These deliberately use `$queryRaw` instead of the Prisma query API so the
/// joins / aggregates stay explicit and close to what a DBA would write. Every
/// filter is passed as a bound parameter (never string-concatenated) and every
/// aggregate is cast to `float8` / `int` in SQL so the JS side gets plain
/// numbers instead of `Decimal` / `BigInt`.
///
/// Identifiers are quoted because Prisma keeps model names PascalCase and
/// Postgres folds unquoted identifiers to lower-case.

type Nullable<T> = T | null;

function bounds(f: ReportFilter) {
  return {
    from: (f.from ?? null) as Nullable<Date>,
    to: (f.to ?? null) as Nullable<Date>,
    departmentId: (f.departmentId ?? null) as Nullable<string>,
    status: (f.status ?? null) as Nullable<string>,
  };
}

// ---------------------------------------------------------------------------

export interface DepartmentStatusRow {
  [key: string]: unknown;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  totalRequests: number;
  submitted: number;
  inReview: number;
  approved: number;
  rejected: number;
  fulfilled: number;
  estimatedValue: number;
  approvedValue: number;
}

/// Requests grouped by department, with a status breakdown (via aggregate
/// FILTER) and value totals. Answers "where is demand coming from?".
export async function requestsByDepartmentStatus(
  f: ReportFilter,
): Promise<DepartmentStatusRow[]> {
  const { from, to, departmentId, status } = bounds(f);
  return prisma.$queryRaw<DepartmentStatusRow[]>`
    SELECT
      d."id"   AS "departmentId",
      d."name" AS "departmentName",
      d."code" AS "departmentCode",
      COUNT(r."id")::int                                                              AS "totalRequests",
      COUNT(*) FILTER (WHERE r."status" = 'SUBMITTED')::int                        AS "submitted",
      COUNT(*) FILTER (WHERE r."status" = 'IN_REVIEW')::int                        AS "inReview",
      COUNT(*) FILTER (WHERE r."status" = 'APPROVED')::int                         AS "approved",
      COUNT(*) FILTER (WHERE r."status" = 'REJECTED')::int                         AS "rejected",
      COUNT(*) FILTER (WHERE r."status" = 'FULFILLED')::int                        AS "fulfilled",
      COALESCE(SUM(r."estimatedTotal"), 0)::float8                                 AS "estimatedValue",
      COALESCE(SUM(r."estimatedTotal") FILTER (
        WHERE r."status" IN ('APPROVED', 'FULFILLED')), 0)::float8                 AS "approvedValue"
    FROM "Department" d
    LEFT JOIN "Request" r
      ON r."departmentId" = d."id"
     AND (${from}::timestamptz  IS NULL OR r."submittedAt" >= ${from})
     AND (${to}::timestamptz    IS NULL OR r."submittedAt" <  ${to})
     AND (${status}::text       IS NULL OR r."status" = ${status}::"RequestStatus")
    WHERE (${departmentId}::text IS NULL OR d."id" = ${departmentId})
    GROUP BY d."id", d."name", d."code"
    ORDER BY "estimatedValue" DESC, d."name" ASC
  `;
}

// ---------------------------------------------------------------------------

export interface ApproverCycleRow {
  [key: string]: unknown;
  approverId: string;
  approverName: string;
  role: string;
  decided: number;
  approved: number;
  rejected: number;
  pending: number;
  avgHoursToDecide: number | null;
}

/// Per-approver throughput and average time-to-decision. Joins the per-request
/// ApprovalStep instances to the assigned approver.
export async function approvalCycleTimeByApprover(
  f: ReportFilter,
): Promise<ApproverCycleRow[]> {
  const { from, to, departmentId } = bounds(f);
  return prisma.$queryRaw<ApproverCycleRow[]>`
    SELECT
      u."id"                                                          AS "approverId",
      u."name"                                                        AS "approverName",
      u."role"::text                                                  AS "role",
      COUNT(*) FILTER (WHERE s."decision" <> 'PENDING')::int          AS "decided",
      COUNT(*) FILTER (WHERE s."decision" = 'APPROVED')::int          AS "approved",
      COUNT(*) FILTER (WHERE s."decision" = 'REJECTED')::int          AS "rejected",
      COUNT(*) FILTER (WHERE s."decision" = 'PENDING')::int           AS "pending",
      (EXTRACT(EPOCH FROM AVG(s."decidedAt" - s."createdAt")
        FILTER (WHERE s."decidedAt" IS NOT NULL)) / 3600.0)::float8   AS "avgHoursToDecide"
    FROM "ApprovalStep" s
    JOIN "User" u    ON u."id" = s."approverId"
    JOIN "Request" r ON r."id" = s."requestId"
    WHERE (${from}::timestamptz  IS NULL OR s."createdAt" >= ${from})
      AND (${to}::timestamptz    IS NULL OR s."createdAt" <  ${to})
      AND (${departmentId}::text IS NULL OR r."departmentId" = ${departmentId})
    GROUP BY u."id", u."name", u."role"
    ORDER BY "decided" DESC, u."name" ASC
  `;
}

// ---------------------------------------------------------------------------

export interface TopItemRow {
  [key: string]: unknown;
  itemId: Nullable<string>;
  itemName: string;
  sku: Nullable<string>;
  categoryName: Nullable<string>;
  timesRequested: number;
  totalQuantity: number;
  totalValue: number;
}

/// Most-requested items across submitted requests, rolled up with their
/// category. Uses the catalog join but falls back to the line-item name
/// snapshot for ad-hoc (non-catalog) entries.
export async function topRequestedItems(
  f: ReportFilter,
  limit = 20,
): Promise<TopItemRow[]> {
  const { from, to, departmentId, status } = bounds(f);
  return prisma.$queryRaw<TopItemRow[]>`
    SELECT
      i."id"                                        AS "itemId",
      COALESCE(i."name", ri."name")                 AS "itemName",
      i."sku"                                       AS "sku",
      c."name"                                      AS "categoryName",
      COUNT(DISTINCT ri."requestId")::int           AS "timesRequested",
      COALESCE(SUM(ri."quantity"), 0)::int          AS "totalQuantity",
      COALESCE(SUM(ri."lineTotal"), 0)::float8      AS "totalValue"
    FROM "RequestItem" ri
    JOIN "Request" r      ON r."id" = ri."requestId"
    LEFT JOIN "Item" i     ON i."id" = ri."itemId"
    LEFT JOIN "Category" c ON c."id" = i."categoryId"
    WHERE r."status" <> 'DRAFT'
      AND (${from}::timestamptz  IS NULL OR r."submittedAt" >= ${from})
      AND (${to}::timestamptz    IS NULL OR r."submittedAt" <  ${to})
      AND (${departmentId}::text IS NULL OR r."departmentId" = ${departmentId})
      AND (${status}::text       IS NULL OR r."status" = ${status}::"RequestStatus")
    GROUP BY i."id", i."name", i."sku", c."name", ri."name"
    ORDER BY "totalQuantity" DESC, "totalValue" DESC
    LIMIT ${limit}
  `;
}

// ---------------------------------------------------------------------------

export interface MonthlyTrendRow {
  [key: string]: unknown;
  month: string; // ISO date, first of month
  requests: number;
  approved: number;
  rejected: number;
  estimatedValue: number;
}

/// Month-by-month submission trend (last N months of activity in range).
export async function monthlyRequestTrend(
  f: ReportFilter,
): Promise<MonthlyTrendRow[]> {
  const { from, to, departmentId } = bounds(f);
  return prisma.$queryRaw<MonthlyTrendRow[]>`
    SELECT
      to_char(date_trunc('month', r."submittedAt"), 'YYYY-MM-DD')       AS "month",
      COUNT(*)::int                                                     AS "requests",
      COUNT(*) FILTER (WHERE r."status" IN ('APPROVED','FULFILLED'))::int AS "approved",
      COUNT(*) FILTER (WHERE r."status" = 'REJECTED')::int              AS "rejected",
      COALESCE(SUM(r."estimatedTotal"), 0)::float8                      AS "estimatedValue"
    FROM "Request" r
    WHERE r."submittedAt" IS NOT NULL
      AND (${from}::timestamptz  IS NULL OR r."submittedAt" >= ${from})
      AND (${to}::timestamptz    IS NULL OR r."submittedAt" <  ${to})
      AND (${departmentId}::text IS NULL OR r."departmentId" = ${departmentId})
    GROUP BY 1
    ORDER BY 1 ASC
  `;
}

// ---------------------------------------------------------------------------

export interface PendingAgingRow {
  [key: string]: unknown;
  bucket: string;
  requests: number;
  value: number;
}

/// Aging of requests currently waiting on an approval decision, bucketed by how
/// long the oldest pending step has been open.
export async function pendingApprovalAging(): Promise<PendingAgingRow[]> {
  return prisma.$queryRaw<PendingAgingRow[]>`
    WITH pending AS (
      SELECT
        r."id",
        r."estimatedTotal",
        now() - MIN(s."createdAt") AS age
      FROM "Request" r
      JOIN "ApprovalStep" s ON s."requestId" = r."id" AND s."decision" = 'PENDING'
      WHERE r."status" IN ('SUBMITTED', 'IN_REVIEW')
      GROUP BY r."id", r."estimatedTotal"
    )
    SELECT
      CASE
        WHEN age < interval '2 days'  THEN '0-2 hari'
        WHEN age < interval '5 days'  THEN '2-5 hari'
        WHEN age < interval '10 days' THEN '5-10 hari'
        ELSE '10+ hari'
      END                                       AS "bucket",
      COUNT(*)::int                             AS "requests",
      COALESCE(SUM("estimatedTotal"), 0)::float8 AS "value"
    FROM pending
    GROUP BY 1
    ORDER BY MIN(age) ASC
  `;
}
