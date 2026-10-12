"use client";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { UsageQuery } from "@atlas/contracts";
import { api } from "@/lib/api";
import { modelName } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Button, Select } from "@/components/ui";
import s from "./usage.module.css";

export type UsageFilterState = Pick<UsageQuery, "provider" | "modelKey" | "agentId" | "projectId" | "userId">;

const ANY = "";

/** One row of dimension filters above everything they scope. Option lists degrade to "All" if a lookup fails. */
export function UsageFilters({ value, onChange }: { value: UsageFilterState; onChange: (v: UsageFilterState) => void }) {
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const members = useQuery({ queryKey: ["members"], queryFn: api.members });

  const opts = (list: Array<{ value: string; label: string }>) => [{ value: ANY, label: c.filters.any }, ...list];
  const set = <K extends keyof UsageFilterState>(k: K, v: string) => onChange({ ...value, [k]: v === ANY ? undefined : v });
  const active = Object.values(value).some(Boolean);

  return (
    <div className={s.filters}>
      <Select
        label={c.filters.provider}
        value={value.provider ?? ANY}
        onChange={(e) => set("provider", e.target.value)}
        options={opts((["anthropic", "google_gemini", "local"] as const).map((p) => ({ value: p, label: c.providers[p] ?? p })))}
      />
      <Select
        label={c.filters.model}
        value={value.modelKey ?? ANY}
        onChange={(e) => set("modelKey", e.target.value)}
        options={opts((models.data ?? []).map((m) => ({ value: m.key, label: m.displayName || modelName(m.key) })))}
      />
      <Select label={c.filters.agent} value={value.agentId ?? ANY} onChange={(e) => set("agentId", e.target.value)} options={opts((agents.data ?? []).map((a) => ({ value: a.id, label: a.name })))} />
      <Select label={c.filters.project} value={value.projectId ?? ANY} onChange={(e) => set("projectId", e.target.value)} options={opts((projects.data ?? []).map((p) => ({ value: p.id, label: p.name })))} />
      <Select label={c.filters.user} value={value.userId ?? ANY} onChange={(e) => set("userId", e.target.value)} options={opts((members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.displayName })))} />
      {active ? (
        <Button variant="ghost" size="sm" icon={<X size={14} aria-hidden />} onClick={() => onChange({})} className={s.clear}>
          {c.filters.clear}
        </Button>
      ) : null}
    </div>
  );
}
