import { beforeEach, describe, expect, it } from "vitest";
import { ArtifactContent, type ArtifactDetail, type ConversationDetail, type Project, type Session } from "@atlas/contracts";
import { fixtureTransport, resetFixture } from "../src/lib/fixture/transport";
import { previewState } from "../src/lib/fixture/preview";
import type { SendMessageResult } from "../src/lib/api/client";
import { deliverableFromAnswer, type DeliverableKind } from "../src/features/chat/deliverableFromAnswer";
import { nativeFormat, otherFormats } from "../src/features/artifacts/formats";
import { chatCopy } from "../src/copy/chat";

const T = fixtureTransport;

async function ask(projectName: string, question: string, key: string) {
  const projects = await T.request<Project[]>("GET", "/projects");
  const p = projects.find((x) => x.name === projectName)!;
  const conv = await T.request<ConversationDetail>("POST", "/conversations", { body: { projectId: p.id, agentId: p.defaultAgentId } });
  const r = await T.request<SendMessageResult>("POST", `/conversations/${conv.id}/messages`, {
    body: { content: question, branchId: conv.activeBranchId, agentId: p.defaultAgentId, pinnedModelKey: null, workMode: "answer", attachmentDocumentIds: [], clientMessageId: key },
  });
  return { project: p, answer: r.assistantMessage! };
}

describe("cited answer → deliverable (N01)", () => {
  beforeEach(async () => {
    resetFixture();
    previewState.set({ forced: "none", latencyMs: 0, localAdapterOnline: true });
    await T.request<Session>("POST", "/demo/sessions", { body: { role: "admin" } });
  });

  it.each<DeliverableKind>(["report", "table", "presentation"])("creates a valid %s that keeps every citation's version and page", async (kind) => {
    const question = "How long do approved refunds take?";
    const { project, answer } = await ask("Help desk", question, `client-msg-${kind}`);
    expect(answer.citations.length).toBeGreaterThan(0);
    const d = deliverableFromAnswer(kind, question, answer);
    expect(ArtifactContent.safeParse(d.content).success).toBe(true);
    expect(d.sources.map((s) => [s.documentTitle, s.version, s.page])).toEqual(answer.citations.map((c) => [c.documentTitle, c.version, c.page]));
    const art = await T.request<ArtifactDetail>("POST", "/artifacts", { body: { projectId: project.id, title: d.title, content: d.content, sources: d.sources } });
    expect(art.type).toBe(kind);
    expect(art.currentVersion).toBe(1);
    expect(art.current.sources).toHaveLength(answer.citations.length);
    const file = await T.download(`/artifacts/${art.id}/versions/1/export`, { query: { format: nativeFormat(d.content) } });
    expect(file.blob.size).toBeGreaterThan(0);
  });

  it("offers no CSV or JSON for decks", () => {
    const deck = deliverableFromAnswer("presentation", "Q", { content: "“A” [S1]", citations: [] });
    expect(nativeFormat(deck.content)).toBe("pptx");
    expect(otherFormats(deck.content)).not.toContain("csv");
    expect(otherFormats(deck.content)).not.toContain("json");
  });

  it("example questions in an empty chat get a cited answer", async () => {
    const names: Record<string, string> = { prj_support: "Help desk", prj_compliance: "Vendor security review", prj_deck: "Leadership update deck" };
    let i = 0;
    for (const [pid, name] of Object.entries(names)) {
      for (const q of chatCopy.examples[pid] ?? []) {
        const { answer } = await ask(name, q, `client-msg-ex-${i++}`);
        expect(answer.abstained, `${name}: ${q}`).toBe(false);
        expect(answer.citations.length, `${name}: ${q}`).toBeGreaterThan(0);
      }
    }
    // The analysis project answers from its CSV with computed figures (no passages to cite).
    for (const q of chatCopy.examples.prj_analysis ?? []) {
      const { answer } = await ask("Q3 shipping performance", q, `client-msg-ex-${i++}`);
      expect(answer.abstained, q).toBe(false);
      expect(answer.content.length, q).toBeGreaterThan(0);
    }
  });
});
