"use client";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import type { AgentLimits } from "@atlas/contracts";
import { api } from "@/lib/api";
import { Card, ErrorState, Skeleton, TextField } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import type { SectionProps } from "./BehaviorSection";
import { LIMIT_RANGES } from "./draft";
import s from "./agents.module.css";

export function ToolsSection({ draft, setConfig }: SectionProps) {
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const allowed = draft.config.allowedTools;
  return (
    <Card className={s.section} aria-labelledby="sec-tools">
      <h2 id="sec-tools" className={s.sectionTitle}>
        {c.sections.tools}
      </h2>
      <p className={s.hint}>{c.fields.toolsHint}</p>
      {tools.isPending ? (
        <Skeleton lines={5} />
      ) : tools.isError ? (
        <ErrorState error={tools.error} compact onRetry={() => void tools.refetch()} />
      ) : (
        <fieldset className={s.subFieldset}>
          <legend className="sr-only">{c.fields.tools}</legend>
          <ul className={s.checkList}>
            {tools.data.map((t) => (
              <li key={t.id}>
                <label className={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={allowed.includes(t.id)}
                    onChange={(e) => setConfig({ allowedTools: e.target.checked ? [...allowed, t.id] : allowed.filter((x) => x !== t.id) })}
                  />
                  <span className={s.checkMain}>
                    <span className={s.checkTitle}>
                      {t.name}
                      {t.effect === "requires_confirmation" ? <span className={s.confirmNote}> · {c.fields.needsConfirmation}</span> : null}
                    </span>
                    <span className={s.checkMeta}>
                      {t.description}
                      {t.deterministic ? null : ` ${c.fields.callsModel}.`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </Card>
  );
}

const LIMIT_FIELDS: Array<{ key: keyof typeof LIMIT_RANGES; label: string }> = [
  { key: "maxSteps", label: c.fields.maxSteps },
  { key: "maxSeconds", label: c.fields.maxSeconds },
  { key: "maxInputTokens", label: c.fields.maxInputTokens },
  { key: "maxOutputTokens", label: c.fields.maxOutputTokens },
];

export function LimitsSection({ draft, errors, setConfig, setDraft }: SectionProps) {
  const limits = draft.config.limits;
  const setLimit = (k: keyof AgentLimits, v: string) => setConfig({ limits: { ...limits, [k]: v === "" ? Number.NaN : Number(v) } });
  return (
    <Card className={s.section} aria-labelledby="sec-limits">
      <h2 id="sec-limits" className={s.sectionTitle}>
        {c.sections.limits}
      </h2>
      <div className={s.limitsGrid}>
        {LIMIT_FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="numeric"
            min={LIMIT_RANGES[key][0]}
            max={LIMIT_RANGES[key][1]}
            step={1}
            value={Number.isNaN(limits[key]) ? "" : limits[key]}
            error={errors[key]}
            onChange={(e) => setLimit(key, e.target.value)}
          />
        ))}
        <TextField label={c.fields.maxCost} type="number" inputMode="decimal" min={0} step={0.01} value={draft.costUsd} error={errors.costUsd} onChange={(e) => setDraft({ costUsd: e.target.value })} />
      </div>
    </Card>
  );
}

export function GuardrailsSection({ guardrails }: { guardrails: string[] | null }) {
  return (
    <Card className={s.section} aria-labelledby="sec-guardrails">
      <h2 id="sec-guardrails" className={s.sectionTitle}>
        {c.sections.guardrails}
      </h2>
      <p className={s.hint}>{guardrails ? c.fields.guardrailsNote : c.fields.guardrailsNew}</p>
      {guardrails?.length ? (
        <ul className={s.guardList}>
          {guardrails.map((g) => (
            <li key={g}>
              <ShieldCheck size={14} aria-hidden />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
