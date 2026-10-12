"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, History, MessageSquarePlus, ShieldAlert } from "lucide-react";
import type { ConversationDetail, Message, Suggestion } from "@atlas/contracts";
import { api, isApiError, type SendMessageResult } from "@/lib/api";
import { relativeTime, modelName } from "@/lib/format";
import { useDraft } from "@/lib/state/drafts";
import { gsap, useReducedMotion } from "@/lib/motion";
import { Badge, Button, Callout, EmptyState, ErrorState, LoadingBlock, Select, Sheet, useToast } from "@/components/ui";
import { Composer, type ComposerHandle, type ComposerState } from "./Composer";
import { MessageItem } from "./MessageItem";
import { Recommendations } from "./Recommendations";
import { BranchDialog, CompareDialog, ServiceRequestDialog } from "./dialogs";
import s from "./chat.module.css";

const newKey = () => `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

function HistoryList({ activeId, onPick }: { activeId: string | null; onPick?: () => void }) {
  const q = useQuery({ queryKey: ["conversations", null], queryFn: () => api.conversations.list() });
  return (
    <>
      <div className={s.historyHead}>
        <span className="eyebrow">History</span>
        <Link href="/app/chat/?new=1" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--teal-ink)", textDecoration: "none", display: "inline-flex", gap: 4, alignItems: "center" }} onClick={onPick}>
          <MessageSquarePlus size={14} aria-hidden /> New
        </Link>
      </div>
      {q.isPending ? (
        <div style={{ padding: 12 }}><LoadingBlock rows={5} /></div>
      ) : q.isError ? (
        <div style={{ padding: 12 }}><ErrorState error={q.error} compact onRetry={() => void q.refetch()} /></div>
      ) : q.data.length === 0 ? (
        <p style={{ padding: 16, color: "var(--text-3)", fontSize: 14 }}>No conversations yet.</p>
      ) : (
        <ul className={s.historyList}>
          {q.data.map((c) => (
            <li key={c.id}>
              <Link href={`/app/chat/?c=${c.id}`} className={s.historyItem} aria-current={c.id === activeId ? "page" : undefined} onClick={onPick}>
                <span className={s.historyTitle}>
                  {c.title}
                  {c.hasOpenTicket ? <Badge tone="warn">ticket</Badge> : null}
                </span>
                <span className={s.historyMeta}>
                  {relativeTime(c.updatedAt)} · {c.branchCount > 1 ? `${c.branchCount} branches · ` : ""}
                  {c.lastMessagePreview}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Thread({ conv, onHandoff, handoffPending, onRegenerate, onEdit, onCompare }: { conv: ConversationDetail; onHandoff: () => void; handoffPending: boolean; onRegenerate: (m: Message) => void; onEdit: (m: Message) => void; onCompare: (m: Message) => void }) {
  const end = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const last = conv.messages.at(-1)?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
    const el = last ? document.getElementById(`msg-${last}`) : null;
    if (el && !reduced) gsap.from(el, { y: 8, opacity: 0, duration: 0.22, ease: "power2.out", clearProps: "transform,opacity" });
  }, [last, reduced]);
  return (
    <div className={s.threadInner}>
      {conv.messages.map((m) => (
        <div key={m.id} id={`msg-${m.id}`}>
          <MessageItem m={m} onHandoff={onHandoff} handoffPending={handoffPending} hasOpenTicket={conv.hasOpenTicket} onRegenerate={onRegenerate} onEdit={onEdit} onCompare={onCompare} />
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

export function ChatView() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const convId = params.get("c");
  const isNew = params.get("new") === "1" || !convId;
  const presetProject = params.get("project");
  const presetAgent = params.get("agent");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft, clearDraft] = useDraft(convId ?? `new:${presetProject ?? "any"}`);
  const [state, setState] = useState<ComposerState>({ agentId: presetAgent, pinnedModelKey: null, workMode: (params.get("mode") as ComposerState["workMode"]) ?? "answer", attachments: [] });
  const [blocked, setBlocked] = useState<SendMessageResult["blocked"]>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [branchFrom, setBranchFrom] = useState<Message | null>(null);
  const [service, setService] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const clientKey = useRef(newKey());
  /** Conversation created by a send that was then blocked (e.g. routing approval); reused on retry. */
  const createdRef = useRef<{ id: string; branchId: string } | null>(null);

  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const conv = useQuery({ queryKey: ["conversation", convId, branchId], queryFn: () => api.conversations.get(convId!, branchId ?? undefined), enabled: Boolean(convId) && !isNew });
  const [newProject, setNewProject] = useState<string | null>(presetProject);

  const projectId = conv.data?.projectId ?? newProject ?? projects.data?.[0]?.id ?? null;
  const project = projects.data?.find((p) => p.id === projectId);

  // The agent shown in the composer falls back to the conversation/project default until the user picks one.
  const agentId = state.agentId ?? conv.data?.agentId ?? project?.defaultAgentId ?? agents.data?.[0]?.id ?? null;
  const [branchFor, setBranchFor] = useState(convId);
  if (branchFor !== convId) {
    setBranchFor(convId);
    setBranchId(null);
  }

  const send = useMutation({
    mutationFn: async (approvalKey?: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      let id = convId;
      let activeBranch = conv.data?.activeBranchId;
      if (!id || isNew) {
        if (!createdRef.current) {
          const created = await api.conversations.create({ projectId: projectId!, agentId: agentId! });
          createdRef.current = { id: created.id, branchId: created.activeBranchId };
        }
        id = createdRef.current.id;
        activeBranch = createdRef.current.branchId;
      }
      return api.conversations.send(
        id!,
        {
          content: draft.trim(),
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
        setBlocked(r.blocked);
        if (r.conversation === null || !r.userMessage) {
          /* draft stays */
        }
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
      if (isApiError(e) && e.code === "CANCELLED") toast({ tone: "info", title: "Stopped", body: "Your message is kept in the composer. Resending reuses the same idempotency key, so nothing is duplicated." });
    },
  });

  const handoff = useMutation({
    mutationFn: () => api.conversations.handoff(convId!),
    onSuccess: (t) => {
      toast({ tone: "success", title: `Ticket #${t.number}`, body: "A person will reply. Context was preserved." });
      void qc.invalidateQueries({ queryKey: ["conversation", convId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => toast({ tone: "error", title: "Handoff failed", body: (e as Error).message }),
  });

  const branch = useMutation({
    mutationFn: (v: { from: Message; reason: "edit" | "regenerate"; text?: string }) => api.branches.create({ fromMessageId: v.from.id, reason: v.reason, editedContent: v.text, agentId: agentId ?? undefined, pinnedModelKey: state.pinnedModelKey }),
    onSuccess: (d) => {
      setBranchFrom(null);
      setBranchId(d.activeBranchId);
      qc.setQueryData(["conversation", convId, d.activeBranchId], d);
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ tone: "success", title: "New branch created", body: "The original branch is unchanged." });
    },
    onError: (e) => toast({ tone: "error", title: "Branch not created", body: (e as Error).message }),
  });

  const usePrepared = (sg: Suggestion) => {
    setDraft(sg.prompt);
    setState((st) => ({ ...st, agentId: sg.agentId ?? st.agentId, workMode: sg.workMode }));
    composerRef.current?.focus();
  };

  const lastUser = useMemo(() => [...(conv.data?.messages ?? [])].reverse().find((m) => m.role === "user"), [conv.data]);
  const agentList = agents.data ?? [];

  return (
    <div className={s.layout}>
      <aside className={s.history} aria-label="Conversation history">
        <HistoryList activeId={convId} />
      </aside>
      <section className={s.convo} aria-label="Conversation">
        <div className={s.convoHead}>
          <Button size="sm" variant="ghost" className={s.mobileHistoryBtn} icon={<History size={14} />} onClick={() => setHistoryOpen(true)}>
            History
          </Button>
          <h1 className={s.convoTitle}>{isNew ? "New conversation" : (conv.data?.title ?? "Conversation")}</h1>
          {isNew ? (
            <div style={{ minWidth: 200 }}>
              <Select label="Project" hideLabel value={projectId ?? ""} onChange={(e) => setNewProject(e.target.value)} options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
            </div>
          ) : conv.data ? (
            <>
              {project ? <Badge>{project.name}</Badge> : null}
              {conv.data.branches.length > 1 ? (
                <div style={{ minWidth: 170 }}>
                  <Select
                    label="Branch"
                    hideLabel
                    value={conv.data.activeBranchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    options={conv.data.branches.map((b) => ({ value: b.id, label: `${b.label} · ${modelName(b.modelKey)}` }))}
                  />
                </div>
              ) : null}
              <Button size="sm" variant="ghost" icon={<ClipboardList size={14} />} onClick={() => setService(true)}>
                Service request
              </Button>
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
              <EmptyState title="Start with a question or a deliverable" body="Answers quote authorized project sources with page and version. Without evidence, Atlas abstains and offers a person." />
              {projectId ? <Recommendations projectId={projectId} agentId={agentId ?? undefined} onUse={usePrepared} limit={3} /> : null}
            </div>
          ) : (
            <Thread
              conv={conv.data}
              onHandoff={() => handoff.mutate()}
              handoffPending={handoff.isPending}
              onRegenerate={(m) => branch.mutate({ from: m, reason: "regenerate" })}
              onEdit={(m) => setBranchFrom(m)}
              onCompare={() => setCompare(lastUser?.content ?? "")}
            />
          )}
        </div>
        <div className={s.composerWrap}>
          {blocked ? (
            <div className={s.approval}>
              <Callout tone="warn" icon={<ShieldAlert size={16} />}>
                <strong>Not sent.</strong> {blocked.message}
                {blocked.pendingFallback ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Button size="sm" variant="primary" loading={send.isPending} onClick={() => send.mutate(blocked.pendingFallback!.modelKey)}>
                      Approve {modelName(blocked.pendingFallback.modelKey)} for this message
                    </Button>
                    <span style={{ fontSize: 12 }}>
                      {blocked.pendingFallback.changesProvider ? "Changes provider. " : ""}
                      {blocked.pendingFallback.changesPrice ? "Changes price. " : ""}Nothing switches without your approval.
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 13 }}>Pick another model in the composer; your draft is kept.</div>
                )}
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
      <BranchDialog open={branchFrom !== null} onClose={() => setBranchFrom(null)} initial={branchFrom?.content ?? ""} pending={branch.isPending} onSubmit={(text) => branch.mutate({ from: branchFrom!, reason: "edit", text })} />
      {convId ? <ServiceRequestDialog open={service} onClose={() => setService(false)} conversationId={convId} /> : null}
    </div>
  );
}
