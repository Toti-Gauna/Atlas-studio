"use client";
import { Activity, Boxes, Columns2, Pencil, RefreshCw, UserRound } from "lucide-react";
import type { Message } from "@atlas/contracts";
import { modelName, relativeTime } from "@/lib/format";
import { usePanel } from "@/lib/state/panel";
import { Badge, Button, CitationChip, ModeBadge } from "@/components/ui";
import s from "./chat.module.css";

export function MessageItem({
  m,
  onHandoff,
  onRegenerate,
  onEdit,
  onCompare,
  handoffPending,
  hasOpenTicket,
}: {
  m: Message;
  onHandoff: () => void;
  onRegenerate: (m: Message) => void;
  onEdit: (m: Message) => void;
  onCompare: (m: Message) => void;
  handoffPending: boolean;
  hasOpenTicket: boolean;
}) {
  const { open } = usePanel();
  if (m.role === "system_notice") return <div className={s.notice} role="note">{m.content}</div>;
  if (m.role === "user") {
    return (
      <div className={s.msg} style={{ alignItems: "flex-end" }}>
        <div className={s.msgUser}>{m.content}</div>
        <div className={s.msgActions}>
          <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => onEdit(m)}>
            Edit as branch
          </Button>
        </div>
      </div>
    );
  }
  return (
    <article className={s.msg} aria-label="Assistant answer">
      <div className={s.msgMeta}>
        {m.mode ? <ModeBadge mode={m.mode} /> : null}
        {m.modelKey ? <span>{modelName(m.modelKey)}</span> : null}
        <span aria-hidden>·</span>
        <time dateTime={m.createdAt}>{relativeTime(m.createdAt)}</time>
        {m.retrieval ? (
          <span className={s.retrieval} title="Retrieval trace">
            coverage {m.retrieval.topScore ?? 0} / threshold {m.retrieval.threshold} · {m.retrieval.decision}
          </span>
        ) : null}
      </div>
      <div className={`${s.msgAssistant} ${m.abstained ? s.msgAbstained : ""}`}>
        {m.abstained ? <Badge tone="warn">No supporting evidence · abstained</Badge> : null}
        <div className={s.msgBody} style={{ marginTop: m.abstained ? 8 : 0 }}>
          {m.content}
        </div>
        {m.citations.length ? (
          <div className={s.chips} style={{ marginTop: 12 }} aria-label="Sources">
            {m.citations.map((c, i) => (
              <CitationChip key={c.id} index={i + 1} citation={c} onOpen={() => open({ kind: "evidence", citations: m.citations, activeIndex: i, messageId: m.id })} />
            ))}
          </div>
        ) : null}
        {m.artifactIds.length ? (
          <div className={s.chips} style={{ marginTop: 10 }}>
            {m.artifactIds.map((id) => (
              <Button key={id} size="sm" variant="secondary" icon={<Boxes size={13} />} onClick={() => open({ kind: "canvas", artifactId: id })}>
                Open deliverable in canvas
              </Button>
            ))}
          </div>
        ) : null}
        {m.abstained ? (
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="primary" icon={<UserRound size={14} />} loading={handoffPending} disabled={hasOpenTicket} onClick={onHandoff}>
              {hasOpenTicket ? "Ticket open — a person will reply" : "Ask a person"}
            </Button>
          </div>
        ) : null}
      </div>
      <div className={s.msgActions}>
        {m.runId ? (
          <Button size="sm" variant="ghost" icon={<Activity size={13} />} onClick={() => open({ kind: "run", runId: m.runId! })}>
            Run trace
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={() => onRegenerate(m)}>
          Regenerate as branch
        </Button>
        <Button size="sm" variant="ghost" icon={<Columns2 size={13} />} onClick={() => onCompare(m)}>
          Compare models
        </Button>
      </div>
    </article>
  );
}
