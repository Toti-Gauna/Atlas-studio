"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Plus } from "lucide-react";
import type { AgentSummary } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { AgentGlyph, Badge, EmptyState, LinkButton, PageHeader, QueryState } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import s from "./agents.module.css";

/** Card: name, one line and the main action. Model, version and tools live in the detail. */
function AgentCard({ a, canChat }: { a: AgentSummary; canChat: boolean }) {
  return (
    <li className={s.agentCard}>
      <div className={s.cardTop}>
        <AgentGlyph profile={a.profile} size={40} teal={!a.builtIn} />
        <div className={s.cardHead}>
          <Link href={`/app/agent/?id=${a.id}`} className={s.cardName}>
            {a.name}
          </Link>
          {!a.builtIn ? <Badge tone="violet">{c.gallery.custom}</Badge> : null}
        </div>
      </div>
      <p className={s.cardDesc}>{a.description || "—"}</p>
      <div className={s.cardActions}>
        {canChat ? (
          <LinkButton size="sm" variant="secondary" href={`/app/chat/?new=1&agent=${a.id}`} icon={<MessageSquarePlus size={14} aria-hidden />}>
            {c.gallery.useInChat}
            <span className="sr-only"> — {a.name}</span>
          </LinkButton>
        ) : null}
        <LinkButton size="sm" variant="ghost" href={`/app/agent/?id=${a.id}`}>
          {c.gallery.details}
          <span className="sr-only"> — {a.name}</span>
        </LinkButton>
      </div>
    </li>
  );
}

export function AgentsView() {
  const canWrite = useCan("agent.write");
  const canChat = useCan("conversation.use");
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const create = canWrite ? (
    <LinkButton href="/app/agent/?new=1" variant="primary" icon={<Plus size={14} aria-hidden />}>
      {c.gallery.create}
    </LinkButton>
  ) : null;

  return (
    <Page wide>
      <PageHeader title={c.gallery.title} description={c.gallery.description} actions={create} />
      <QueryState query={agents} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.gallery.emptyTitle} body={c.gallery.emptyBody} action={create} />}>
        {(list) => (
          <ul className={s.gallery} aria-label={c.gallery.listCaption}>
            {[...list]
              .sort((x, y) => Number(y.builtIn) - Number(x.builtIn) || x.name.localeCompare(y.name))
              .map((a) => (
                <AgentCard key={a.id} a={a} canChat={canChat} />
              ))}
          </ul>
        )}
      </QueryState>
    </Page>
  );
}
