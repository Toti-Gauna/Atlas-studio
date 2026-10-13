"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList, History, MessageSquarePlus, MoreHorizontal, ShieldAlert } from "lucide-react";
import type { ConversationDetail, Message, Suggestion, WorkMode } from "@atlas/contracts";
import { api, isApiError, type SendMessageResult } from "@/lib/api";
import { relativeTime, modelName } from "@/lib/format";
import { useDraft } from "@/lib/state/drafts";
import { usePanel } from "@/lib/state/panel";
import { useCan } from "@/lib/state/session";
import { gsap, useReducedMotion } from "@/lib/motion";
import { chatCopy as cc } from "@/copy/chat";
import { Badge, Button, Callout, ErrorState, LoadingBlock, Select, Sheet, TechDetails, useToast } from "@/components/ui";
import { Composer, type ComposerHandle, type ComposerState } from "./Composer";
import { MessageItem, type CreatedDeliverable } from "./MessageItem";
import { Recommendations } from "./Recommendations";
import { MenuItem, Popover } from "./Menu";
import { CompareDialog, EditQuestionDialog, ServiceRequestDialog } from "./dialogs";
import { deliverableFromAnswer, type DeliverableKind } from "./deliverableFromAnswer";
import s from "./chat.module.css";

const newKey = () => `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const MODES: WorkMode[] = ["answer", "plan_then_run", "draft_artifact"];
const KIND_NAME: Record<DeliverableKind, string> = { report: cc.create.report, table: cc.create.table, presentation: cc.create.deck };

function HistoryList({ activeId, onPick }: { activeId: string | null; onPick?: () => void }) {
  const q = useQuery({ queryKey: ["conversations", null], queryFn: () => api.conversations.list() });
  return (
    <>
      <div className={s.historyHead}>
        <h2 className={s.historyHeading}>{cc.history.title}</h2>
        <Link href="/app/chat/?new=1" className={s.historyNew} onClick={onPick}>
          <MessageSquarePlus size={14} aria-hidden /> {cc.history.newChat}
        </Link>
      </div>
      {q.isPending ? (
        <div className={s.historyPad}><LoadingBlock rows={5} /></div>
      ) : q.isError ? (
        <div className={s.historyPad}><ErrorState error={q.error} compact onRetry={() => void q.refetch()} /></div>
      ) : q.data.length === 0 ? (
        <p className={s.historyEmpty}>{cc.history.empty}</p>
      ) : (
        <ul className={s.historyList}>
          {q.data.map((c) => (
            <li key={c.id}>
              <Link href={`/app/chat/?c=${c.id}`} className={s.historyItem} aria-current={c.id === activeId ? "page" : undefined} onClick={onPick}>
                <span className={s.historyTitle}>
                  <span className={s.ellipsis}>{c.title}</span>
                  {c.hasOpenTicket ? <Badge tone="warn">{cc.history.ticket}</Badge> : null}
                </span>
                <span className={s.historyMeta}>
                  <time dateTime={c.updatedAt}>{relativeTime(c.updatedAt)}</time>
                  {c.lastMessagePreview ? ` · ${c.lastMessagePreview}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type ThreadHandlers = Omit<Parameters<typeof MessageItem>[0], "m" | "created" | "creating"> & { created: Record<string, CreatedDeliverable[]>; creating: { id: string; kind: DeliverableKind } | null };

