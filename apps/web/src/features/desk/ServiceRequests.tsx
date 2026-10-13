"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { deskCopy as c } from "@/copy/desk";
import { EmptyState, QueryState, StatusBadge, Table, numCell } from "@/components/ui";
import s from "./desk.module.css";

/** Service requests created only after a person confirmed a proposed action in chat. */
export function ServiceRequests() {
  const q = useQuery({ queryKey: ["service-requests"], queryFn: api.serviceRequests });
  return (
    <section aria-label={c.services.title}>
      <p className={s.intro}>{c.services.intro}</p>
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.services.empty} body={c.services.emptyBody} />}>
        {(list) => (
          <Table stack caption={c.services.caption}>
            <thead>
              <tr>
                <th scope="col">{c.services.title2}</th>
                <th scope="col" className={numCell}>{c.services.number}</th>
                <th scope="col">{c.services.category}</th>
                <th scope="col">{c.services.status}</th>
                <th scope="col">{c.services.createdBy}</th>
                <th scope="col">{c.services.created}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className={s.subject}>{r.title}</div>
                    <div className={s.muted}>{r.details}</div>
                  </td>
                  <td className={numCell} data-label={c.services.number}>{r.number}</td>
                  <td className={s.capitalize} data-label={c.services.category}>{r.category.replace(/_/g, " ")}</td>
                  <td data-label={c.services.status}>
                    <StatusBadge kind="service" status={r.status} />
                  </td>
                  <td data-label={c.services.createdBy}>{r.createdByName}</td>
                  <td className={s.nowrap} data-label={c.services.created} title={formatDateTime(r.createdAt)}>
                    {relativeTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryState>
    </section>
  );
}
