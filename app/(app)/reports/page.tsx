import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal";
import { REPORTS } from "@/lib/reports";

export const metadata: Metadata = { title: "Laporan · Mayora" };

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("id-ID");
  return String(value);
}

export default async function ReportsPage() {
  await requirePermission("report:read");

  const reports = Object.values(REPORTS);
  const results = await Promise.all(
    reports.map(async (r) => {
      try {
        return { report: r, rows: await r.run({}), error: null as string | null };
      } catch (e) {
        return {
          report: r,
          rows: [] as Record<string, unknown>[],
          error: e instanceof Error ? e.message : "Query gagal",
        };
      }
    }),
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Laporan
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Query aggregate (SQL mentah). Setiap laporan bisa diunduh CSV atau PDF.
        </p>
      </div>

      {results.map(({ report, rows, error }) => (
        <section key={report.slug} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {report.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {report.description}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <a
                className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                href={`/api/reports/${report.slug}/export?format=csv`}
              >
                CSV
              </a>
              <a
                className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                href={`/api/reports/${report.slug}/export?format=pdf`}
              >
                PDF
              </a>
            </div>
          </div>

          {error ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {error} — jalankan migrasi &amp; seed dulu.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {report.columns.map((c) => (
                      <th
                        key={c.key}
                        className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-400 ${
                          c.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={report.columns.length}
                        className="px-3 py-4 text-center text-gray-400"
                      >
                        Belum ada data.
                      </td>
                    </tr>
                  ) : (
                    rows.slice(0, 15).map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        {report.columns.map((c) => (
                          <td
                            key={c.key}
                            className={`px-3 py-2 text-gray-800 dark:text-gray-200 ${
                              c.align === "right" ? "text-right tabular-nums" : ""
                            }`}
                          >
                            {formatCell(row[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
