"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Trash2 } from "lucide-react";
import type { AgentConfig, AgentDetail } from "@atlas/contracts";
import { api, isApiError } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { AgentGlyph, Badge, Button, Callout, Modal, PageHeader, TabPanel, Tabs, TextField, useToast } from "@/components/ui";
import { copy } from "@/copy/en";
import { agentsCopy as c } from "@/copy/agents";
import { BehaviorSection, IdentitySection, type SectionProps } from "./BehaviorSection";
import { ModelSection, SourcesSection } from "./SourcesModelSection";
import { GuardrailsSection, LimitsSection, ToolsSection } from "./ToolsLimitsSection";
import { PlanPreviewPanel } from "./PlanPreviewPanel";
import { VersionsPanel } from "./VersionsPanel";
import { toConfig, validate, type AgentDraft } from "./draft";
import s from "./agents.module.css";

type Tab = "config" | "versions";

/** Editor for custom agents: Basic fields first; model, temperature and limits under "Advanced". */
export function AgentForm({ agent, initial, profile, duplicatedFrom }: { agent: AgentDetail | null; initial: AgentDraft; profile: string; duplicatedFrom: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const canWrite = useCan("agent.write");
  const [draft, setDraftState] = useState(initial);
  const [tab, setTab] = useState<Tab>("config");
  const [touched, setTouched] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const errors = useMemo(() => validate(draft), [draft]);
  const valid = Object.keys(errors).length === 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const shownErrors = touched ? errors : {};

  const setDraft = (patch: Partial<AgentDraft>) => setDraftState((d) => ({ ...d, ...patch }));
  const setConfig = (patch: Partial<AgentConfig>) => setDraftState((d) => ({ ...d, config: { ...d.config, ...patch } }));
  const sectionProps: SectionProps = { draft, errors: shownErrors, setConfig, setDraft };

  const save = useMutation({
    mutationFn: () =>
      agent
        ? api.agents.update(agent.id, { baseVersion: agent.currentVersion, name: draft.name.trim(), config: toConfig(draft), changeNote: draft.changeNote.trim() })
        : api.agents.create({ name: draft.name.trim(), config: toConfig(draft) }),
    onSuccess: (d) => {
      qc.setQueryData(["agent", d.id], d);
      void qc.invalidateQueries({ queryKey: ["agents"] });
      toast({ tone: "success", title: agent ? c.editor.saved(d.currentVersion) : c.editor.created, body: d.name });
      if (!agent) router.replace(`/app/agent/?id=${d.id}`);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "CONFLICT") setConflict(e.message);
      else toast({ tone: "error", title: copy.states.errorTitle, body: isApiError(e) ? e.message : copy.states.errorBody });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.agents.remove(agent!.id),
    onSuccess: () => {
      setConfirmDelete(false);
      void qc.invalidateQueries({ queryKey: ["agent", agent!.id], refetchType: "none" });
      void qc.invalidateQueries({ queryKey: ["agents"] });
      toast({ tone: "success", title: c.editor.deleted, body: agent!.name });
      router.push("/app/agents/");
    },
    onError: (e) => toast({ tone: "error", title: copy.states.errorTitle, body: isApiError(e) ? e.message : copy.states.errorBody }),
  });

  const submit = () => {
    setTouched(true);
    if (valid) save.mutate();
  };

  const actions =
    agent && canWrite ? (
      <Button variant="danger" icon={<Trash2 size={14} aria-hidden />} onClick={() => setConfirmDelete(true)}>
        {c.editor.delete}
      </Button>
    ) : null;

  const meta = dirty ? <Badge tone="warn">{c.editor.unsaved}</Badge> : null;

  const configBody = (
    <div className={s.editorGrid}>
      <form
        className={s.mainCol}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset className={s.formFieldset}>
          <legend className="sr-only">{c.editor.tabConfig}</legend>
          <IdentitySection {...sectionProps} />
          <BehaviorSection {...sectionProps} />
          <SourcesSection {...sectionProps} />
          <ToolsSection {...sectionProps} />
          <details className={s.advanced} open={Boolean(shownErrors.maxSteps || shownErrors.maxSeconds || shownErrors.maxInputTokens || shownErrors.maxOutputTokens || shownErrors.costUsd) || undefined}>
            <summary>{c.editor.advanced}</summary>
            <div className={s.advancedBody}>
              <p className={s.hint}>{c.editor.advancedHint}</p>
              <ModelSection {...sectionProps} />
              <LimitsSection {...sectionProps} />
            </div>
          </details>
        </fieldset>
        <GuardrailsSection guardrails={agent ? agent.guardrails : null} />
        {canWrite ? (
          <div className={s.saveBar}>
            {conflict ? (
              <Callout tone="warn">
                <strong>{c.editor.conflictTitle}.</strong> {conflict} {c.editor.conflictHint}
                <div className={s.conflictActions}>
                  <Button size="sm" icon={<RefreshCw size={14} aria-hidden />} onClick={() => void qc.invalidateQueries({ queryKey: ["agent", agent?.id] })}>
                    {c.editor.conflictReload}
                  </Button>
                </div>
              </Callout>
            ) : null}
            {touched && !valid ? (
              <p className={s.error} role="alert">
                {c.editor.invalid}
              </p>
            ) : null}
            <div className={s.saveRow}>
              {agent ? <TextField label={c.editor.changeNote} hint={c.editor.changeNoteHint} value={draft.changeNote} maxLength={200} onChange={(e) => setDraft({ changeNote: e.target.value })} /> : <span />}
              <Button type="submit" variant="primary" loading={save.isPending} disabled={Boolean(agent) && !dirty}>
                {agent ? c.editor.save : c.editor.create}
              </Button>
            </div>
          </div>
        ) : null}
      </form>
      <aside className={s.sideCol}>
        <PlanPreviewPanel agentId={agent?.id ?? null} version={agent?.currentVersion ?? null} />
      </aside>
    </div>
  );

  return (
    <Page wide>
      <PageHeader
        back={{ href: "/app/agents/", label: c.editor.back }}
        title={
          <span className={s.titleRow}>
            <AgentGlyph profile={profile} size={36} teal={!agent?.builtIn} />
            {agent ? agent.name : draft.name.trim() || c.editor.newTitle}
          </span>
        }
        description={agent?.description || (duplicatedFrom ? c.editor.duplicatedFrom(duplicatedFrom) : undefined)}
        meta={meta}
        actions={actions}
      />
      {agent ? (
        <>
          <Tabs
            idPrefix="agent"
            label={agent.name}
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "config", label: c.editor.tabConfig },
              { id: "versions", label: c.editor.tabVersions, count: agent.versions.length },
            ]}
          />
          <TabPanel idPrefix="agent" id={tab}>
            <div className={s.tabBody}>{tab === "config" ? configBody : <VersionsPanel agent={agent} />}</div>
          </TabPanel>
        </>
      ) : (
        configBody
      )}
      {agent ? (
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={c.editor.deleteTitle}
          footer={
            <>
              <Button onClick={() => setConfirmDelete(false)}>{copy.actions.cancel}</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                {copy.actions.delete}
              </Button>
            </>
          }
        >
          <p>{c.editor.deleteBody}</p>
        </Modal>
      ) : null}
    </Page>
  );
}
