"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, ShieldCheck } from "lucide-react";
import type { ModelRegistryEntry, RoutingPolicy, RoutingRule } from "@atlas/contracts";
import { api, isApiError } from "@/lib/api";
import { formatDateTime, modelName, money } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Badge, Button, Callout, EmptyState, ErrorState, LoadingBlock, SectionHead, Select, Table, useToast } from "@/components/ui";
import { copy } from "@/copy/en";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

const r = c.routing;

function RulesTable({ rules, models, edit, onChange }: { rules: RoutingRule[]; models: ModelRegistryEntry[]; edit: boolean; onChange: (id: string, patch: Partial<RoutingRule>) => void }) {
  const label = (k: string) => {
    const mm = models.find((x) => x.key === k);
    return mm ? `${mm.displayName}${mm.availability.mode === "pending" ? r.pendingSuffix : ""}` : modelName(k);
  };
  const options = models.map((x) => ({ value: x.key, label: label(x.key) }));
  return (
    <Table caption={r.caption}>
      <thead>
        <tr>
          <th scope="col">{r.task}</th>
          <th scope="col">{r.preferred}</th>
          <th scope="col">{r.required}</th>
          <th scope="col">{r.fallback}</th>
          <th scope="col">{r.maxCost}</th>
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => {
          const task = r.tasks[rule.task] ?? rule.task;
          const same = rule.fallbackModelKey !== null && rule.fallbackModelKey === rule.preferredModelKey;
          return (
            <tr key={rule.id}>
              <th scope="row">{task}</th>
              <td>
                {edit ? (
                  <Select label={`${r.preferred} — ${task}`} hideLabel value={rule.preferredModelKey} options={options} onChange={(e) => onChange(rule.id, { preferredModelKey: e.target.value })} />
                ) : (
                  label(rule.preferredModelKey)
                )}
              </td>
              <td>
                <span className={s.chips}>
                  {rule.requiredCapabilities.map((cap) => (
                    <Badge key={cap}>{c.capabilities[cap] ?? cap}</Badge>
                  ))}
                </span>
              </td>
              <td>
                {edit ? (
                  <Select
                    label={`${r.fallback} — ${task}`}
                    hideLabel
                    value={rule.fallbackModelKey ?? ""}
                    options={[{ value: "", label: r.none }, ...options]}
                    error={same ? r.sameModel : null}
                    onChange={(e) => onChange(rule.id, { fallbackModelKey: e.target.value || null })}
                  />
                ) : rule.fallbackModelKey ? (
                  label(rule.fallbackModelKey)
                ) : (
                  <span className={s.subtle}>{r.none}</span>
                )}
              </td>
              <td className="mono">{rule.maxEstimatedCostNanoUsd ? money(rule.maxEstimatedCostNanoUsd) : <span className={s.subtle}>{r.noCap}</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

export function RoutingTab() {
  const isAdmin = useCan("settings.admin");
  const qc = useQueryClient();
  const toast = useToast();
  const policy = useQuery({ queryKey: ["routing"], queryFn: api.routing.get });
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const [draft, setDraft] = useState<RoutingRule[] | null>(null);

  const save = useMutation({
    mutationFn: (p: RoutingPolicy) => api.routing.update(p),
    onSuccess: (p) => {
      qc.setQueryData(["routing"], p);
      setDraft(null);
      toast({ tone: "success", title: r.saved(p.version) });
    },
    onError: (e) => toast({ tone: "error", title: copy.states.errorTitle, body: isApiError(e) ? e.message : copy.states.errorBody }),
  });

  if (policy.isPending || models.isPending) return <LoadingBlock rows={4} />;
  if (policy.isError) return <ErrorState error={policy.error} onRetry={() => void policy.refetch()} />;
  if (models.isError) return <ErrorState error={models.error} onRetry={() => void models.refetch()} />;
  const p = policy.data;
  const rules = draft ?? p.rules;
  const invalid = rules.some((x) => x.fallbackModelKey !== null && x.fallbackModelKey === x.preferredModelKey);
  const change = (id: string, patch: Partial<RoutingRule>) => setDraft(rules.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <section aria-labelledby="routing-h" className={s.stack}>
      <SectionHead
        id="routing-h"
        title={r.heading}
        aside={
          <span className={s.chips}>
            <Badge mono>{r.version(p.version)}</Badge>
            <span className={s.subtle}>{r.updated(formatDateTime(p.updatedAt))}</span>
          </span>
        }
      />
      <Callout tone="teal" icon={<ShieldCheck size={16} aria-hidden />}>
        <strong>{r.fallbackOff}</strong>
      </Callout>
      <p className={s.subtle}>
        {r.defaultModel}: <span className={s.strong}>{modelName(p.defaultModelKey)}</span>
      </p>
      {rules.length === 0 ? <EmptyState title={r.empty} /> : <RulesTable rules={rules} models={models.data} edit={draft !== null} onChange={change} />}
      <div className={s.actions} aria-live="polite">
        {!isAdmin ? (
          <span className={s.subtle}>{r.adminOnly}</span>
        ) : draft === null ? (
          <Button icon={<Pencil size={14} aria-hidden />} onClick={() => setDraft(p.rules)} disabled={p.rules.length === 0}>
            {r.edit}
          </Button>
        ) : (
          <>
            <Button onClick={() => setDraft(null)} disabled={save.isPending}>
              {copy.actions.cancel}
            </Button>
            <Button variant="primary" loading={save.isPending} disabled={invalid || JSON.stringify(draft) === JSON.stringify(p.rules)} onClick={() => save.mutate({ ...p, rules: draft })}>
              {r.save}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
