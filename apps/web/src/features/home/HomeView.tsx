"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileCheck2, ShieldAlert, Wallet } from "lucide-react";
import type { Suggestion } from "@atlas/contracts";
import { api } from "@/lib/api";
import { displayTimeZone, money, relativeTime } from "@/lib/format";
import { useCan, useSession } from "@/lib/state/session";
import { setDraft } from "@/lib/state/drafts";
import { Page } from "@/components/shell/StudioShell";
import { Badge, Button, Card, DemoTag, ErrorState, LoadingBlock, Meter, SectionHead, Segmented, Skeleton } from "@/components/ui";
import { AgentPicker } from "@/features/chat/AgentPicker";
import { Recommendations } from "@/features/chat/Recommendations";
import s from "./home.module.css";

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: displayTimeZone() }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const DOT: Record<string, string> = { teal: "var(--teal)", violet: "var(--violet)", amber: "#E0A32B", slate: "#64748B" };

export function HomeView() {
  const router = useRouter();
  const { data: session } = useSession();
  const canProjects = useCan("project.read");
  const canUsage = useCan("usage.read");
  const canPrivacy = useCan("privacy.read");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: canProjects });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list, enabled: canProjects });
  const reviews = useQuery({ queryKey: ["reviews", "mine"], queryFn: () => api.reviews.list(true), enabled: canProjects });
  const privacy = useQuery({ queryKey: ["privacy-reviews"], queryFn: api.privacy.reviews, enabled: canPrivacy });
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: api.budgets.list, enabled: canProjects });
  const conversations = useQuery({ queryKey: ["conversations", null], queryFn: () => api.conversations.list() });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pickedAgent, setAgentId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const project = projects.data?.find((p) => p.id === projectId) ?? projects.data?.[0];
  const agentId = pickedAgent ?? project?.defaultAgentId ?? null;

  const go = (prompt: string, mode = "answer", agent = agentId) => {
    if (!project) return;
    setDraft(`new:${project.id}`, prompt);
    router.push(`/app/chat/?new=1&project=${project.id}${agent ? `&agent=${agent}` : ""}&mode=${mode}`);
  };
  const usePrepared = (sg: Suggestion) => go(sg.prompt, sg.workMode, sg.agentId ?? agentId);
  const ws = budgets.data?.find((b) => b.scope === "workspace");
  const openReviews = (reviews.data ?? []).filter((r) => r.status === "open" && r.reviewerId === session?.user.id).length;
  const pendingPrivacy = (privacy.data ?? []).filter((r) => r.status === "pending_review").length;
  const recent = useMemo(() => (conversations.data ?? []).slice(0, 4), [conversations.data]);

  if (!canProjects) {
    return (
      <Page>
        <h1 className={s.greet}>{greeting()}.</h1>
        <p className={s.lead}>As a customer you can ask questions about published policies and follow your tickets.</p>
        <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={() => router.push("/app/chat/?new=1")}>Ask a question</Button>
          <Button onClick={() => router.push("/app/inbox/")}>My tickets</Button>
        </div>
      </Page>
    );
  }

  return (
    <Page wide>
      <header className={s.head}>
        <div>
          <div className="eyebrow" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {session?.workspace.name} <DemoTag />
          </div>
          <h1 className={s.greet}>
            {greeting()}, {session?.user.displayName.split(" ")[0]}.
          </h1>
          <p className={s.lead}>Ask with evidence, hand the right agent a task, and keep every deliverable versioned and reviewable.</p>
        </div>
      </header>

      <div className={s.grid}>
        <div className={s.mainCol}>
          <Card className={s.quick}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <span className="eyebrow">Start in</span>
              {projects.data ? (
                <Segmented label="Project" value={project?.id ?? ""} onChange={(v) => { setProjectId(v); setAgentId(projects.data.find((p) => p.id === v)?.defaultAgentId ?? null); }} options={projects.data.map((p) => ({ value: p.id, label: p.name }))} />
              ) : <Skeleton lines={1} />}
            </div>
            <label htmlFor="home-ask" className="sr-only">Ask or describe a task</label>
            <textarea
              id="home-ask"
              className={s.quickInput}
              placeholder={project ? `Ask about “${project.name}” or describe a deliverable…` : "Ask about your sources…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                  e.preventDefault();
                  go(text);
                }
              }}
              rows={3}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>Opens the composer with your text — nothing runs until you send.</span>
              <Button variant="primary" icon={<ArrowRight size={14} />} disabled={!text.trim() || !project} onClick={() => go(text)}>
                Continue in chat
              </Button>
            </div>
          </Card>

          <section aria-labelledby="reco-h">
            <SectionHead id="reco-h" title="Suggested for this project" aside="Each card says why it appears" />
            {project ? <Recommendations projectId={project.id} agentId={agentId ?? undefined} onUse={usePrepared} /> : <LoadingBlock rows={1} />}
          </section>

          <section aria-labelledby="agents-h">
            <SectionHead id="agents-h" title="Agents" aside={<Link href="/app/agents/">Open Agent Studio</Link>} />
            {agents.isPending ? <LoadingBlock rows={2} /> : agents.isError ? <ErrorState error={agents.error} compact /> : <AgentPicker agents={agents.data.slice(0, 6)} value={agentId} onChange={setAgentId} label="Agent for the next task" />}
          </section>
        </div>

        <aside className={s.sideCol}>
          <section aria-labelledby="proj-h">
            <SectionHead id="proj-h" title="Recent projects" aside={<Link href="/app/projects/">All</Link>} />
            {projects.isPending ? (
              <LoadingBlock rows={3} />
            ) : projects.isError ? (
              <ErrorState error={projects.error} compact onRetry={() => void projects.refetch()} />
            ) : (
              <ul className={s.list}>
                {projects.data.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/project/?id=${p.id}`} className={s.projectRow}>
                      <span className={s.dot} style={{ background: DOT[p.color] }} aria-hidden />
                      <span style={{ minWidth: 0 }}>
                        <span className={s.rowTitle}>{p.name}</span>
                        <span className={s.rowMeta}>
                          {p.documentCount} sources · {p.conversationCount} chats · {p.artifactCount} deliverables
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="attn-h">
            <SectionHead id="attn-h" title="Needs attention" />
            <div className={s.attn}>
              <Link href="/app/reviews/" className={s.attnRow}>
                <FileCheck2 size={16} aria-hidden /> Reviews assigned to you <Badge tone={openReviews ? "info" : "neutral"}>{reviews.isPending ? "…" : openReviews}</Badge>
              </Link>
              {canPrivacy ? (
                <Link href="/app/privacy/" className={s.attnRow}>
                  <ShieldAlert size={16} aria-hidden /> Redaction reviews <Badge tone={pendingPrivacy ? "warn" : "neutral"}>{privacy.isPending ? "…" : pendingPrivacy}</Badge>
                </Link>
              ) : null}
              {ws && canUsage ? (
                <Link href="/app/usage/" className={s.attnRow} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Wallet size={16} aria-hidden /> Workspace budget (30 days)
                    <span style={{ marginLeft: "auto" }} className="tabular">
                      {money(ws.spentNanoUsd)} / {money(ws.limitNanoUsd)}
                    </span>
                  </span>
                  <Meter value={Number(BigInt(ws.spentNanoUsd) / 1_000_000n)} max={Number(BigInt(ws.limitNanoUsd) / 1_000_000n)} label="Workspace budget used" />
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>DEMO fixture usage · {ws.unknownCostEntries} entries with unknown cost not included</span>
                </Link>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="recent-h">
            <SectionHead id="recent-h" title="Continue" />
            <ul className={s.list}>
              {recent.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/chat/?c=${c.id}`} className={s.projectRow}>
                    <span style={{ minWidth: 0 }}>
                      <span className={s.rowTitle}>{c.title}</span>
                      <span className={s.rowMeta}>{relativeTime(c.updatedAt)} · {c.lastMessagePreview}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </Page>
  );
}
