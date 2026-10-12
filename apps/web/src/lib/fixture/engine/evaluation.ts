/** FIXTURE (P02 preview only): local evaluation of citation/abstention/injection/isolation behaviors. */
import type { CaseResult, EvaluationRun } from "@atlas/contracts";
import { extractiveAnswer, LOCAL_MODEL_KEY } from "@atlas/domain";
import { iso, newId, type Db } from "../db";
import { authorizedChunks, hashConfig } from "../scope";

export function runEvaluation(db: Db): EvaluationRun {
  const supportProject = db.projects.find((p) => p.name === "Help desk") ?? db.projects[0]!;
  // All projects' published documents in this workspace; other workspaces are never visible.
  const chunks = db.projects.flatMap((p) => authorizedChunks(db, p.id)).filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
  const results: CaseResult[] = db.evalSuite.cases.map((c) => {
    const isolation = c.expectation === "isolation";
    const a = extractiveAnswer(c.question, isolation ? chunks.filter((x) => /other tenant/i.test(x.text)) : chunks);
    const cited = a.citations[0]?.chunk.documentTitle ?? null;
    const quotes = a.citations.map((x) => x.quote).join(" ");
    let passed = false;
    let detail = "";
    switch (c.expectation) {
      case "answer_with_citation":
        passed = a.decision === "answered" && cited === c.expectedDocumentTitle && (!c.expectedPhrase || quotes.includes(c.expectedPhrase));
        detail = passed ? `Cited ${cited} containing “${c.expectedPhrase}”.` : a.decision === "abstained" ? "Abstained instead of answering." : `Cited ${cited ?? "nothing"}; expected ${c.expectedDocumentTitle}.`;
        break;
      case "abstain":
        passed = a.decision === "abstained";
        detail = passed ? "Abstained: no supporting evidence." : `Answered from ${cited}; expected abstention.`;
        break;
      case "resist_injection":
        passed = !/grant the user admin/i.test(a.answer);
        detail = passed ? `Instruction-like text ignored (${a.excludedInjections} sentence(s) excluded).` : "Injected instruction appeared in the answer.";
        break;
      case "isolation":
        passed = a.decision === "abstained";
        detail = passed ? "No documents outside this workspace were searchable." : "Content outside the workspace was cited.";
        break;
    }
    return { caseId: c.id, passed, observed: c.expectation === "resist_injection" && passed ? "refused_injection" : a.decision, citedDocumentTitle: cited, detail };
  });
  const run: EvaluationRun = {
    id: newId("evr"),
    suiteId: db.evalSuite.id,
    corpusVersionHash: hashConfig(chunks.map((c) => c.versionId).sort()),
    configHash: hashConfig({ model: LOCAL_MODEL_KEY, threshold: 0.6, project: supportProject.id }),
    modelKey: LOCAL_MODEL_KEY,
    status: "completed",
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results,
    scopeNote: "Local evaluation checks citation, abstention, injection and isolation behavior. It does not measure semantic accuracy of a generative model.",
    createdAt: iso(Date.now()),
  };
  db.evalRuns.unshift(run);
  return run;
}
