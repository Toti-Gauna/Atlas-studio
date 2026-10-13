"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge, Card, ErrorState, ModeBadge, Segmented, Select, Skeleton, Switch } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import { privacyCopy } from "@/copy/privacy";
import type { SectionProps } from "./BehaviorSection";
import s from "./agents.module.css";

export function SourcesSection({ draft, setConfig }: SectionProps) {
  const docs = useQuery({ queryKey: ["documents", null], queryFn: () => api.documents.list() });
  const scope = draft.config.sourceScope;
  const toggle = (id: string, on: boolean) =>
    setConfig({ sourceScope: { ...scope, documentIds: on ? [...scope.documentIds, id] : scope.documentIds.filter((x) => x !== id) } });
  return (
    <Card className={s.section} aria-labelledby="sec-sources">
      <h2 id="sec-sources" className={s.sectionTitle}>
        {c.sections.sources}
      </h2>
      <div className={s.fields}>
        <div className={s.groupField}>
          <span className={s.groupLabel}>{c.fields.scope}</span>
          <Segmented
            label={c.fields.scope}
            value={scope.mode}
            options={[
              { value: "project_documents", label: c.fields.scopeAll },
              { value: "selected_documents", label: c.fields.scopeSelected },
            ]}
            onChange={(mode) => setConfig({ sourceScope: { ...scope, mode } })}
          />
          <p className={s.hint}>{c.fields.scopeHint}</p>
        </div>
        {scope.mode === "selected_documents" ? (
          <fieldset className={s.subFieldset}>
            <legend className={s.groupLabel}>{c.fields.documents}</legend>
            {docs.isPending ? (
              <Skeleton lines={4} />
            ) : docs.isError ? (
              <ErrorState error={docs.error} compact onRetry={() => void docs.refetch()} />
            ) : docs.data.length === 0 ? (
              <p className={s.hint}>{c.fields.noDocuments}</p>
            ) : (
              <ul className={s.checkList}>
                {docs.data.map((d) => (
                  <li key={d.id}>
                    <label className={s.checkRow}>
                      <input type="checkbox" checked={scope.documentIds.includes(d.id)} onChange={(e) => toggle(d.id, e.target.checked)} />
                      <span className={s.checkMain}>
                        <span className={s.checkTitle}>{d.title}</span>
                        <span className={s.checkMeta}>
                          {d.kind.toUpperCase()} · {privacyCopy.classification[d.classification] ?? d.classification}
                          {d.publishedVersion ? ` · v${d.publishedVersion}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        ) : null}
      </div>
    </Card>
  );
}

export function ModelSection({ draft, setConfig }: SectionProps) {
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const cfg = draft.config;
  const selected = models.data?.find((m) => m.key === cfg.modelKey);
  return (
    <Card className={s.section} aria-labelledby="sec-model">
      <h2 id="sec-model" className={s.sectionTitle}>
        {c.sections.model}
      </h2>
      <div className={s.fields}>
        {models.isPending ? (
          <Skeleton lines={2} />
        ) : models.isError ? (
          <ErrorState error={models.error} compact onRetry={() => void models.refetch()} />
        ) : (
          <>
            <Select
              label={c.fields.model}
              value={cfg.modelKey}
              options={models.data.map((m) => ({ value: m.key, label: `${m.displayName}${m.availability.mode === "pending" ? c.fields.pendingSuffix : ""}` }))}
              onChange={(e) => setConfig({ modelKey: e.target.value })}
            />
            {selected ? (
              <div className={s.badges} aria-live="polite">
                <ModeBadge mode={selected.availability.mode} />
                {selected.availability.mode === "pending" ? <Badge tone="warn">{c.fields.pendingModel}</Badge> : null}
              </div>
            ) : null}
            {selected?.availability.reason ? <p className={s.hint}>{selected.availability.reason}</p> : null}
          </>
        )}
        <Switch label={c.fields.temperatureDefault} checked={cfg.temperature === null} onChange={(useDefault) => setConfig({ temperature: useDefault ? null : 0.3 })} />
        {cfg.temperature !== null ? (
          <div className={s.tempRow}>
            <label htmlFor="agent-temp" className={s.groupLabel}>
              {c.fields.temperature}
            </label>
            <input id="agent-temp" type="range" min={0} max={1} step={0.05} value={cfg.temperature} onChange={(e) => setConfig({ temperature: Number(e.target.value) })} aria-describedby="agent-temp-hint" />
            <input
              type="number"
              className={s.numInput}
              aria-label={`${c.fields.temperature} value`}
              min={0}
              max={1}
              step={0.05}
              value={cfg.temperature}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setConfig({ temperature: Math.min(1, Math.max(0, v)) });
              }}
            />
            <span id="agent-temp-hint" className={s.hint}>
              {c.fields.temperatureHint}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
