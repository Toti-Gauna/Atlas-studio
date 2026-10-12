"use client";
import { useQuery } from "@tanstack/react-query";
import { Brain, UserRound } from "lucide-react";
import type { Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Callout, Card, EmptyState, QueryState, SectionHead, Switch } from "@/components/ui";
import { projectsCopy as P } from "@/copy/projects";
import { AddMemoryForm, MemoryList } from "./MemoryList";
import { useProjectUpdate } from "./useProjectUpdate";
import s from "./projects.module.css";

const M = P.memory;

/**
 * R04: memory is opt-in, visible and scoped. Project context and personal
 * preferences are separate lists with separate queries — never merged.
 */
export function MemoryPanel({ project }: { project: Project }) {
  const canProject = useCan("project.write");
  const canMemory = useCan("memory.write");
  const toggle = useProjectUpdate(project.id, (p) => (p.memoryEnabled ? M.enabled : M.disabled));
  const projectKey = ["memories", project.id];
  const prefKey = ["memories", "user_preference"];
  const items = useQuery({ queryKey: projectKey, queryFn: () => api.memories.list({ projectId: project.id }) });
  const prefs = useQuery({ queryKey: prefKey, queryFn: () => api.memories.list({ scope: "user_preference" }) });
  const pending = items.data?.filter((m) => m.status === "proposed").length ?? 0;

  return (
    <div className={s.memoryGrid}>
      <section aria-labelledby="mem-project-h" className={s.memSection}>
        <Card>
          <SectionHead id="mem-project-h" title={<span className={s.eyebrowRow}><Brain size={16} aria-hidden /> {M.title}</span>} aside={pending ? `${pending} awaiting approval` : undefined} />
          <Switch label={M.toggle} description={M.explanation} checked={project.memoryEnabled} disabled={!canProject || toggle.isPending} onChange={(v) => toggle.mutate({ memoryEnabled: v })} />
          <div aria-live="polite" className={s.memNote}>
            {!project.memoryEnabled ? <Callout tone="neutral">{M.offNote}</Callout> : null}
          </div>
          {!canMemory ? <p className={s.footNote}>{M.readOnly}</p> : null}
        </Card>

        <QueryState query={items} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={<Brain size={22} />} title={M.emptyTitle} body={M.emptyBody} />}>
          {(list) => <MemoryList items={list} canWrite={canMemory} queryKey={projectKey} caption={M.listCaption} />}
        </QueryState>
        {canMemory ? <AddMemoryForm scope="project_context" projectId={project.id} queryKey={projectKey} label={M.addLabel} placeholder={M.addPlaceholder} /> : null}
      </section>

      <section aria-labelledby="mem-pref-h" className={`${s.memSection} ${s.prefSection}`}>
        <SectionHead id="mem-pref-h" title={<span className={s.eyebrowRow}><UserRound size={16} aria-hidden /> {M.preferencesTitle}</span>} />
        <p className={s.footNote} style={{ marginTop: 0 }}>{M.preferencesExplanation}</p>
        <QueryState query={prefs} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={<UserRound size={22} />} title={M.preferencesEmpty} body={M.preferencesEmptyBody} />}>
          {(list) => <MemoryList items={list} canWrite={canMemory} queryKey={prefKey} caption={M.preferencesCaption} />}
        </QueryState>
        {canMemory ? <AddMemoryForm scope="user_preference" projectId={null} queryKey={prefKey} label={M.addPreference} placeholder={M.preferencePlaceholder} /> : null}
      </section>
    </div>
  );
}
