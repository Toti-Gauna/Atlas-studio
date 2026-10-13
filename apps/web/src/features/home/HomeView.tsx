"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUp, Compass, Inbox, MessageSquareText, Wallet, X } from "lucide-react";
import type { Suggestion } from "@atlas/contracts";
import { api } from "@/lib/api";
import { money, plural, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { readPref, writePref } from "@/lib/state/prefs";
import { homeCopy as c } from "@/copy/home";
import { Page } from "@/components/shell/StudioShell";
import { ArtifactIcon, projectColor, Button, Card, ErrorState, IconButton, LinkButton, LoadingBlock, Meter, SectionHead, Skeleton } from "@/components/ui";
import { Recommendations } from "@/features/chat/Recommendations";
import { tourSteps } from "@/features/showcase/tourSteps";
import { useInbox } from "@/features/inbox/useInbox";
import s from "./home.module.css";

const noopSubscribe = () => () => {};

/** Sends straight to chat: the conversation opens with the answer already running. */
function useAsk() {
  const router = useRouter();
  return (projectId: string, prompt: string, opts: { mode?: string; agentId?: string | null } = {}) => {
    const q = new URLSearchParams({ new: "1", project: projectId, mode: opts.mode ?? "answer", send: "1", q: prompt });
    if (opts.agentId) q.set("agent", opts.agentId);
    router.push(`/app/chat/?${q.toString()}`);
  };
}

function StartHere({ onDismiss, ask }: { onDismiss: () => void; ask: ReturnType<typeof useAsk> }) {
  const scenarios = useQuery({ queryKey: ["demo-scenarios"], queryFn: api.demo.scenarios });
  return (
    <section className={s.start} aria-labelledby="start-h">
      <div className={s.startHead}>
        <h2 id="start-h" className={s.startTitle}>
          {c.start.title}
        </h2>
        <IconButton label={c.start.dismiss} size="sm" onClick={onDismiss}>
          <X size={16} />
        </IconButton>
      </div>
      <div className={s.startGrid}>
        <div>
          <h3 className={s.startSub}>{c.start.questionsTitle}</h3>
          <p className={s.startHint}>{c.start.questionsHint}</p>
          <ul className={s.list}>
            {c.examples.map((ex) => (
              <li key={ex.text}>
                <button type="button" className={s.example} onClick={() => ask(ex.project, ex.text)}>
                  <MessageSquareText size={16} aria-hidden />
                  <span>{ex.text}</span>
                  <ArrowRight size={14} aria-hidden className={s.exampleArrow} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={s.startSub}>{c.start.toursTitle}</h3>
          <p className={s.startHint}>{c.start.toursHint}</p>
          {scenarios.isPending ? (
            <LoadingBlock rows={3} />
          ) : scenarios.isError ? (
            <ErrorState error={scenarios.error} compact onRetry={() => void scenarios.refetch()} />
          ) : (
            <ul className={s.list}>
              {scenarios.data.map((sc) => (
                <li key={sc.id}>
                  <Link href={tourSteps(sc)[0]?.href ?? "/app/showcase/"} className={s.example}>
                    <Compass size={16} aria-hidden />
                    <span>
                      <span className={s.tourTitle}>{sc.title}</span>
                      <span className={s.tourSummary}>{sc.summary}</span>
                    </span>
                    <span className={s.exampleCta}>{c.start.tourStart}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/showcase/" className={s.more}>
            {c.start.allTours}
          </Link>
        </div>
      </div>
    </section>
  );
}

function useHomeProject() {
  const canProjects = useCan("project.read");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: canProjects });
  const [projectId, setProjectId] = useState<string | null>(null);
  const project = projects.data?.find((p) => p.id === projectId) ?? projects.data?.[0];
  return { projects, project, setProjectId };
}

function Composer({ ask, home }: { ask: ReturnType<typeof useAsk>; home: ReturnType<typeof useHomeProject> }) {
  const { projects, project, setProjectId } = home;
  const [text, setText] = useState("");
  const submit = () => {
    if (project && text.trim()) ask(project.id, text.trim(), { agentId: project.defaultAgentId });
  };
  return (
    <Card className={s.quick}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="home-ask" className="sr-only">
          {c.askLabel}
        </label>
        <textarea
          id="home-ask"
          className={s.quickInput}
          placeholder={project ? c.placeholder(project.name) : c.askLabel}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
        />
        <div className={s.quickBar}>
          {projects.data ? (
            <label className={s.projectPick}>
              <span className={s.projectPickLabel}>{c.projectLabel}</span>
              <select value={project?.id ?? ""} onChange={(e) => setProjectId(e.target.value)}>
                {projects.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Skeleton lines={1} />
          )}
          <span className={s.quickHint}>{c.askHint}</span>
          <Button type="submit" variant="primary" icon={<ArrowUp size={14} aria-hidden />} disabled={!project}>
            {c.ask}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Suggestions({ ask, project }: { ask: ReturnType<typeof useAsk>; project: ReturnType<typeof useHomeProject>["project"] }) {
  return project ? <ProjectSuggestions projectId={project.id} projectName={project.name} agentId={project.defaultAgentId} ask={ask} /> : null;
}

function ProjectSuggestions({ projectId, projectName, agentId, ask }: { projectId: string; projectName: string; agentId: string | null; ask: ReturnType<typeof useAsk> }) {
  const use = (sg: Suggestion) => ask(projectId, sg.prompt, { mode: sg.workMode, agentId: sg.agentId ?? agentId });
  return (
    <section aria-labelledby="reco-h" className={s.suggestions}>
      <h2 id="reco-h" className={s.suggestionsTitle}>
        {c.suggestions(projectName)}
      </h2>
      <Recommendations projectId={projectId} agentId={agentId ?? undefined} onUse={use} actionLabel={(sg) => (sg.workMode === "draft_artifact" ? "Draft it" : sg.workMode === "plan_then_run" ? "Plan it" : "Ask")} limit={3} />
    </section>
  );
}

function Attention() {
  const inbox = useInbox();
  const canUsage = useCan("usage.read");
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: api.budgets.list, enabled: canUsage });
  const ws = budgets.data?.find((b) => b.scope === "workspace");
  if (!inbox.tabs.length && !ws) return null;
  return (
    <section aria-labelledby="attn-h">
      <SectionHead id="attn-h" title={c.attention} />
      <div className={s.attn}>
        {inbox.tabs.length ? (
          <Link href="/app/inbox/" className={s.attnRow}>
            <Inbox size={16} aria-hidden /> {c.inboxRow}
            <span className={inbox.total ? s.countOn : s.countOff}>{inbox.total}</span>
          </Link>
        ) : null}
        {ws ? (
          <Link href="/app/usage/" className={s.attnRow} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Wallet size={16} aria-hidden /> {c.budget}
              <span style={{ marginLeft: "auto" }} className="tabular">
                {money(ws.spentNanoUsd)} / {money(ws.limitNanoUsd)}
              </span>
            </span>
            <Meter value={Number(BigInt(ws.spentNanoUsd) / 1_000_000n)} max={Number(BigInt(ws.limitNanoUsd) / 1_000_000n)} label="Workspace budget used" />
            <span className={s.rowMeta}>{c.budgetNote(ws.unknownCostEntries)}</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function ProjectList() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  return (
    <section aria-labelledby="proj-h">
      <SectionHead id="proj-h" title={c.projects} aside={<Link href="/app/projects/">{c.all}</Link>} />
      {projects.isPending ? (
        <LoadingBlock rows={3} />
      ) : projects.isError ? (
        <ErrorState error={projects.error} compact onRetry={() => void projects.refetch()} />
      ) : (
        <ul className={s.list}>
          {projects.data.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Link href={`/app/project/?id=${p.id}`} className={s.projectRow}>
                <span className={s.dot} style={{ background: projectColor(p.color) }} aria-hidden />
                <span style={{ minWidth: 0 }}>
                  <span className={s.rowTitle}>{p.name}</span>
                  <span className={s.rowMeta}>
                    {plural(p.documentCount, "source")} · {plural(p.conversationCount, "conversation")} · {plural(p.artifactCount, "deliverable")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentConversations() {
  const conversations = useQuery({ queryKey: ["conversations", null], queryFn: () => api.conversations.list() });
  const recent = useMemo(() => (conversations.data ?? []).slice(0, 4), [conversations.data]);
  if (!recent.length) return null;
  return (
    <section aria-labelledby="recent-h">
      <SectionHead id="recent-h" title={c.continue} />
      <ul className={s.list}>
        {recent.map((cv) => (
          <li key={cv.id}>
            <Link href={`/app/chat/?c=${cv.id}`} className={s.projectRow}>
              <span style={{ minWidth: 0 }}>
                <span className={s.rowTitle}>{cv.title}</span>
                <span className={s.rowMeta}>
                  {relativeTime(cv.updatedAt)} · {cv.lastMessagePreview}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ViewerHome() {
  const artifacts = useQuery({ queryKey: ["artifacts", null], queryFn: () => api.artifacts.list() });
  return (
    <Page wide>
      <h1 className={s.title}>{c.viewer.title}</h1>
      <p className={s.lead}>{c.viewer.lead}</p>
      <div className={s.grid}>
        <section aria-labelledby="dlv-h" className={s.mainCol}>
          <SectionHead id="dlv-h" title={c.viewer.deliverables} aside={<Link href="/app/artifacts/">{c.all}</Link>} />
          {artifacts.isPending ? (
            <LoadingBlock rows={4} />
          ) : artifacts.isError ? (
            <ErrorState error={artifacts.error} compact onRetry={() => void artifacts.refetch()} />
          ) : (
            <ul className={s.list}>
              {artifacts.data.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link href={`/app/artifact/?id=${a.id}`} className={s.projectRow}>
                    <ArtifactIcon type={a.type} size={16} />
                    <span style={{ minWidth: 0 }}>
                      <span className={s.rowTitle}>{a.title}</span>
                      <span className={s.rowMeta}>
                        v{a.currentVersion} · {relativeTime(a.updatedAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className={s.sideCol}>
          <ProjectList />
        </aside>
      </div>
    </Page>
  );
}

export function HomeView() {
  const canChat = useCan("conversation.use");
  const canProjects = useCan("project.read");
  const ask = useAsk();
  const home = useHomeProject();
  const router = useRouter();
  const dismissedStored = useSyncExternalStore(noopSubscribe, () => readPref("local", "home.startHidden") === "1", () => false);
  const [dismissed, setDismissed] = useState(false);
  const hideStart = dismissed || dismissedStored;

  if (!canProjects) {
    return (
      <Page>
        <h1 className={s.title}>{c.customer.title}</h1>
        <p className={s.lead}>{c.customer.lead}</p>
        <div className={s.customerActions}>
          <Button variant="primary" onClick={() => router.push("/app/chat/?new=1")}>
            {c.customer.ask}
          </Button>
          <LinkButton href="/app/inbox/">{c.customer.tickets}</LinkButton>
        </div>
      </Page>
    );
  }
  if (!canChat) return <ViewerHome />;

  return (
    <Page wide>
      <h1 className={s.title}>{c.title}</h1>
      <div className={s.grid}>
        <div className={s.mainCol}>
          <Composer ask={ask} home={home} />
          {!hideStart ? (
            <StartHere
              ask={ask}
              onDismiss={() => {
                setDismissed(true);
                writePref("local", "home.startHidden", "1");
              }}
            />
          ) : null}
          <Suggestions ask={ask} project={home.project} />
        </div>
        <aside className={s.sideCol}>
          <Attention />
          <RecentConversations />
          <ProjectList />
        </aside>
      </div>
    </Page>
  );
}
