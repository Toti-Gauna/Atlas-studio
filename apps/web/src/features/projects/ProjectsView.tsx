"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Brain, FolderPlus, Plus } from "lucide-react";
import type { Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { gsap, MOTION, useGSAP, useReducedMotion } from "@/lib/motion";
import { Page } from "@/components/shell/StudioShell";
import { Badge, Button, DemoTag, EmptyState, PageHeader, QueryState } from "@/components/ui";
import { projectsCopy as P } from "@/copy/projects";
import { NewProjectModal } from "./NewProjectModal";
import s from "./projects.module.css";

/** Project colors map to tokens only. */
export const PROJECT_DOT: Record<Project["color"], string> = { teal: "var(--teal)", violet: "var(--violet)", amber: "var(--warn)", slate: "var(--text-3)" };

function ProjectCard({ p }: { p: Project }) {
  return (
    <li className={s.card} data-card>
      <Link href={`/app/project/?id=${p.id}`} className={s.cardLink}>
        <span className={s.cardHead}>
          <span className={s.dot} style={{ background: PROJECT_DOT[p.color] }} aria-hidden />
          <span className={s.cardTitle}>{p.name}</span>
        </span>
        <span className={s.objective}>{p.objective || P.list.noObjective}</span>
      </Link>
      <dl className={s.counts}>
        <div>
          <dt>Sources</dt>
          <dd className="tabular">{p.documentCount}</dd>
        </div>
        <div>
          <dt>Chats</dt>
          <dd className="tabular">{p.conversationCount}</dd>
        </div>
        <div>
          <dt>Deliverables</dt>
          <dd className="tabular">{p.artifactCount}</dd>
        </div>
      </dl>
      <div className={s.cardFoot}>
        <Badge tone={p.memoryEnabled ? "teal" : "neutral"} icon={<Brain size={12} aria-hidden />}>
          {p.memoryEnabled ? P.list.memoryOn : P.list.memoryOff}
        </Badge>
        {p.label === "DEMO" ? <DemoTag /> : null}
        <span className={s.updated}>{relativeTime(p.updatedAt)}</span>
      </div>
    </li>
  );
}

export function ProjectsView() {
  const canWrite = useCan("project.write");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
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
      <PageHeader eyebrow={P.list.eyebrow} title={P.list.title} description={P.list.description} actions={newBtn} />
      <QueryState
        query={projects}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={<FolderPlus size={22} />} title={P.list.emptyTitle} body={canWrite ? P.list.emptyBody : P.list.emptyReadOnly} action={newBtn} />}
      >
        {(list) => (
          <ul className={s.grid} ref={ref} aria-label={P.list.caption}>
            {list.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </ul>
        )}
      </QueryState>
      {canWrite ? <NewProjectModal open={open} onClose={() => setOpen(false)} /> : null}
    </Page>
  );
}
