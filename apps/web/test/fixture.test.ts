import { beforeEach, describe, expect, it } from "vitest";
import { fixtureTransport, resetFixture } from "../src/lib/fixture/transport";
import { previewState } from "../src/lib/fixture/preview";
import type { ConversationDetail, Project, Session, Ticket, UsageReport } from "@atlas/contracts";
import type { SendMessageResult } from "../src/lib/api/client";

const T = fixtureTransport;

describe("fixture transport (P02 preview)", () => {
  beforeEach(async () => {
    resetFixture();
    previewState.set({ forced: "none", latencyMs: 0, localAdapterOnline: true });
    await T.request<Session>("POST", "/demo/sessions", { body: { role: "admin" } });
  });

  it("requires a session", async () => {
    await T.request("POST", "/auth/logout");
    await expect(T.request("GET", "/projects")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("seeds 4 projects, 6 built-in agents and evaluation results", async () => {
    const projects = await T.request<Project[]>("GET", "/projects");
    expect(projects).toHaveLength(4);
    const agents = await T.request<unknown[]>("GET", "/agents");
    expect(agents).toHaveLength(6);
    const suites = await T.request<Array<{ runs: Array<{ passed: number; total: number }> }>>("GET", "/evaluations/suites");
    expect(suites[0]!.runs[0]!.total).toBe(12);
    expect(suites[0]!.runs[0]!.passed).toBe(12);
  });

  it("answers with citations, abstains without evidence, and sends idempotently", async () => {
    const projects = await T.request<Project[]>("GET", "/projects");
    const support = projects.find((p) => p.name === "Help desk")!;
    const conv = await T.request<ConversationDetail>("POST", "/conversations", { body: { projectId: support.id, agentId: support.defaultAgentId } });
    const send = (content: string, key: string) =>
      T.request<SendMessageResult>("POST", `/conversations/${conv.id}/messages`, { body: { content, branchId: conv.activeBranchId, agentId: support.defaultAgentId, pinnedModelKey: null, workMode: "answer", attachmentDocumentIds: [], clientMessageId: key } });
    const a = await send("How long do approved refunds take?", "client-msg-0001");
    expect(a.assistantMessage!.citations[0]!.documentTitle).toBe("Refund & Cancellation Policy");
    const again = await send("How long do approved refunds take?", "client-msg-0001");
    expect(again.assistantMessage!.id).toBe(a.assistantMessage!.id);
    const b = await send("Do you offer carbon offsets?", "client-msg-0002");
    expect(b.assistantMessage!.abstained).toBe(true);
    const t1 = await T.request<Ticket>("POST", `/conversations/${conv.id}/handoff`);
    const t2 = await T.request<Ticket>("POST", `/conversations/${conv.id}/handoff`);
    expect(t1.id).toBe(t2.id);
  });

  it("blocks an unconnected pinned model instead of switching silently", async () => {
    const projects = await T.request<Project[]>("GET", "/projects");
    const p = projects[0]!;
    const conv = await T.request<ConversationDetail>("POST", "/conversations", { body: { projectId: p.id, agentId: p.defaultAgentId } });
    const r = await T.request<SendMessageResult>("POST", `/conversations/${conv.id}/messages`, { body: { content: "Is data encrypted at rest?", branchId: conv.activeBranchId, agentId: p.defaultAgentId, pinnedModelKey: "anthropic:claude-opus-5-5", workMode: "answer", attachmentDocumentIds: [], clientMessageId: "client-msg-0003" } });
    expect(r.blocked?.code).toBe("MODEL_UNAVAILABLE");
    expect(r.assistantMessage).toBeNull();
  });

  it("enforces roles server-side", async () => {
    await T.request("POST", "/demo/sessions/role", { body: { role: "viewer" } });
    await expect(T.request("GET", "/usage", { query: { range: "30d", groupBy: "model" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(T.request("POST", "/projects", { body: { name: "x", objective: "", defaultAgentId: null } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("usage report separates unknown cost and local entries", async () => {
    const r = await T.request<UsageReport>("GET", "/usage", { query: { range: "30d", groupBy: "model" } });
    expect(r.label).toBe("DEMO");
    expect(r.totals.unknownCostEntries).toBeGreaterThan(0);
    expect(BigInt(r.totals.calculatedNanoUsd)).toBeGreaterThan(0n);
  });

  it("exports a real PPTX for the seeded deck", async () => {
    const arts = await T.request<Array<{ id: string; type: string; currentVersion: number }>>("GET", "/artifacts");
    const deck = arts.find((a) => a.type === "presentation")!;
    const file = await T.download(`/artifacts/${deck.id}/versions/${deck.currentVersion}/export`, { query: { format: "pptx" } });
    expect(file.filename).toMatch(/\.pptx$/);
    const head = new Uint8Array(await file.blob.arrayBuffer()).slice(0, 2);
    expect(String.fromCharCode(...head)).toBe("PK");
  });

  it("workflow resumes from checkpoint without duplicating its artifact", async () => {
    const before = (await T.request<unknown[]>("GET", "/artifacts")).length;
    await T.request("POST", "/workflow-runs/wfr_seed_csv/resume");
    let run: { status: string } = { status: "running" };
    for (let i = 0; i < 10 && run.status === "running"; i++) run = await T.request("GET", "/workflow-runs/wfr_seed_csv");
    expect(run.status).toBe("succeeded");
    const after = (await T.request<unknown[]>("GET", "/artifacts")).length;
    expect(after).toBe(before + 1);
    await T.request("POST", "/workflow-runs/wfr_seed_csv/resume");
    expect((await T.request<unknown[]>("GET", "/artifacts")).length).toBe(after);
  });
});
