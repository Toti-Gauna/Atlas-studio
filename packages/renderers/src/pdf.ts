import type { ArtifactContent, SourceRef } from "@atlas/contracts";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { exportFooter, winAnsiSafe, type ExportMeta } from "./text";

const INK = rgb(11 / 255, 18 / 255, 32 / 255);
const MUTED = rgb(0.36, 0.4, 0.47);
const TEAL = rgb(11 / 255, 111 / 255, 101 / 255);
const LINE = rgb(0.86, 0.89, 0.92);

interface Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  width: number;
  height: number;
  margin: number;
  regular: PDFFont;
  bold: PDFFont;
  meta: ExportMeta;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of winAnsiSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

function newPage(c: Cursor) {
  drawFooter(c);
  c.page = c.doc.addPage([c.width, c.height]);
  c.y = c.height - c.margin;
}

function drawFooter(c: Cursor) {
  c.page.drawText(winAnsiSafe(exportFooter(c.meta)), { x: c.margin, y: 24, size: 7.5, font: c.regular, color: MUTED });
}

function text(c: Cursor, value: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
  const size = opts.size ?? 10.5;
  const font = opts.bold ? c.bold : c.regular;
  const indent = opts.indent ?? 0;
  const lines = wrap(value, font, size, c.width - c.margin * 2 - indent);
  for (const line of lines) {
    if (c.y < c.margin + 30) newPage(c);
    c.page.drawText(line, { x: c.margin + indent, y: c.y, size, font, color: opts.color ?? INK });
    c.y -= size * 1.38;
  }
  c.y -= opts.gap ?? 6;
}

function table(c: Cursor, columns: string[], rows: string[][]) {
  const colW = (c.width - c.margin * 2) / Math.max(1, columns.length);
  const size = columns.length > 5 ? 7.5 : 8.5;
  const drawRow = (cells: string[], bold: boolean) => {
    const wrapped = cells.map((cell) => wrap(cell, bold ? c.bold : c.regular, size, colW - 6));
    const h = Math.max(...wrapped.map((w) => w.length)) * size * 1.3 + 6;
    if (c.y - h < c.margin + 30) newPage(c);
    wrapped.forEach((lines, i) => lines.forEach((l, k) => c.page.drawText(l, { x: c.margin + i * colW + 3, y: c.y - size - k * size * 1.3, size, font: bold ? c.bold : c.regular, color: INK })));
    c.y -= h;
    c.page.drawLine({ start: { x: c.margin, y: c.y + 2 }, end: { x: c.width - c.margin, y: c.y + 2 }, thickness: 0.5, color: LINE });
  };
  drawRow(columns, true);
  rows.forEach((r) => drawRow(r, false));
  c.y -= 10;
}

export async function renderPdf(content: ArtifactContent, sources: SourceRef[], meta: ExportMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsiSafe(content.title));
  doc.setProducer("Atlas Studio renderer");
  doc.setCreator("Atlas Studio");
  const landscape = content.type === "presentation";
  const [width, height] = landscape ? [842, 595] : [595, 842];
  const c: Cursor = {
    doc,
    page: doc.addPage([width, height]),
    y: height - 56,
    width,
    height,
    margin: 56,
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    meta,
  };

  if (content.type === "report") {
    for (const b of content.blocks) {
      if (b.type === "heading") text(c, b.text, { size: b.level === 1 ? 20 : b.level === 2 ? 14 : 12, bold: true, gap: 8 });
      else if (b.type === "paragraph") text(c, b.text + (b.sourceRefs.length ? ` ${b.sourceRefs.map((r) => `[${r}]`).join("")}` : ""));
      else if (b.type === "bullets") b.items.forEach((i) => text(c, `• ${i}`, { indent: 8, gap: 2 }));
      else if (b.type === "callout") text(c, `${b.tone === "gap" ? "GAP" : b.tone === "warning" ? "WARNING" : "NOTE"}: ${b.text}`, { color: b.tone === "gap" ? rgb(0.7, 0.15, 0.12) : TEAL, gap: 10 });
      else if (b.type === "table_ref") {
        text(c, b.caption, { bold: true, size: 10 });
        table(c, b.columns, b.rows);
      } else if (b.type === "code") text(c, b.text, { size: 8.5, color: MUTED });
    }
  } else if (content.type === "table") {
    text(c, content.title, { size: 20, bold: true, gap: 10 });
    table(
      c,
      content.columns.map((col) => col.label),
      content.rows.map((r) => content.columns.map((col) => String(r[col.key] ?? ""))),
    );
    if (content.note) text(c, content.note, { color: MUTED, size: 9 });
  } else {
    content.slides.forEach((s, i) => {
      if (i > 0) newPage(c);
      c.page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: TEAL });
      c.y = height - 90;
      text(c, s.title, { size: s.layout === "title" ? 30 : 24, bold: true, gap: 10 });
      if (s.subtitle) text(c, s.subtitle, { size: 14, color: MUTED, gap: 14 });
      if (s.metric) {
        text(c, s.metric.value, { size: 40, bold: true, color: TEAL, gap: 2 });
        text(c, s.metric.label, { size: 12, color: MUTED });
      }
      s.bullets.forEach((b) => text(c, `• ${b}`, { size: 15, indent: 6, gap: 6 }));
      s.right.forEach((b) => text(c, `• ${b}`, { size: 15, indent: 6, gap: 6 }));
      if (s.sourceRefs.length) text(c, `Sources: ${s.sourceRefs.join(", ")}`, { size: 9, color: MUTED });
    });
  }
  if (sources.length) {
    newPage(c);
    text(c, "Sources", { size: 16, bold: true, gap: 10 });
    sources.forEach((s) => text(c, `[${s.ref}] ${s.documentTitle} - v${s.version}${s.page ? ` - p.${s.page}` : ""}: "${s.quote}"`, { size: 9, gap: 6 }));
  }
  drawFooter(c);
  return doc.save();
}
