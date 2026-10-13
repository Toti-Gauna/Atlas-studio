import type { ArtifactContent, Citation, ReportBlock, SourceRef } from "@atlas/contracts";
import { presentationFromBrief } from "@atlas/domain";
import { chatCopy } from "@/copy/chat";

export type DeliverableKind = "report" | "table" | "presentation";

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
/** Inline markers like “[S1]” become structured source refs in the deliverable. */
const stripMarkers = (t: string) => t.replace(/\s*\[S\d{1,3}\]/g, "").trim();

/**
 * Builds a deliverable from a cited answer without any model call: the answer
 * text and the exact cited passages, each keeping its document version and page.
 * Nothing is invented — the content is only rearranged into the chosen format.
 */
export function deliverableFromAnswer(kind: DeliverableKind, question: string, answer: { content: string; citations: Citation[] }): { title: string; content: ArtifactContent; sources: SourceRef[] } {
  const q = question.trim() || "Answer from chat";
  const title = clip(q, 120);
  const sources: SourceRef[] = answer.citations.map((c, i) => ({
    ref: `S${i + 1}`,
    documentId: c.documentId,
    versionId: c.versionId,
    version: c.version,
    documentTitle: c.documentTitle,
    page: c.page,
    quote: c.quote.slice(0, 600),
  }));
  const refs = sources.map((s) => s.ref);

  if (kind === "table") {
    return {
      title,
      sources,
      content: {
        type: "table",
        title,
        columns: [
          { key: "ref", label: "Ref", kind: "text" },
          { key: "document", label: "Document", kind: "text" },
          { key: "version", label: "Version", kind: "number" },
          { key: "page", label: "Page", kind: "number" },
          { key: "passage", label: "Cited passage", kind: "text" },
        ],
        rows: sources.map((s) => ({ ref: s.ref, document: s.documentTitle, version: s.version, page: s.page, passage: s.quote })),
        note: chatCopy.create.tableNote,
      },
    };
  }

  if (kind === "presentation") {
    const deck = presentationFromBrief(
      { audience: chatCopy.create.audience, goal: q, slideCount: Math.min(12, sources.length + 2) },
      sources.map((s) => ({ text: s.quote, ref: s.ref })),
    );
    return { title: deck.title, content: deck, sources };
  }

  // One paragraph per answer paragraph, each keeping the refs it cited (the preview and exports list the sources).
  const paragraphs = answer.content
    .split(/\n\s*\n/)
    .map((p) => ({ text: clip(stripMarkers(p), 6000), sourceRefs: [...p.matchAll(/\[(S\d{1,3})\]/g)].map((m) => m[1]!).filter((r) => refs.includes(r)) }))
    .filter((p) => p.text);
  // Answers without inline markers cite their sources as a whole: keep them on the first paragraph.
  const unmarked = paragraphs.every((p) => p.sourceRefs.length === 0);
  const blocks: ReportBlock[] = [
    { type: "heading", level: 1, text: clip(q, 200) },
    ...paragraphs.map((p, i): ReportBlock => ({ type: "paragraph", text: p.text, sourceRefs: unmarked && i === 0 ? refs : p.sourceRefs })),
    { type: "callout", tone: "info", text: chatCopy.create.note },
  ];
  return { title, sources, content: { type: "report", title, blocks } };
}
