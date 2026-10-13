"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import type { Ticket } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useCan, useSession } from "@/lib/state/session";
import { deskCopy as c } from "@/copy/desk";
import { Badge, EmptyState, LinkButton, QueryState, Segmented, Select, StatusBadge, Switch, Table, numCell } from "@/components/ui";
import { ServiceRequests } from "./ServiceRequests";
import { isHighPriority } from "./tones";
import s from "./desk.module.css";

type StatusFilter = Ticket["status"] | "all" | "needs";
type View = "tickets" | "services";
const NEEDS: ReadonlySet<Ticket["status"]> = new Set(["open", "pending_customer"]);

/** Support tickets handed off to a person (Inbox › Support, or "My tickets" for customers). */
export function SupportSection() {
  const { data: session } = useSession();
  const isOperator = useCan("ticket.inbox");
  const isCustomer = session?.role === "customer";
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: api.tickets.list });
  const [status, setStatus] = useState<StatusFilter>(isOperator ? "needs" : "all");
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<View>("tickets");

  const me = session?.user.id;
  const all = tickets.data ?? [];
  const filtered = all
    .filter((t) => (status === "all" || (status === "needs" ? NEEDS.has(t.status) : t.status === status)) && (!mine || t.assigneeId === me))
    .sort((a, b) => Number(NEEDS.has(b.status)) - Number(NEEDS.has(a.status)) || b.updatedAt.localeCompare(a.updatedAt));
  const unanswered = all.filter((t) => t.status === "open").length;
  const unassigned = all.filter((t) => NEEDS.has(t.status) && !t.assigneeId).length;

  const ticketsBlock = (
    <>
      {isOperator ? (
        <div className={s.filters} role="group" aria-label={c.filters.label}>
          <div className={s.statusFilter}>
            <Select
              label={c.filters.status}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              options={[{ value: "needs", label: c.filters.needs }, { value: "all", label: c.filters.all }, ...Object.entries(c.status).map(([value, label]) => ({ value, label }))]}
            />
          </div>
          <div className={s.switchWrap}>
            <Switch label={c.filters.mine} checked={mine} onChange={setMine} />
          </div>
        </div>
      ) : null}

      <QueryState
        query={tickets}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title={isCustomer ? c.emptyMine : c.empty}
            body={isCustomer ? c.emptyMineBody : c.emptyBody}
            action={isCustomer ? <LinkButton href="/app/chat/?new=1" variant="primary" icon={<MessageSquarePlus size={14} aria-hidden />}>{c.emptyCta}</LinkButton> : null}
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState title={c.empty} body={c.emptyBody} />
          ) : (
            <Table stack caption={c.table.caption}>
              <thead>
                <tr>
                  <th scope="col">{c.table.subject}</th>
                  <th scope="col" className={numCell}>{c.table.number}</th>
                  {!isCustomer ? <th scope="col">{c.table.requester}</th> : null}
                  <th scope="col">{c.table.status}</th>
                  <th scope="col">{c.table.assignee}</th>
                  <th scope="col">{c.table.updated}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/app/ticket/?id=${t.id}`} className={s.subject}>
                        {t.subject}
                      </Link>
                      {isHighPriority(t.priority) ? (
                        <>
                          {" "}
                          <Badge tone="danger">{c.highPriority}</Badge>
                        </>
                      ) : null}
                    </td>
                    <td className={numCell} data-label={c.table.number}>{t.number}</td>
                    {!isCustomer ? <td data-label={c.table.requester}>{t.requesterName}</td> : null}
                    <td data-label={c.table.status}>
                      <StatusBadge kind="ticket" status={t.status} />
                    </td>
                    <td data-label={c.table.assignee}>{t.assigneeName ?? <span className={s.muted}>{c.table.unassigned}</span>}</td>
                    <td className={s.nowrap} data-label={c.table.updated} title={formatDateTime(t.updatedAt)}>
                      {relativeTime(t.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
    </>
  );

  if (isCustomer) return ticketsBlock;

  return (
    <>
      <div className={s.supportHead}>
        {isOperator && tickets.data ? <p className={s.summary}>{c.summary(unanswered, unassigned)}</p> : null}
        <Segmented<View> label={c.views.label} value={view} onChange={setView} options={[{ value: "tickets", label: c.views.tickets }, { value: "services", label: c.views.services }]} />
      </div>
      {view === "tickets" ? ticketsBlock : <ServiceRequests />}
    </>
  );
}
