import { describe, expect, it } from "vitest";
import { chunkPages, compareChecklist, extractiveAnswer, profileCsv, scanText, type ChunkInput } from "@atlas/domain";
import { CHECKLIST_ITEMS, SEED_CONVERSATIONS, SEED_DOCUMENTS, SEED_EVAL_CASES, shipmentsCsv } from "../src";

function corpusChunks(): ChunkInput[] {
  const out: ChunkInput[] = [];
  for (const d of SEED_DOCUMENTS) {
    const v = d.versions[d.versions.length - 1]!;
    if (v.status === "failed") continue;
    chunkPages(v.pages).forEach((c, i) => out.push({ id: `chk_${d.key}_${i}`, documentId: `doc_${d.key}`, versionId: `dv_${d.key}_${v.version}`, version: v.version, documentTitle: d.title, page: c.page, text: c.text }));
  }
  return out;
}

describe("seed corpus behaves as the evaluation expects", () => {
  const chunks = corpusChunks();
  for (const c of SEED_EVAL_CASES) {
    it(`${c.expectation}: ${c.question}`, () => {
      const a = extractiveAnswer(c.question, c.expectation === "isolation" ? [] : chunks);
      if (c.expectation === "answer_with_citation") {
        expect(a.decision).toBe("answered");
        expect(a.citations[0]!.chunk.documentTitle).toBe(c.document);
        expect(a.citations.map((x) => x.quote).join(" ")).toContain(c.phrase!);
      } else if (c.expectation === "resist_injection") {
        expect(a.answer.toLowerCase()).not.toContain("grant the user admin");
      } else {
        expect(a.decision).toBe("abstained");
      }
    });
  }

  it("seed conversations include both answered and abstained questions", () => {
    const decisions = SEED_CONVERSATIONS.map((c) => extractiveAnswer(c.questions[0]!, chunks).decision);
    expect(decisions.filter((d) => d === "abstained").length).toBeGreaterThanOrEqual(4);
    expect(decisions.filter((d) => d === "answered").length).toBeGreaterThanOrEqual(8);
  });

  it("checklist yields a mix of covered, partial and gaps", () => {
    const policy = chunks.filter((c) => c.documentTitle === "Data Retention Policy");
    const f = compareChecklist(CHECKLIST_ITEMS, policy);
    const by = (s: string) => f.filter((x) => x.status === s).length;
    expect(by("covered")).toBeGreaterThanOrEqual(6);
    expect(by("gap")).toBeGreaterThanOrEqual(2);
  });

  it("CSV is valid with one missing value", () => {
    const p = profileCsv(shipmentsCsv());
    expect(p.rowCount).toBe(120);
    expect(p.valid).toBe(true);
    expect(p.columns.find((c) => c.name === "on_time_pct")!.missing).toBe(1);
  });

  it("privacy detectors flag the runbook and refund policy", () => {
    const runbook = SEED_DOCUMENTS.find((d) => d.key === "incident")!.versions[0]!.pages.map((p) => p.text).join("\n");
    expect(scanText(runbook).map((f) => f.detector)).toEqual(expect.arrayContaining(["email", "phone", "api_secret"]));
    const refund = SEED_DOCUMENTS.find((d) => d.key === "refund")!.versions[0]!.pages.map((p) => p.text).join("\n");
    expect(scanText(refund).map((f) => f.detector)).toContain("iban");
  });
});
