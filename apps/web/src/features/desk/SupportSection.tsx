"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import type { Ticket } from "@atlas/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useCan, useSession } from "@/lib/state/session";
import { deskCopy as c } from "@/copy/desk";
import { Badge, EmptyState, LinkButton, QueryState, Select, Switch, Table, numCell } from "@/components/ui";
import { ServiceRequests } from "./ServiceRequests";
import { PRIORITY_TONE, STATUS_TONE } from "./tones";
import s from "./desk.module.css";

type StatusFilter = Ticket["status"] | "all";

/** Support tickets handed off to a person (Inbox › Support, or "My tickets" for customers). */
export function SupportSection() {
  const { data: session } = useSession();
  const isOperator = useCan("ticket.inbox");
  const isCustomer = session?.role === "customer";
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: api.tickets.list });
  const [status, setStatus] = useState<StatusFilter>(isOperator ? "open" : "all");
  const [mine, setMine] = useState(false);

  const me = session?.user.id;
  const filtered = (tickets.data ?? [])
    .filter((t) => (status === "all" || t.status === status) && (!mine || t.assigneeId === me))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>

      {isOperator ? (
        <div className={s.filters} role="group" aria-label={c.filters.label}>
          <Select
            label={c.filters.status}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            options={[{ value: "all", label: c.filters.all }, ...Object.entries(c.status).map(([value, label]) => ({ value, label }))]}
          />
          <Switch label={c.filters.mine} checked={mine} onChange={setMine} />
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
            <Table caption={c.table.caption}>
              <thead>
                <tr>
                  <th scope="col" className={numCell}>{c.table.number}</th>
                  <th scope="col">{c.table.subject}</th>
                  {!isCustomer ? <th scope="col">{c.table.requester}</th> : null}
                  <th scope="col">{c.table.status}</th>
                  <th scope="col">{c.table.priority}</th>
                  <th scope="col">{c.table.assignee}</th>
                  <th scope="col">{c.table.updated}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className={numCell}>{t.number}</td>
                    <td>
                      <Link href={`/app/ticket/?id=${t.id}`} className={s.subject}>
                        {t.subject}
                      </Link>
                    </td>
                    {!isCustomer ? <td>{t.requesterName}</td> : null}
                    <td><Badge tone={STATUS_TONE[t.status]} dot>{c.status[t.status]}</Badge></td>
                    <td><Badge tone={PRIORITY_TONE[t.priority]}>{c.priority[t.priority]}</Badge></td>
                    <td>{t.assigneeName ?? <span className={s.muted}>{c.table.unassigned}</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }} title={t.updatedAt}>{relativeTime(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>

      {!isCustomer ? <ServiceRequests /> : null}
    </>
  );
}
