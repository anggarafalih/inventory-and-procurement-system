import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { reportFilterSchema } from "@/lib/validation";
import { getReport } from "@/lib/reports";
import { toCsv } from "@/lib/export/csv";
import { renderTablePdf } from "@/lib/export/pdf";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/reports/[slug]/export">,
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user.role, "report:read")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { slug } = await ctx.params;
  const report = getReport(slug);
  if (!report) return new Response("Report not found", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const format = (sp.get("format") ?? "csv").toLowerCase();

  const parsed = reportFilterSchema.safeParse({
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    departmentId: sp.get("departmentId") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid filter", details: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const rows = await report.run(parsed.data);
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `${report.slug}-${stamp}`;

  if (format === "pdf") {
    const filterSummary = [
      parsed.data.from && `dari ${parsed.data.from.toISOString().slice(0, 10)}`,
      parsed.data.to && `s/d ${parsed.data.to.toISOString().slice(0, 10)}`,
      parsed.data.status && `status ${parsed.data.status}`,
    ]
      .filter(Boolean)
      .join(", ");

    const pdf = await renderTablePdf(report.columns, rows, {
      title: report.title,
      subtitle: filterSummary || undefined,
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "csv") {
    const csv = toCsv(report.columns, rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response("Unsupported format (use csv or pdf)", { status: 400 });
}
