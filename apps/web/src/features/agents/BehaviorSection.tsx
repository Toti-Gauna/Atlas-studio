"use client";
import { Plus, X } from "lucide-react";
import type { AgentConfig } from "@atlas/contracts";
import { Button, Card, IconButton, Segmented, Select, TextArea, TextField } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import type { AgentDraft, DraftErrors } from "./draft";
import s from "./agents.module.css";

export interface SectionProps {
  draft: AgentDraft;
  errors: DraftErrors;
  setConfig: (patch: Partial<AgentConfig>) => void;
  setDraft: (patch: Partial<AgentDraft>) => void;
}

const opts = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((value) => ({ value, label: m[value] }));

export function IdentitySection({ draft, errors, setConfig, setDraft }: SectionProps) {
  return (
    <Card className={s.section} aria-labelledby="sec-identity">
      <h2 id="sec-identity" className={s.sectionTitle}>
        {c.sections.identity}
      </h2>
      <div className={s.fields}>
        <TextField label={c.fields.name} value={draft.name} maxLength={60} required error={errors.name} onChange={(e) => setDraft({ name: e.target.value })} />
        <TextArea label={c.fields.description} value={draft.config.description} maxLength={400} rows={2} onChange={(e) => setConfig({ description: e.target.value })} />
      </div>
    </Card>
  );
}

export function BehaviorSection({ draft, errors, setConfig }: SectionProps) {
  const cfg = draft.config;
  const qs = cfg.briefQuestions;
  const setQ = (i: number, v: string) => setConfig({ briefQuestions: qs.map((q, j) => (j === i ? v : q)) });
  return (
    <Card className={s.section} aria-labelledby="sec-behavior">
      <h2 id="sec-behavior" className={s.sectionTitle}>
        {c.sections.behavior}
      </h2>
      <div className={s.fields}>
        <TextArea label={c.fields.instructions} hint={c.fields.instructionsHint} value={cfg.instructions} maxLength={8000} rows={6} required error={errors.instructions} onChange={(e) => setConfig({ instructions: e.target.value })} />
        <TextArea label={c.fields.objective} hint={c.fields.objectiveHint} value={cfg.objective} maxLength={400} rows={2} onChange={(e) => setConfig({ objective: e.target.value })} />
        <div className={s.row2}>
          <Select label={c.fields.outputFormat} value={cfg.outputFormat} options={opts(c.outputFormat)} onChange={(e) => setConfig({ outputFormat: e.target.value as AgentConfig["outputFormat"] })} />
          <Select label={c.fields.clarify} value={cfg.clarifyPolicy} options={opts(c.clarify)} onChange={(e) => setConfig({ clarifyPolicy: e.target.value as AgentConfig["clarifyPolicy"] })} />
        </div>
        <div className={s.row2}>
          <div className={s.groupField}>
            <span className={s.groupLabel}>{c.fields.style}</span>
            <Segmented label={c.fields.style} value={cfg.style} options={opts(c.style)} onChange={(v) => setConfig({ style: v })} />
          </div>
          <div className={s.groupField}>
            <span className={s.groupLabel}>{c.fields.depth}</span>
            <Segmented label={c.fields.depth} value={cfg.depth} options={opts(c.depth)} onChange={(v) => setConfig({ depth: v })} />
          </div>
        </div>
        <fieldset className={s.subFieldset}>
          <legend className={s.groupLabel}>{c.fields.briefQuestions}</legend>
          <p className={s.hint}>{c.fields.briefHint}</p>
          {qs.length ? (
            <ol className={s.questions}>
              {qs.map((q, i) => (
                <li key={i} className={s.questionRow}>
                  <TextField label={c.fields.question(i + 1)} hideLabel value={q} maxLength={200} onChange={(e) => setQ(i, e.target.value)} />
                  <IconButton label={c.fields.removeQuestion(i + 1)} size="sm" onClick={() => setConfig({ briefQuestions: qs.filter((_, j) => j !== i) })}>
                    <X size={14} />
                  </IconButton>
                </li>
              ))}
            </ol>
          ) : null}
          {errors.briefQuestions ? (
            <p className={s.error} role="alert">
              {errors.briefQuestions}
            </p>
          ) : null}
          <div>
            <Button size="sm" icon={<Plus size={14} aria-hidden />} disabled={qs.length >= 6} onClick={() => setConfig({ briefQuestions: [...qs, ""] })}>
              {c.fields.addQuestion}
            </Button>
          </div>
        </fieldset>
      </div>
    </Card>
  );
}
