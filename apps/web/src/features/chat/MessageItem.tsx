"use client";
import { Fragment } from "react";
import { Activity, Boxes, ChevronDown, Columns2, Copy, FileText, MoreHorizontal, Pencil, Presentation, RefreshCw, Table2, UserRound } from "lucide-react";
import type { Citation, Message } from "@atlas/contracts";
import { modelName, relativeTime, formatDateTime } from "@/lib/format";
import { usePanel } from "@/lib/state/panel";
import { chatCopy } from "@/copy/chat";
import { Badge, Button, CitationChip, ModeBadge } from "@/components/ui";
import { MenuItem, Popover } from "./Menu";
import type { DeliverableKind } from "./deliverableFromAnswer";
import s from "./chat.module.css";

const m$ = chatCopy.message;
const cr = chatCopy.create;

export interface CreatedDeliverable {
  id: string;
  kind: DeliverableKind;
}

/** Answer text with inline [S1] markers turned into buttons that open the evidence panel. */
function AnswerText({ text, citations, onCite }: { text: string; citations: Citation[]; onCite: (i: number) => void }) {
  const parts = text.split(/(\[S\d{1,3}\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const hit = /^\[S(\d{1,3})\]$/.exec(p);
        const idx = hit ? Number(hit[1]) - 1 : -1;
        const cit = idx >= 0 ? citations[idx] : undefined;
        if (!cit) return <Fragment key={i}>{p}</Fragment>;
        return (
          <button key={i} type="button" className={s.inlineCite} onClick={() => onCite(idx)} aria-label={m$.openSource(idx + 1, cit.documentTitle)} title={`${cit.documentTitle} · v${cit.version}${cit.page ? ` · p. ${cit.page}` : ""}`}>
            S{idx + 1}
          </button>
        );
      })}
    </>
  );
}

const KIND_LABEL: Record<DeliverableKind, string> = { report: cr.report, table: cr.table, presentation: cr.deck };

export function MessageItem({
  m,
  defaultModelKey,
  onHandoff,
  onRegenerate,
  onEdit,
  onCompare,
  onCopy,
  onCreate,
  creating,
  created,
  canCreate,
  canCompare,
  handoffPending,
  hasOpenTicket,
}: {
  m: Message;
  defaultModelKey: string | null;
  onHandoff: () => void;
  onRegenerate: (m: Message) => void;
  onEdit: (m: Message) => void;
  onCompare: (m: Message) => void;
  onCopy: (m: Message) => void;
  onCreate: (m: Message, kind: DeliverableKind) => void;
  creating: DeliverableKind | null;
  created: CreatedDeliverable[];
  canCreate: boolean;
  canCompare: boolean;
  handoffPending: boolean;
  hasOpenTicket: boolean;
}) {
  const { open } = usePanel();
  if (m.role === "system_notice") return <div className={s.notice} role="note">{m.content}</div>;
  if (m.role === "user") {
    return (
      <div className={`${s.msg} ${s.msgUserRow}`}>
        <div className={s.msgUser}>{m.content}</div>
        <div className={`${s.msgActions} ${s.subtle}`}>
          <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => onEdit(m)}>
            {m$.editQuestion}
          </Button>
        </div>
      </div>
    );
  }
  const openEvidence = (i: number) => open({ kind: "evidence", citations: m.citations, activeIndex: i, messageId: m.id });
  const cited = m.citations.length > 0 && !m.abstained;
  const showModel = m.modelKey !== null && m.modelKey !== defaultModelKey;
  const deliverables: Array<{ id: string; kind?: DeliverableKind }> = [...m.artifactIds.map((id) => ({ id })), ...created];

  return (
    <article className={s.msg} aria-label={m$.answer}>
      <div className={`${s.msgAssistant} ${m.abstained ? s.msgAbstained : ""}`}>
        <div className={s.msgMeta}>
          {m.abstained ? <Badge tone="warn">{m$.notEnough}</Badge> : cited ? <span className={s.evidenceLabel}>{m$.backedBy(new Set(m.citations.map((c) => c.documentId)).size)}</span> : null}
          {showModel && m.mode ? <ModeBadge mode={m.mode} /> : null}
          {showModel ? <span>{modelName(m.modelKey!)}</span> : null}
          <time dateTime={m.createdAt} title={formatDateTime(m.createdAt)} className={s.msgTime}>
            {relativeTime(m.createdAt)}
          </time>
        </div>
        <div className={s.msgBody}>
          <AnswerText text={m.content} citations={m.citations} onCite={openEvidence} />
        </div>
        {m.citations.length ? (
          <div className={s.chips} aria-label={m$.sources}>
            {m.citations.map((c, i) => (
              <CitationChip key={c.id} index={i + 1} citation={c} onOpen={() => openEvidence(i)} />
            ))}
          </div>
        ) : null}
        {deliverables.length ? (
          <div className={s.chips}>
            {deliverables.map((d) => (
              <Button key={d.id} size="sm" variant="secondary" icon={<Boxes size={13} />} onClick={() => open({ kind: "canvas", artifactId: d.id })}>
                {d.kind ? `${m$.openDeliverable} · ${KIND_LABEL[d.kind]}` : m$.openDeliverable}
              </Button>
            ))}
          </div>
        ) : null}
        {m.abstained ? (
          <div>
            <Button size="sm" variant="primary" icon={<UserRound size={14} />} loading={handoffPending} disabled={hasOpenTicket} onClick={onHandoff}>
              {hasOpenTicket ? m$.ticketOpen : m$.askPerson}
            </Button>
          </div>
        ) : null}
      </div>
      <div className={s.msgActions}>
        {cited && canCreate ? (
          <Popover
            kind="menu"
            label={cr.menu}
            trigger={(p) => (
              <Button size="sm" variant="secondary" icon={<FileText size={13} />} loading={creating !== null} {...p}>
                {creating ? cr.creating : cr.label}
                <ChevronDown size={13} aria-hidden />
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon={<FileText size={15} />} hint={cr.reportHint} onSelect={() => { close(); onCreate(m, "report"); }}>
                  {cr.report}
                </MenuItem>
                <MenuItem icon={<Table2 size={15} />} hint={cr.tableHint} onSelect={() => { close(); onCreate(m, "table"); }}>
                  {cr.table}
                </MenuItem>
                <MenuItem icon={<Presentation size={15} />} hint={cr.deckHint} onSelect={() => { close(); onCreate(m, "presentation"); }}>
                  {cr.deck}
                </MenuItem>
              </>
            )}
          </Popover>
        ) : null}
        <Popover
          kind="menu"
          label={m$.more}
          trigger={(p) => (
            <button type="button" className={s.moreBtn} aria-label={m$.more} title={m$.more} {...p}>
              <MoreHorizontal size={16} aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <>
              {m.content ? (
                <MenuItem icon={<Copy size={15} />} onSelect={() => { close(); onCopy(m); }}>
                  {m$.copy}
                </MenuItem>
              ) : null}
              <MenuItem icon={<RefreshCw size={15} />} onSelect={() => { close(); onRegenerate(m); }}>
                {m$.regenerate}
              </MenuItem>
              <MenuItem icon={<Columns2 size={15} />} disabled={!canCompare} hint={canCompare ? undefined : m$.compareUnavailable} onSelect={() => { close(); onCompare(m); }}>
                {m$.compare}
              </MenuItem>
              {m.runId ? (
                <MenuItem icon={<Activity size={15} />} onSelect={() => { close(); open({ kind: "run", runId: m.runId! }); }}>
                  {m$.runTrace}
                </MenuItem>
              ) : null}
            </>
          )}
        </Popover>
      </div>
    </article>
  );
}