function Thread({ conv, handlers }: { conv: ConversationDetail; handlers: ThreadHandlers }) {
  const end = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const last = conv.messages.at(-1)?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
    const el = last ? document.getElementById(`msg-${last}`) : null;
    if (el && !reduced) gsap.from(el, { y: 8, opacity: 0, duration: 0.22, ease: "power2.out", clearProps: "transform,opacity" });
  }, [last, reduced]);
  const { created, creating, ...rest } = handlers;
  return (
    <div className={s.threadInner}>
      {conv.messages.map((m) => (
        <div key={m.id} id={`msg-${m.id}`}>
          <MessageItem m={m} {...rest} created={created[m.id] ?? []} creating={creating?.id === m.id ? creating.kind : null} />
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

/** The question an answer responds to: its parent message, or the closest earlier question. */
function questionFor(messages: Message[], answer: Message): string {
  const parent = messages.find((x) => x.id === answer.parentMessageId && x.role === "user");
  if (parent) return parent.content;
  const i = messages.findIndex((x) => x.id === answer.id);
  return [...messages.slice(0, i)].reverse().find((x) => x.role === "user")?.content ?? "";
}

function withCitations(m: Message): string {
  if (!m.citations.length) return m.content;
  const list = m.citations.map((c, i) => `[S${i + 1}] ${c.documentTitle}, v${c.version}${c.page ? `, p. ${c.page}` : ""} — “${c.quote}”`);
  return `${m.content}\n\n${cc.message.copySources}:\n${list.join("\n")}`;
}

export function ChatView() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { panel } = usePanel();
  const canWrite = useCan("artifact.write");
  const convId = params.get("c");
  const isNew = params.get("new") === "1" || !convId;
  const presetProject = params.get("project");
  const presetAgent = params.get("agent");
  const presetMode = params.get("mode") as WorkMode | null;
  const [branchId, setBranchId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft, clearDraft] = useDraft(convId ?? `new:${presetProject ?? "any"}`);
  const [state, setState] = useState<ComposerState>({ agentId: presetAgent, pinnedModelKey: null, workMode: presetMode && MODES.includes(presetMode) ? presetMode : "answer", attachments: params.get("attach") ? [params.get("attach")!] : [] });
  const [blocked, setBlocked] = useState<SendMessageResult["blocked"]>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [editFrom, setEditFrom] = useState<Message | null>(null);
  const [service, setService] = useState(false);
  const [created, setCreated] = useState<Record<string, CreatedDeliverable[]>>({});
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const clientKey = useRef(newKey());
  /** Conversation created by a send that was then blocked (e.g. routing approval); reused on retry. */
  const createdRef = useRef<{ id: string; branchId: string } | null>(null);

  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const conv = useQuery({ queryKey: ["conversation", convId, branchId], queryFn: () => api.conversations.get(convId!, branchId ?? undefined), enabled: Boolean(convId) && !isNew });
  const [newProject, setNewProject] = useState<string | null>(presetProject);

  const projectId = conv.data?.projectId ?? newProject ?? projects.data?.[0]?.id ?? null;
  const project = projects.data?.find((p) => p.id === projectId);

  // The agent shown in the composer falls back to the conversation/project default until the user picks one.
  const agentId = state.agentId ?? conv.data?.agentId ?? project?.defaultAgentId ?? agents.data?.[0]?.id ?? null;
  const agentList = agents.data ?? [];
  const defaultModelKey = agentList.find((a) => a.id === agentId)?.modelKey ?? null;
  const canCompare = (models.data ?? []).filter((m) => m.availability.mode !== "pending").length >= 2;
  const [branchFor, setBranchFor] = useState(convId);
  if (branchFor !== convId) {
    setBranchFor(convId);
    setBranchId(null);
  }

  const send = useMutation({
    mutationFn: async (vars?: { approvalKey?: string; content?: string }) => {
      const approvalKey = vars?.approvalKey;
      const controller = new AbortController();
      abortRef.current = controller;
      let id = convId;
      let activeBranch = conv.data?.activeBranchId;
      if (!id || isNew) {
        if (!createdRef.current) {
          const createdConv = await api.conversations.create({ projectId: projectId!, agentId: agentId! });
          createdRef.current = { id: createdConv.id, branchId: createdConv.activeBranchId };
        }
        id = createdRef.current.id;
        activeBranch = createdRef.current.branchId;
      }
      return api.conversations.send(
        id!,
        {
          content: (vars?.content ?? draft).trim(),
          branchId: branchId ?? activeBranch!,
          agentId: agentId!,
          pinnedModelKey: state.pinnedModelKey,
          workMode: state.workMode,
          attachmentDocumentIds: state.attachments,
          clientMessageId: clientKey.current,
          approvals: approvalKey ? { fallbackModelKey: approvalKey } : undefined,
        },
        controller.signal,
      );
    },
    onSuccess: (r) => {
      if (r.blocked) {
        // Nothing was sent: the draft stays in the composer.
        setBlocked(r.blocked);
        void qc.invalidateQueries({ queryKey: ["conversations"] });
        return;
      }
      setBlocked(null);
      createdRef.current = null;
      clearDraft();
      clientKey.current = newKey();
      qc.setQueryData(["conversation", r.conversation.id, null], r.conversation);
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["recommendations"] });
      void qc.invalidateQueries({ queryKey: ["artifacts"] });
      if (r.conversation.id !== convId) router.replace(`/app/chat/?c=${r.conversation.id}`);
      else void qc.invalidateQueries({ queryKey: ["conversation", convId] });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "CANCELLED") toast({ tone: "info", title: cc.toasts.stopped });
    },
  });

  // Home and suggestions send straight away (`send=1&q=…`): the first answer appears without a second click.
  const autoText = isNew && params.get("send") === "1" ? params.get("q") : null;
  const autoSent = useRef(false);
  const ready = Boolean(projectId && agentId);
  const { mutate: sendNow } = send;
  useEffect(() => {
    if (!autoText || autoSent.current || !ready) return;
    autoSent.current = true;
    setDraft(autoText);
    sendNow({ content: autoText });
    const q = new URLSearchParams(params.toString());
    q.delete("send");
    q.delete("q");
    router.replace(`/app/chat/?${q.toString()}`);
  }, [autoText, ready, sendNow, setDraft, params, router]);

  // `q` without `send=1` (e.g. "Ask about this document") only prefills the composer; nothing runs until the user sends.
  const prefillText = isNew && params.get("send") !== "1" ? params.get("q") : null;
  const prefilled = useRef(false);
  useEffect(() => {
    if (!prefillText || prefilled.current) return;
    prefilled.current = true;
    setDraft(prefillText);
    composerRef.current?.focus();
    const q = new URLSearchParams(params.toString());
    q.delete("q");
    router.replace(`/app/chat/?${q.toString()}`);
  }, [prefillText, setDraft, params, router]);

  /** Example questions count as sending: one click asks. */
  const ask = (text: string) => {
    setDraft(text);
    send.mutate({ content: text });
  };

  const handoff = useMutation({
    mutationFn: () => api.conversations.handoff(convId!),
    onSuccess: (t) => {
      toast({ tone: "success", title: cc.toasts.ticket(t.number), body: cc.toasts.ticketBody });
      void qc.invalidateQueries({ queryKey: ["conversation", convId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => toast({ tone: "error", title: cc.toasts.handoffFailed, body: (e as Error).message }),
  });

  const attempt = useMutation({
    mutationFn: (v: { from: Message; reason: "edit" | "regenerate"; text?: string }) => api.branches.create({ fromMessageId: v.from.id, reason: v.reason, editedContent: v.text, agentId: agentId ?? undefined, pinnedModelKey: state.pinnedModelKey }),
    onSuccess: (d, v) => {
      setEditFrom(null);
      setBranchId(d.activeBranchId);
      qc.setQueryData(["conversation", convId, d.activeBranchId], d);
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ tone: "success", title: v.reason === "edit" ? cc.toasts.edited : cc.toasts.regenerated, body: cc.toasts.versionHint });
    },
    onError: (e) => toast({ tone: "error", title: cc.toasts.notCreated, body: (e as Error).message }),
  });

  const create = useMutation({
    mutationFn: (v: { m: Message; kind: DeliverableKind }) => {
      const d = deliverableFromAnswer(v.kind, questionFor(conv.data?.messages ?? [], v.m), v.m);
      return api.artifacts.create({ projectId: projectId!, title: d.title, content: d.content, sources: d.sources });
    },
    onSuccess: (art, v) => {
      setCreated((prev) => ({ ...prev, [v.m.id]: [...(prev[v.m.id] ?? []), { id: art.id, kind: v.kind }] }));
      qc.setQueryData(["artifact", art.id], art);
      void qc.invalidateQueries({ queryKey: ["artifacts"] });
      toast({ tone: "success", title: cc.create.done(KIND_NAME[v.kind]), body: cc.create.doneBody });
    },
    onError: (e) => toast({ tone: "error", title: cc.create.failed, body: (e as Error).message }),
  });

  const copyAnswer = async (m: Message) => {
    try {
      await navigator.clipboard.writeText(withCitations(m));
      toast({ tone: "success", title: cc.message.copied });
    } catch (e) {
      toast({ tone: "error", title: cc.message.copyFailed, body: (e as Error).message });
    }
  };

  const usePrepared = (sg: Suggestion) => {
    setDraft(sg.prompt);
    setState((st) => ({ ...st, agentId: sg.agentId ?? st.agentId, workMode: sg.workMode }));
    composerRef.current?.focus();
  };

  const examples = projectId ? (cc.examples[projectId] ?? []) : [];
  const panelOpen = panel !== null;

  return (
    <div className={`${s.layout} ${panelOpen ? s.layoutPanel : ""}`}>
      <aside className={s.history} aria-label="Conversation history">
        <HistoryList activeId={convId} />
      </aside>
      <section className={s.convo} aria-label="Conversation">
        <div className={s.convoHead}>
          <Button size="sm" variant="ghost" className={s.historyBtn} icon={<History size={14} />} onClick={() => setHistoryOpen(true)}>
            {cc.history.open}
          </Button>
          <h1 className={s.convoTitle}>{isNew ? cc.head.newTitle : (conv.data?.title ?? cc.head.fallbackTitle)}</h1>
          {isNew ? (
            <div className={s.projectPick}>
              <Select label={cc.head.project} hideLabel value={projectId ?? ""} onChange={(e) => setNewProject(e.target.value)} options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
            </div>
          ) : conv.data ? (
            <>
              {project ? <span className={s.convoProject}>{project.name}</span> : null}
              {conv.data.branches.length > 1 ? (
                <label className={s.versionPick}>
                  <span>{cc.head.version}</span>
                  <select value={conv.data.activeBranchId} onChange={(e) => setBranchId(e.target.value)}>
                    {conv.data.branches.map((b, i) => (
                      <option key={b.id} value={b.id}>
                        {cc.head.versionLabel(i, b.reason)} · {modelName(b.modelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Popover
                kind="menu"
                align="end"
                label={cc.head.more}
                trigger={(p) => (
                  <button type="button" className={s.moreBtn} aria-label={cc.head.more} title={cc.head.more} {...p}>
                    <MoreHorizontal size={16} aria-hidden />
                  </button>
                )}
              >
                {(close) => (
                  <MenuItem icon={<ClipboardList size={15} />} onSelect={() => { close(); setService(true); }}>
                    {cc.head.serviceRequest}
                  </MenuItem>
                )}
              </Popover>
            </>
          ) : null}
        </div>
        <div className={s.thread}>
          {!isNew && conv.isPending ? (
            <div className={s.threadInner}><LoadingBlock rows={4} /></div>
          ) : !isNew && conv.isError ? (
            <div className={s.threadInner}><ErrorState error={conv.error} onRetry={() => void conv.refetch()} /></div>
          ) : isNew || !conv.data?.messages.length ? (
            <div className={s.empty}>
              <div>
                <h2 className={s.emptyTitle}>{cc.empty.title}</h2>
                {examples.length ? <p className={s.emptyLead}>{cc.empty.lead}</p> : null}
              </div>
              {examples.length ? (
                <ul className={s.examples} aria-label={cc.empty.examplesLabel}>
                  {examples.map((q) => (
                    <li key={q}>
                      <button type="button" className={s.example} disabled={!ready || send.isPending} onClick={() => ask(q)}>
                        <span>{q}</span>
                        <ArrowUpRight size={16} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {projectId ? (
                <section className={s.suggestions} aria-labelledby="chat-suggestions">
                  <h3 id="chat-suggestions" className={s.suggestionsHead}>{cc.empty.suggestions}</h3>
                  <Recommendations projectId={projectId} agentId={agentId ?? undefined} onUse={usePrepared} limit={3} />
                </section>
              ) : null}
            </div>
          ) : (
            <Thread
              conv={conv.data}
              handlers={{
                defaultModelKey,
                onHandoff: () => handoff.mutate(),
                handoffPending: handoff.isPending,
                hasOpenTicket: conv.data.hasOpenTicket,
                onRegenerate: (m) => attempt.mutate({ from: m, reason: "regenerate" }),
                onEdit: (m) => setEditFrom(m),
                onCompare: (m) => setCompare(questionFor(conv.data.messages, m)),
                onCopy: (m) => void copyAnswer(m),
                onCreate: (m, kind) => create.mutate({ m, kind }),
                creating: create.isPending && create.variables ? { id: create.variables.m.id, kind: create.variables.kind } : null,
                created,
                canCreate: canWrite && Boolean(projectId),
                canCompare,
              }}
            />
          )}
        </div>
        <div className={s.composerWrap}>
          {blocked ? (
            <div className={s.approval}>
              <Callout tone="warn" icon={<ShieldAlert size={16} />}>
                <strong>{cc.blocked.title}</strong> {cc.blocked.body}
                {blocked.pendingFallback ? (
                  <div className={s.approvalRow}>
                    <Button size="sm" variant="primary" loading={send.isPending} onClick={() => send.mutate({ approvalKey: blocked.pendingFallback!.modelKey })}>
                      {cc.blocked.approve(modelName(blocked.pendingFallback.modelKey))}
                    </Button>
                    <span className={s.approvalNote}>
                      {blocked.pendingFallback.changesProvider ? `${cc.blocked.changesProvider} ` : ""}
                      {blocked.pendingFallback.changesPrice ? `${cc.blocked.changesPrice} ` : ""}
                      {cc.blocked.approval}
                    </span>
                  </div>
                ) : (
                  <div className={s.approvalNote}>{cc.blocked.pickAnother}</div>
                )}
                <div className={s.approvalDetails}>
                  <TechDetails summary={cc.blocked.details}>{blocked.message}</TechDetails>
                </div>
              </Callout>
            </div>
          ) : null}
          {send.isError && !(isApiError(send.error) && send.error.code === "CANCELLED") ? (
            <div className={s.approval}><ErrorState error={send.error} compact onRetry={() => send.mutate(undefined)} /></div>
          ) : null}
          <Composer
            ref={composerRef}
            value={draft}
            onChange={(v) => {
              setDraft(v);
              if (blocked) setBlocked(null);
            }}
            state={{ ...state, agentId }}
            onState={(p) => {
              setState((st) => ({ ...st, ...p }));
              setBlocked(null);
            }}
            agents={agentList}
            projectId={projectId}
            pending={send.isPending}
            disabled={!projectId || !agentId}
            onSend={() => send.mutate(undefined)}
            onStop={() => abortRef.current?.abort()}
          />
        </div>
      </section>
      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} side="left" label="Conversation history">
        <HistoryList activeId={convId} onPick={() => setHistoryOpen(false)} />
      </Sheet>
      {convId && agentId ? <CompareDialog open={compare !== null} onClose={() => setCompare(null)} conversationId={convId} prompt={compare ?? ""} agentId={agentId} /> : null}
      <EditQuestionDialog open={editFrom !== null} onClose={() => setEditFrom(null)} initial={editFrom?.content ?? ""} pending={attempt.isPending} onSubmit={(text) => attempt.mutate({ from: editFrom!, reason: "edit", text })} />
      {convId ? <ServiceRequestDialog open={service} onClose={() => setService(false)} conversationId={convId} /> : null}
    </div>
  );
}
