"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Ticket } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useCan, useSession } from "@/lib/state/session";
import { deskCopy as c } from "@/copy/desk";
import { Page } from "@/components/shell/StudioShell";
import { Badge, Card, EmptyState, LinkButton, PageHeader, QueryState, Select, useToast } from "@/components/ui";
import { TicketThread } from "./TicketThread";
import { PRIORITY_TONE, STATUS_TONE } from "./tones";
import s from "./desk.module.css";

/** Shared success/error handling for status and assignment changes. */
function useTicketUpdate(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return (title: string) => ({
    onSuccess: (t: Ticket) => {
      qc.setQueryData(["ticket", id], t);
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      toast({ tone: "success" as const, title, body: `#${t.number}` });
    },
    onError: (e: Error) => toast({ tone: "error" as const, title: c.ticket.updateFailed, body: e.message }),
  });
}

function Controls({ ticket }: { ticket: Ticket }) {
  const members = useQuery({ queryKey: ["members"], queryFn: api.members });
  const opts = useTicketUpdate(ticket.id);
  const status = useMutation<Ticket, Error, Ticket["status"]>({ ...opts(c.ticket.statusSaved), mutationFn: (v) => api.tickets.status(ticket.id, v) });
  const assign = useMutation<Ticket, Error, string | null>({ ...opts(c.ticket.assigned), mutationFn: (v) => api.tickets.assign(ticket.id, v) });
  const staff = (members.data ?? []).filter((m) => m.role === "operator" || m.role === "admin");
  const hasCurrent = !ticket.assigneeId || staff.some((m) => m.user.id === ticket.assigneeId);
  return (
    <div className={s.controls}>
      <Select
        label={c.ticket.status}
        value={ticket.status}
        disabled={status.isPending}
        onChange={(e) => status.mutate(e.target.value as Ticket["status"])}
        options={Object.entries(c.status).map(([value, label]) => ({ value, label }))}
      />
      <Select
        label={c.ticket.assignee}
        value={ticket.assigneeId ?? ""}
        disabled={assign.isPending || members.isPending}
        hint={members.isError ? "Could not load members." : undefined}
        onChange={(e) => assign.mutate(e.target.value || null)}
        options={[
          { value: "", label: c.ticket.unassigned },
          ...staff.map((m) => ({ value: m.user.id, label: `${m.user.displayName} · ${m.role}` })),
          ...(hasCurrent ? [] : [{ value: ticket.assigneeId!, label: ticket.assigneeName ?? ticket.assigneeId! }]),
        ]}
      />
    </div>
  );
}

function Handoff({ ticket }: { ticket: Ticket }) {
  const h = ticket.handoffContext;
  return (
    <Card>
      <h2 className={s.h2}>{c.ticket.handoff}</h2>
      <dl className={s.handoff}>
        <dt>{c.ticket.lastQuestion}</dt>
        <dd><blockquote className={s.quote}>{h.lastQuestion}</blockquote></dd>
        <dt>{c.ticket.abstention}</dt>
        <dd>{h.abstentionReason ?? c.ticket.noAbstention}</dd>
        <dt>{c.ticket.cited}</dt>
        <dd>
          {h.citedDocuments.length ? (
            <ul className={s.cited}>
              {h.citedDocuments.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : (
            c.ticket.noCited
          )}
        </dd>
      </dl>
      <LinkButton href={`/app/chat/?c=${ticket.conversationId}`} size="sm" icon={<MessageSquare size={14} aria-hidden />}>
        {c.ticket.openConversation}
      </LinkButton>
    </Card>
  );
}

export function TicketView() {
  const id = useSearchParams().get("id");
  const { data: session } = useSession();
  const isOperator = useCan("ticket.inbox");
  const isCustomer = session?.role === "customer";
  const q = useQuery({ queryKey: ["ticket", id], queryFn: () => api.tickets.get(id!), enabled: Boolean(id) });
  const back = (
    <Link href="/app/inbox/" className={s.back}>
      <ArrowLeft size={14} aria-hidden /> {isCustomer ? c.ticket.backMine : c.ticket.back}
    </Link>
  );

  if (!id) {
    return (
      <Page>
        {back}
        <EmptyState title={c.ticket.missing} body={c.ticket.missingBody} action={<LinkButton href="/app/inbox/">{c.ticket.back}</LinkButton>} />
      </Page>
    );
  }

  return (
    <Page wide>
      {back}
      <QueryState query={q}>
        {(t) => (
          <>
            <PageHeader
              eyebrow={`Ticket #${t.number}`}
              title={t.subject}
              meta={
                <>
                  <Badge tone={STATUS_TONE[t.status]} dot>{c.status[t.status]}</Badge>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{c.ticket.priority}: {c.priority[t.priority]}</Badge>
                </>
              }
              description={`${c.ticket.requester}: ${t.requesterName} · ${c.ticket.opened} ${formatDateTime(t.createdAt)}`}
            />
            <div className={s.layout}>
              <TicketThread ticket={t} isCustomer={isCustomer} />
              <aside className={s.side}>
                <Card>
                  {isOperator ? (
                    <Controls ticket={t} />
                  ) : (
                    <>
                      <p><strong>{c.ticket.assignee}:</strong> {t.assigneeName ?? c.ticket.unassigned}</p>
                      <p className={s.muted} style={{ marginTop: 6 }}>{c.ticket.readOnlyCustomer}</p>
                    </>
                  )}
                </Card>
                <Handoff ticket={t} />
              </aside>
            </div>
          </>
        )}
      </QueryState>
    </Page>
  );
}
