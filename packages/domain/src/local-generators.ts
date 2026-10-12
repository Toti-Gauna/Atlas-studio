import type { ArtifactContent, ReportBlock, Slide, SourceRef } from "@atlas/contracts";
import { bm25Search, looksLikeInjection, tokenize, type ChunkInput } from "./retrieval";
import { aggregate, profileCsv, type CsvProfile } from "./csv";

/**
 * Local-mode generators: templates + deterministic computation. Output is
 * labeled "local" in the UI and never presented as generative AI.
 */

export interface ChecklistFinding {
  item: string;
  status: "covered" | "partial" | "gap";
  evidence: { chunk: ChunkInput; quote: string } | null;
  score: number;
}

function bestSentence(text: string, terms: Set<string>): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 12 && !looksLikeInjection(s));
  let best: string | null = null;
  let bestOverlap = 0;
  for (const s of sentences) {
    const t = new Set(tokenize(s));
    let o = 0;
    for (const q of terms) if (t.has(q)) o++;
    if (o > bestOverlap) {
      bestOverlap = o;
      best = s.trim();
    }
  }
  return best;
}

export function compareChecklist(items: string[], policyChunks: ChunkInput[]): ChecklistFinding[] {
  return items.map((item) => {
    const hits = bm25Search(item, policyChunks);
    const top = hits[0];
    if (!top) return { item, status: "gap", evidence: null, score: 0 };
    const terms = new Set(tokenize(item));
    const best = hits.reduce((a, h) => (h.coverage > a.coverage ? h : a), top);
    const quote = bestSentence(best.chunk.text, terms);
    const status: ChecklistFinding["status"] = best.coverage >= 0.75 ? "covered" : best.coverage >= 0.4 ? "partial" : "gap";
    return { item, status, evidence: status === "gap" || !quote ? null : { chunk: best.chunk, quote }, score: best.coverage };
  });
}

export function gapReport(title: string, scope: string, jurisdiction: string, findings: ChecklistFinding[]): { content: ArtifactContent; sources: SourceRef[] } {
  const sources: SourceRef[] = [];
  const refFor = (f: ChecklistFinding): string | null => {
    if (!f.evidence) return null;
    const ref = `S${sources.length + 1}`;
    sources.push({
      ref,
      documentId: f.evidence.chunk.documentId,
      versionId: f.evidence.chunk.versionId,
      version: f.evidence.chunk.version,
      documentTitle: f.evidence.chunk.documentTitle,
      page: f.evidence.chunk.page,
      quote: f.evidence.quote.slice(0, 600),
    });
    return ref;
  };
  const rows = findings.map((f) => {
    const ref = refFor(f);
    return [f.item, f.status === "covered" ? "Covered" : f.status === "partial" ? "Partial" : "Gap", f.evidence ? `“${f.evidence.quote}” [${ref}]` : "No supporting passage found."];
  });
  const gaps = findings.filter((f) => f.status === "gap").length;
  const partial = findings.filter((f) => f.status === "partial").length;
  const blocks: ReportBlock[] = [
    { type: "heading", level: 1, text: title },
    { type: "callout", tone: "info", text: `Scope: ${scope}. Jurisdiction: ${jurisdiction}. This review is a checklist comparison, not a legal opinion or certification.` },
    { type: "paragraph", text: `${findings.length} checklist items reviewed: ${findings.length - gaps - partial} covered, ${partial} partial, ${gaps} gaps.`, sourceRefs: [] },
    { type: "table_ref", caption: "Checklist coverage", columns: ["Checklist item", "Status", "Evidence"], rows },
  ];
  if (gaps) blocks.push({ type: "callout", tone: "gap", text: `${gaps} item(s) have no supporting passage. Recommend a human review before relying on this policy.` });
  return { content: { type: "report", title, blocks }, sources };
}

