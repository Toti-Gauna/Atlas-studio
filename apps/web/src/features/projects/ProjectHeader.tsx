"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, MessageSquarePlus, Pencil } from "lucide-react";
import type { Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Badge, Button, Card, LinkButton, PageHeader, Select, TextArea } from "@/components/ui";
import { copy } from "@/copy/en";
import { projectsCopy as P } from "@/copy/projects";
import { ProjectDot, newChatHref } from "./projectBits";
import { useProjectUpdate } from "./useProjectUpdate";
import s from "./projects.module.css";

/** Name, the one exception badge (memory off) and the primary action. Counts live on the tabs. */
export function ProjectHeader({ project }: { project: Project }) {
  return (
    <PageHeader
      back={{ href: "/app/projects/", label: P.detail.backToList }}
      title={
        <span className={s.titleRow}>
          <ProjectDot color={project.color} />
          {project.name}
        </span>
      }
      meta={!project.memoryEnabled ? <Badge icon={<Brain size={12} aria-hidden />}>{P.list.memoryOff}</Badge> : undefined}
      actions={
        <LinkButton href={newChatHref(project)} variant="primary" icon={<MessageSquarePlus size={14} aria-hidden />}>
          {P.detail.startChat}
        </LinkButton>
      }
    />
  );
}

/** Objective and default agent, shown on the Overview tab. */
export function ProjectSetup({ project }: { project: Project }) {
  const D = P.detail;
  const canWrite = useCan("project.write");
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const update = useProjectUpdate(project.id, (_p, patch) => (patch.objective !== undefined ? D.objectiveSaved : D.agentSaved));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.objective);

  const save = () =>
    update.mutate(
      { objective: draft.trim() },
      {
        onSuccess: () => setEditing(false),
      },
    );

  return (
    <Card className={s.setup}>
      <div className={s.objectiveCol}>
        <div className={s.fieldHead}>
          <h2 className={s.label} id="objective-h">
            {D.objective}
          </h2>
          {canWrite && !editing ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil size={13} aria-hidden />}
              onClick={() => {
                setDraft(project.objective);
                setEditing(true);
              }}
            >
              {D.editObjective}
            </Button>
          ) : null}
        </div>
        {editing ? (
          <form
            className={s.inlineForm}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <TextArea label={D.objective} hideLabel value={draft} maxLength={400} rows={3} autoFocus onChange={(e) => setDraft(e.target.value)} hint={`${draft.length}/400`} />
            <div className={s.rowActions}>
              <Button type="submit" size="sm" variant="primary" loading={update.isPending}>
                {D.saveObjective}
              </Button>
              <Button size="sm" onClick={() => setEditing(false)}>
                {copy.actions.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <p className={s.objectiveText} aria-labelledby="objective-h">
            {project.objective || P.list.noObjective}
          </p>
        )}
      </div>
      <div className={s.agentCol}>
        <Select
          label={D.defaultAgent}
          value={project.defaultAgentId ?? ""}
          disabled={!canWrite || update.isPending || agents.isPending}
          onChange={(e) => update.mutate({ defaultAgentId: e.target.value || null })}
          hint={agents.isError ? (agents.error instanceof Error ? agents.error.message : undefined) : !canWrite ? D.agentReadOnly : undefined}
          options={[{ value: "", label: P.create.noAgent }, ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
        />
      </div>
    </Card>
  );
}
