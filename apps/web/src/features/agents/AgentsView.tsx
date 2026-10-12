"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import type { AgentSummary } from "@atlas/contracts";
import { api } from "@/lib/api";
import { modelName, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { AgentGlyph, Badge, Callout, Card, DemoTag, EmptyState, LinkButton, PageHeader, QueryState } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import s from "./agents.module.css";

function AgentCard({ a }: { a: AgentSummary }) {
  return (
    <li>
      <Link href={`/app/agent/?id=${a.id}`} className={s.galleryCard}>
        <div className={s.cardTop}>
          <AgentGlyph profile={a.profile} size={40} teal={!a.builtIn} />
          <div style={{ minWidth: 0 }}>
            <span className={s.cardName}>{a.name}</span>
            <span className={s.cardMeta}>{c.profile[a.profile] ?? a.profile}</span>
          </div>
        </div>
        <p className={s.cardDesc}>{a.description || "—"}</p>
        <div className={s.badges}>
          {a.builtIn ? <Badge>{c.gallery.builtIn}</Badge> : <Badge tone="violet">{c.gallery.custom}</Badge>}
          {a.label === "DEMO" ? <DemoTag /> : null}
          <Badge>{c.style[a.style]}</Badge>
          <Badge tone="info">{modelName(a.modelKey)}</Badge>
          <Badge>{c.gallery.tools(a.allowedTools.length)}</Badge>
          <Badge mono>v{a.currentVersion}</Badge>
        </div>
        <span className={s.cardFoot}>Updated {relativeTime(a.updatedAt)}</span>
      </Link>
    </li>
  );
}

export function AgentsView() {
  const canWrite = useCan("agent.write");
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const create = canWrite ? (
    <LinkButton href="/app/agent/?new=1" variant="primary" icon={<Plus size={14} aria-hidden />}>
      {c.gallery.create}
    </LinkButton>
  ) : null;

  return (
    <Page wide>
      <PageHeader eyebrow={c.gallery.eyebrow} title={c.gallery.title} description={c.gallery.description} actions={create} />

      <Card className={s.explain} aria-labelledby="agents-explain-h">
        <h2 id="agents-explain-h" className={s.explainTitle}>
          {c.gallery.explainTitle}
        </h2>
        <ul className={s.explainList}>
          {c.gallery.explain.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <Callout tone="teal" icon={<ShieldCheck size={16} aria-hidden />}>
          {c.gallery.explainGuard}
        </Callout>
      </Card>

      <QueryState query={agents} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.gallery.emptyTitle} body={c.gallery.emptyBody} action={create} />}>
        {(list) => (
          <ul className={s.gallery} aria-label={c.gallery.listCaption}>
            {[...list]
              .sort((x, y) => Number(y.builtIn) - Number(x.builtIn) || x.name.localeCompare(y.name))
              .map((a) => (
                <AgentCard key={a.id} a={a} />
              ))}
          </ul>
        )}
      </QueryState>
    </Page>
  );
}
