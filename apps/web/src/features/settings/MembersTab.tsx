"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/state/session";
import { Avatar, Badge, EmptyState, QueryState, SectionHead, Table } from "@/components/ui";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

export function MembersTab() {
  const members = useQuery({ queryKey: ["members"], queryFn: api.members });
  const { data: session } = useSession();
  return (
    <section aria-labelledby="mem-h" className={s.stack}>
      <SectionHead id="mem-h" title={c.members.heading} aside={c.members.note} />
      <QueryState query={members} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.members.empty} />}>
        {(list) => (
          <Table stack caption={c.members.caption}>
            <thead>
              <tr>
                <th scope="col">{c.members.member}</th>
                <th scope="col">{c.members.email}</th>
                <th scope="col">{c.members.role}</th>
                <th scope="col">{c.members.joined}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.user.id}>
                  <th scope="row">
                    <span className={s.person}>
                      <Avatar name={m.user.displayName} />
                      <span>{m.user.displayName}</span>
                      {m.user.id === session?.user.id ? <Badge tone="teal">{c.members.you}</Badge> : null}
                    </span>
                  </th>
                  <td data-label={c.members.email}>{m.user.email}</td>
                  <td data-label={c.members.role}>
                    <Badge tone="violet">{c.roles[m.role] ?? m.role}</Badge>
                  </td>
                  <td data-label={c.members.joined}>{formatDate(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryState>
    </section>
  );
}
