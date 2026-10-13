"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Brain, FolderPlus, MessageSquarePlus, Plus } from "lucide-react";
import type { ConversationSummary, Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { gsap, MOTION, useGSAP, useReducedMotion } from "@/lib/motion";
import { Page } from "@/components/shell/StudioShell";
import { Badge, Button, EmptyState, PageHeader, QueryState } from "@/components/ui";
import { projectsCopy as P } from "@/copy/projects";
import { NewProjectModal } from "./NewProjectModal";
import { ProjectDot, newChatHref } from "./projectBits";
import s from "./projects.module.css";

function ProjectCard({ p, latest, canChat }: { p: Project; latest: ConversationSummary | undefined; canChat: boolean }) {
  const lastActivity = latest && latest.updatedAt > p.updatedAt ? latest.updatedAt : p.updatedAt;
  return (
    <li className={s.card} data-card>
      <Link href={`/app/project/?id=${p.id}`} className={s.cardLink}>
        <span className={s.cardHead}>
          <ProjectDot color={p.color} />
          <span className={s.cardTitle}>{p.name}</span>
        </span>
        <span className={s.objective}>{p.objective || P.list.noObjective}</span>
      </Link>
      <dl className={s.counts}>
        <div>
          <dt>{P.list.counts.sources}</dt>
          <dd className="tabular">{p.documentCount}</dd>
        </div>
        <div>
          <dt>{P.list.counts.conversations}</dt>
          <dd className="tabular">{p.conversationCount}</dd>
        </div>
        <div>
          <dt>{P.list.counts.deliverables}</dt>
          <dd className="tabular">{p.artifactCount}</dd>
        </div>
      </dl>
      <div className={s.cardFoot}>
        <span className={s.updated}>{P.list.lastActivity(relativeTime(lastActivity))}</span>
        {!p.memoryEnabled ? (
          <Badge icon={<Brain size={12} aria-hidden />}>{P.list.memoryOff}</Badge>
        ) : null}
        {canChat ? (
          latest ? (
            <Link href={`/app/chat/?c=${latest.id}`} className={s.continue} aria-label={P.list.continueLabel(latest.title)}>
              {P.list.continue}
              <ArrowRight size={14} aria-hidden />
            </Link>
          ) : (
            <Link href={newChatHref(p)} className={s.continue}>
              <MessageSquarePlus size={14} aria-hidden />
              {P.list.start}
            </Link>
          )
        ) : null}
      </div>
    </li>
  );
}

export function ProjectsView() {
  const canWrite = useCan("project.write");
  const canChat = useCan("conversation.use");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const conversations = useQuery({ queryKey: ["conversations", null], queryFn: () => api.conversations.list(), enabled: canChat });
  const latestByProject = useMemo(() => {
    const m = new Map<string, ConversationSummary>();
    // The list comes newest first; keep the first per project.
    for (const c of conversations.data ?? []) if (!m.has(c.projectId)) m.set(c.projectId, c);
    return m;
  }, [conversations.data]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      if (reduced || !projects.data?.length) return;
      gsap.from("[data-card]", { y: 8, opacity: 0, duration: MOTION.reco, stagger: 0.04, ease: MOTION.ease, clearProps: "transform,opacity" });
    },
    { scope: ref, dependencies: [projects.data?.length, reduced] },
  );
  const newBtn = canWrite ? (
    <Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
      {P.list.newProject}
    </Button>
  ) : null;

  return (
    <Page wide>
      <PageHeader title={P.list.title} description={P.list.description} actions={newBtn} />
      <QueryState
        query={projects}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={<FolderPlus size={22} />} title={P.list.emptyTitle} body={canWrite ? P.list.emptyBody : P.list.emptyReadOnly} />}
      >
        {(list) => (
          <ul className={s.grid} ref={ref} aria-label={P.list.caption}>
            {list.map((p) => (
              <ProjectCard key={p.id} p={p} latest={latestByProject.get(p.id)} canChat={canChat} />
            ))}
          </ul>
        )}
      </QueryState>
      {canWrite ? <NewProjectModal open={open} onClose={() => setOpen(false)} /> : null}
    </Page>
  );
}

