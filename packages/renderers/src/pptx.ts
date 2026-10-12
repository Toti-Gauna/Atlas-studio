import type { ArtifactContent, SourceRef } from "@atlas/contracts";
import PptxGenJS from "pptxgenjs";
import { exportFooter, type ExportMeta } from "./text";

import { SLIDE_LAYOUT } from "./layout";

/**
 * PPTX renderer driven only by structured slide fields. The layout constants
 * live in ./layout and are mirrored by the web canvas preview so the preview
 * matches what is exported.
 */
const INK = "0B1220";
const MUTED = "5B6779";
const TEAL = "19B6A4";
const TEAL_INK = "0B6F65";
const PEARL = "F5F7FA";

export async function renderPptx(content: ArtifactContent, sources: SourceRef[], meta: ExportMeta): Promise<Uint8Array> {
  if (content.type !== "presentation") throw new Error("PPTX export is available for presentation artifacts only.");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = content.title;
  pptx.company = meta.workspaceName;
  pptx.author = "Atlas Studio";
  const { width, margin, titleY, bodyY, font } = SLIDE_LAYOUT;
  const bodyW = width - margin * 2;
  const ink = content.theme === "atlas_ink";
  const bg = ink ? INK : PEARL;
  const fg = ink ? PEARL : INK;

  content.slides.forEach((s, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: bg };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: width, h: 0.12, fill: { color: TEAL }, line: { color: TEAL } });
    const sourceLine = s.sourceRefs.length
      ? `Sources: ${s.sourceRefs
          .map((r) => {
            const src = sources.find((x) => x.ref === r);
            return src ? `[${r}] ${src.documentTitle} v${src.version}${src.page ? ` p.${src.page}` : ""}` : `[${r}]`;
          })
          .join("  ·  ")}`
      : "";

    if (s.layout === "title") {
      slide.addText(s.title, { x: margin, y: 2.3, w: bodyW, h: 1.4, fontFace: font, fontSize: 40, bold: true, color: fg, valign: "bottom" });
      if (s.subtitle) slide.addText(s.subtitle, { x: margin, y: 3.8, w: bodyW, h: 0.8, fontFace: font, fontSize: 20, color: ink ? "B9C3D1" : MUTED });
      slide.addShape(pptx.ShapeType.line, { x: margin, y: 3.75, w: 2.2, h: 0, line: { color: TEAL, width: 3 } });
    } else {
      slide.addText(s.title, { x: margin, y: titleY, w: bodyW, h: 0.9, fontFace: font, fontSize: 28, bold: true, color: fg, valign: "middle" });
      const bullets = (items: string[]) => items.map((t) => ({ text: t, options: { bullet: { code: "2022" }, paraSpaceAfter: 10 } }));
      if (s.layout === "two_column") {
        slide.addText(bullets(s.bullets), { x: margin, y: bodyY, w: bodyW / 2 - 0.2, h: 4.8, fontFace: font, fontSize: 18, color: fg, valign: "top" });
        slide.addText(bullets(s.right), { x: margin + bodyW / 2 + 0.2, y: bodyY, w: bodyW / 2 - 0.2, h: 4.8, fontFace: font, fontSize: 18, color: fg, valign: "top" });
      } else if (s.layout === "metric" && s.metric) {
        slide.addText(s.metric.value, { x: margin, y: bodyY, w: 4.6, h: 1.6, fontFace: font, fontSize: 66, bold: true, color: ink ? TEAL : TEAL_INK });
        slide.addText(s.metric.label, { x: margin, y: bodyY + 1.6, w: 4.6, h: 0.8, fontFace: font, fontSize: 16, color: ink ? "B9C3D1" : MUTED });
        slide.addText(bullets(s.bullets), { x: margin + 5, y: bodyY, w: bodyW - 5, h: 4.8, fontFace: font, fontSize: 18, color: fg, valign: "top" });
      } else {
        slide.addText(bullets(s.bullets), { x: margin, y: bodyY, w: bodyW, h: 4.8, fontFace: font, fontSize: 20, color: fg, valign: "top" });
      }
    }
    if (sourceLine) slide.addText(sourceLine, { x: margin, y: 6.55, w: bodyW, h: 0.35, fontFace: font, fontSize: 9, color: ink ? "8D9AAE" : MUTED });
    slide.addText(`${index + 1} / ${content.slides.length}${meta.label === "DEMO" ? "  ·  DEMO data (fictional)" : ""}`, { x: margin, y: 6.95, w: bodyW, h: 0.3, fontFace: font, fontSize: 8, color: ink ? "8D9AAE" : MUTED, align: "right" });
    if (s.notes) slide.addNotes(`${s.notes}\n\n${exportFooter(meta)}`);
  });

  const out = (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
  return out;
}
