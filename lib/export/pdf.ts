import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/// Small table-to-PDF renderer built on pdf-lib (pure JS, works in the Node
/// runtime without native deps). Not a full layout engine — it draws a single
/// left-aligned table with a header band, fixed proportional column widths,
/// cell truncation and automatic pagination.

export interface PdfColumn<Row> {
  key: keyof Row & string;
  label: string;
  /// Relative width weight (defaults to 1).
  weight?: number;
  align?: "left" | "right";
}

export interface PdfTableOptions {
  title: string;
  subtitle?: string;
}

const PAGE = { width: 842, height: 595 }; // A4 landscape (pt)
const MARGIN = 36;
const FONT_SIZE = 9;
const HEADER_SIZE = 10;
const ROW_HEIGHT = 18;

function truncateToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

export async function renderTablePdf<Row extends Record<string, unknown>>(
  columns: PdfColumn<Row>[],
  rows: Row[],
  options: PdfTableOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const usableWidth = PAGE.width - MARGIN * 2;
  const totalWeight = columns.reduce((s, c) => s + (c.weight ?? 1), 0);
  const colWidths = columns.map(
    (c) => ((c.weight ?? 1) / totalWeight) * usableWidth,
  );

  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;

    page.drawText(options.title, {
      x: MARGIN,
      y: y - 12,
      size: 16,
      font: bold,
      color: rgb(0.1, 0.1, 0.12),
    });
    y -= 22;

    const meta = [
      options.subtitle,
      `Dibuat ${new Date().toLocaleString("id-ID")}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    page.drawText(meta, {
      x: MARGIN,
      y: y - 10,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.5),
    });
    y -= 26;

    drawHeaderRow();
  };

  const drawHeaderRow = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - ROW_HEIGHT + 4,
      width: usableWidth,
      height: ROW_HEIGHT,
      color: rgb(0.93, 0.94, 0.97),
    });
    let x = MARGIN;
    columns.forEach((c, i) => {
      const w = colWidths[i];
      const label = truncateToWidth(c.label, bold, HEADER_SIZE, w - 8);
      const tw = bold.widthOfTextAtSize(label, HEADER_SIZE);
      page.drawText(label, {
        x: c.align === "right" ? x + w - 4 - tw : x + 4,
        y: y - ROW_HEIGHT + 10,
        size: HEADER_SIZE,
        font: bold,
        color: rgb(0.2, 0.2, 0.25),
      });
      x += w;
    });
    y -= ROW_HEIGHT;
  };

  newPage();

  if (rows.length === 0) {
    page.drawText("Tidak ada data untuk filter ini.", {
      x: MARGIN,
      y: y - 14,
      size: FONT_SIZE,
      font,
      color: rgb(0.4, 0.4, 0.45),
    });
  }

  for (const row of rows) {
    if (y - ROW_HEIGHT < MARGIN) newPage();

    let x = MARGIN;
    columns.forEach((c, i) => {
      const w = colWidths[i];
      const raw = row[c.key];
      const text = truncateToWidth(
        raw === null || raw === undefined ? "" : String(raw),
        font,
        FONT_SIZE,
        w - 8,
      );
      const tw = font.widthOfTextAtSize(text, FONT_SIZE);
      page.drawText(text, {
        x: c.align === "right" ? x + w - 4 - tw : x + 4,
        y: y - 13,
        size: FONT_SIZE,
        font,
        color: rgb(0.15, 0.15, 0.18),
      });
      x += w;
    });

    y -= ROW_HEIGHT;
    page.drawLine({
      start: { x: MARGIN, y: y + 3 },
      end: { x: MARGIN + usableWidth, y: y + 3 },
      thickness: 0.4,
      color: rgb(0.85, 0.85, 0.88),
    });
  }

  return doc.save();
}
