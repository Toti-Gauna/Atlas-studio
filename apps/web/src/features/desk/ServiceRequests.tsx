"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { deskCopy as c } from "@/copy/desk";
import { Badge, EmptyState, QueryState, SectionHead, Table, numCell } from "@/components/ui";
import s from "./desk.module.css";

/** Service requests created only after a person confirmed a proposed tool action. */
export function ServiceRequests() {
  const q = useQuery({ queryKey: ["service-requests"], queryFn: api.serviceRequests });
  return (
    <section aria-labelledby="sr-h" className={s.section}>
      <SectionHead id="sr-h" title={c.services.title} />
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.services.empty} body={c.services.emptyBody} />}>
        {(list) => (
          <Table caption={c.services.caption}>
            <thead>
              <tr>
                <th scope="col" className={numCell}>{c.services.number}</th>
                <th scope="col">{c.services.title2}</th>
                <th scope="col">{c.services.category}</th>
                <th scope="col">{c.services.status}</th>
                <th scope="col">{c.services.createdBy}</th>
                <th scope="col">{c.services.created}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className={numCell}>{r.number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div className={s.muted}>{r.details}</div>
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{r.category}</td>
                  <td><Badge tone={r.status === "done" ? "teal" : r.status === "in_progress" ? "info" : "neutral"}>{c.services.statusLabel[r.status] ?? r.status}</Badge></td>
                  <td>{r.createdByName}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{relativeTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryState>
    </section>
  );
}
