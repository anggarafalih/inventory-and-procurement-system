/// Minimal RFC-4180 CSV serialiser. No dependency needed.

export interface CsvColumn<Row> {
  key: keyof Row & string;
  label: string;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<Row extends Record<string, unknown>>(
  columns: CsvColumn<Row>[],
  rows: Row[],
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(","),
  );
  // Prepend BOM so Excel opens UTF-8 correctly.
  return "﻿" + [header, ...body].join("\r\n") + "\r\n";
}