export function dataReport(fileTitle: string, csvText: string, groupBy: string | null, measure: string | null): { content: ArtifactContent; profile: CsvProfile } {
  const profile = profileCsv(csvText);
  const fmt = (x: number) => (Math.abs(x) >= 100 ? x.toLocaleString("en-US", { maximumFractionDigits: 1 }) : x.toLocaleString("en-US", { maximumFractionDigits: 3 }));
  const blocks: ReportBlock[] = [
    { type: "heading", level: 1, text: `Analysis of ${fileTitle}` },
    { type: "paragraph", text: `${profile.rowCount} rows × ${profile.columnCount} columns. Validation: ${profile.valid ? "passed" : "failed"} with ${profile.issues.length} issue(s).`, sourceRefs: [] },
    {
      type: "table_ref",
      caption: "Column profile (computed)",
      columns: ["Column", "Type", "Missing", "Distinct", "Mean", "Median", "Min", "Max"],
      rows: profile.columns.map((c) => [
        c.name,
        c.kind,
        String(c.missing),
        String(c.distinct),
        c.numeric ? fmt(c.numeric.mean) : "—",
        c.numeric ? fmt(c.numeric.median) : "—",
        c.numeric ? fmt(c.numeric.min) : c.dateRange?.min ?? "—",
        c.numeric ? fmt(c.numeric.max) : c.dateRange?.max ?? "—",
      ]),
    },
  ];
  if (groupBy && profile.valid) {
    const agg = aggregate(csvText, groupBy, measure, measure ? "sum" : "count");
    blocks.push({ type: "heading", level: 2, text: measure ? `${measure} by ${groupBy}` : `Rows by ${groupBy}` });
    blocks.push({ type: "table_ref", caption: measure ? `Sum of ${measure}` : "Row count", columns: [groupBy, measure ? `Sum of ${measure}` : "Rows", "Rows"], rows: agg.slice(0, 12).map((a) => [a.group, fmt(a.value), String(a.rows)]) });
  }
  if (profile.issues.length) {
    blocks.push({ type: "bullets", items: profile.issues.slice(0, 10).map((i) => `${i.severity.toUpperCase()}: ${i.message}`), sourceRefs: [] });
  }
  blocks.push({ type: "callout", tone: "info", text: `Method: ${profile.method} Correlation is not causation; figures describe this file only.` });
  return { content: { type: "report", title: `Analysis of ${fileTitle}`, blocks }, profile };
}

export function presentationFromBrief(
  brief: { audience: string; goal: string; slideCount: number },
  facts: Array<{ text: string; ref: string }>,
): ArtifactContent {
  const count = Math.min(12, Math.max(3, brief.slideCount));
  const slides: Slide[] = [];
  slides.push({ id: "s1", layout: "title", title: brief.goal.slice(0, 110), subtitle: `Prepared for ${brief.audience}`, bullets: [], right: [], metric: null, notes: "Opening: state the decision this deck supports.", sourceRefs: [] });
  const body = facts.slice(0, Math.max(1, count - 2));
  body.forEach((f, i) => {
    const sentence = f.text.length > 210 ? `${f.text.slice(0, 207)}…` : f.text;
    slides.push({
      id: `s${i + 2}`,
      layout: "bullets",
      title: sentence.split(/[,:;.]/)[0]!.slice(0, 80),
      subtitle: null,
      bullets: [sentence],
      right: [],
      metric: null,
      notes: `Source ${f.ref}. Edit wording before presenting.`,
      sourceRefs: [f.ref],
    });
  });
  while (slides.length < count - 1) {
    slides.push({ id: `s${slides.length + 1}`, layout: "bullets", title: "Open question", subtitle: null, bullets: ["Add evidence or remove this slide."], right: [], metric: null, notes: "No sourced fact available for this slot.", sourceRefs: [] });
  }
  slides.push({ id: `s${slides.length + 1}`, layout: "closing", title: "Next steps", subtitle: null, bullets: ["Confirm owners and dates", "Review sources marked on each slide"], right: [], metric: null, notes: "Close with the decision requested.", sourceRefs: [] });
  return { type: "presentation", title: brief.goal.slice(0, 120), audience: brief.audience, theme: "atlas_light", slides };
}
