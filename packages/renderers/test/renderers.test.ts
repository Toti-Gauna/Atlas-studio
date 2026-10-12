import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { ArtifactContent } from "@atlas/contracts";
import { renderExport } from "../src";

const meta = { artifactId: "art_1", version: 3, exportedAt: "2026-10-12T16:00:00.000Z", workspaceName: "Corvid Freight · Demo", label: "DEMO" as const };
const deck: ArtifactContent = {
  type: "presentation",
  title: "Q3 update",
  audience: "Leadership",
  theme: "atlas_light",
  slides: [
    { id: "s1", layout: "title", title: "Q3 update → leadership", subtitle: "Prepared for leadership", bullets: [], right: [], metric: null, notes: "Open", sourceRefs: [] },
    { id: "s2", layout: "bullets", title: "Refunds", subtitle: null, bullets: ["Approved refunds are issued within 14 days."], right: [], metric: null, notes: "Cite S1", sourceRefs: ["S1"] },
    { id: "s3", layout: "metric", title: "On-time", subtitle: null, bullets: ["Target 95% Express"], right: [], metric: { value: "95%", label: "Express target" }, notes: "", sourceRefs: [] },
  ],
};
const sources = [{ ref: "S1", documentId: "doc_refund", versionId: "dv_refund_2", version: 2, documentTitle: "Refund & Cancellation Policy", page: 1, quote: "Approved refunds are issued within 14 days." }];
const report: ArtifactContent = {
  type: "report",
  title: "Gap report",
  blocks: [
    { type: "heading", level: 1, text: "Gap report" },
    { type: "paragraph", text: "12 items reviewed ≥ threshold.", sourceRefs: ["S1"] },
    { type: "table_ref", caption: "Coverage", columns: ["Item", "Status"], rows: [["Encryption", "Covered"], ["=cmd|' /C calc'!A0", "Gap"]] },
  ],
};

describe("export renderers", () => {
  it("PPTX is a valid OOXML package whose slides contain the edited text", async () => {
    const bytes = (await renderExport("pptx", deck, sources, meta)) as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("[Content_Types].xml")).toBeTruthy();
    const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slideFiles).toHaveLength(3);
    const s2 = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(s2).toContain("Approved refunds are issued within 14 days.");
    expect(s2).toContain("Refund &amp; Cancellation Policy");
  });
  it("PDF has a header and one page per slide plus sources", async () => {
    const bytes = (await renderExport("pdf", deck, sources, meta)) as Uint8Array;
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4);
  });
  it("report PDF handles non-WinAnsi characters", async () => {
    const bytes = (await renderExport("pdf", report, sources, meta)) as Uint8Array;
    expect(bytes.length).toBeGreaterThan(800);
  });
  it("Markdown keeps citations and DEMO footer", async () => {
    const md = (await renderExport("md", report, sources, meta)) as string;
    expect(md).toContain("[S1]");
    expect(md).toContain("## Sources");
    expect(md).toContain("DEMO data");
  });
  it("CSV neutralizes formula injection", async () => {
    const csv = (await renderExport("csv", report, sources, meta)) as string;
    expect(csv).toContain("'=cmd");
  });
  it("PPTX is refused for non-presentation artifacts", async () => {
    await expect(renderExport("pptx", report, sources, meta)).rejects.toThrow(/not available/);
  });
});
