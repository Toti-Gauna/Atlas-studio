"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Brain, MessageSquarePlus, Pencil } from "lucide-react";
import type { Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Badge, Button, Card, DemoTag, LinkButton, PageHeader, Select, TextArea } from "@/components/ui";
import { copy } from "@/copy/en";
import { projectsCopy as P } from "@/copy/projects";
import { PROJECT_DOT } from "./ProjectsView";
import { useProjectUpdate } from "./useProjectUpdate";
import s from "./projects.module.css";

export function ProjectHeader({ project }: { project: Project }) {
  const D = P.detail;
  const canWrite = useCan("project.write");
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const update = useProjectUpdate(project.id, (_p, patch) => (patch.objective !== undefined ? D.objectiveSaved : D.agentSaved));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.objective);
  const chatHref = `/app/chat/?new=1&project=${project.id}${project.defaultAgentId ? `&agent=${project.defaultAgentId}` : ""}`;

  const save = () =>
    update.mutate(
      { objective: draft.trim() },
      {
        onSuccess: () => setEditing(false),
      },
    );

  return (
    <>
      <Link href="/app/projects/" className={s.back}>
        <ArrowLeft size={14} aria-hidden /> {D.backToList}
      </Link>
      <PageHeader
        eyebrow={
          <span className={s.eyebrowRow}>
            <span className={s.dot} style={{ background: PROJECT_DOT[project.color] }} aria-hidden />
            {D.eyebrow}
          </span>
        }
        title={project.name}
        meta={
          <>
            <Badge>{project.documentCount} sources</Badge>
            <Badge>{project.conversationCount} chats</Badge>
            <Badge>{project.artifactCount} deliverables</Badge>
            <Badge tone={project.memoryEnabled ? "teal" : "neutral"} icon={<Brain size={12} aria-hidden />}>
              {project.memoryEnabled ? P.list.memoryOn : P.list.memoryOff}
            </Badge>
            {project.label === "DEMO" ? <DemoTag /> : null}
          </>
        }
        actions={
          <LinkButton href={chatHref} variant="primary" icon={<MessageSquarePlus size={14} aria-hidden />}>
            {D.startChat}
          </LinkButton>
        }
      />
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
            hint={agents.isError ? (agents.error instanceof Error ? agents.error.message : undefined) : !canWrite ? "Editors and admins can change this." : undefined}
            options={[{ value: "", label: P.create.noAgent }, ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
          />
        </div>
      </Card>
    </>
  );
}
