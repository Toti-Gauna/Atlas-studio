"use client";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AgentDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, modelName } from "@/lib/format";
import { gsap, MOTION, useReducedMotion } from "@/lib/motion";
import { Badge, Callout, Card, Table } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import { flattenConfig } from "./draft";
import s from "./agents.module.css";
import ps from "./panels.module.css";

export function VersionsPanel({ agent }: { agent: AgentDetail }) {
  const versions = useMemo(() => [...agent.versions].sort((a, b) => b.version - a.version), [agent.versions]);
  const [selected, setSelected] = useState(() => versions.find((v) => v.version !== agent.currentVersion)?.version ?? agent.currentVersion);
  const docs = useQuery({ queryKey: ["documents", null], queryFn: () => api.documents.list() });
  const refs = useRef<Record<number, HTMLButtonElement | null>>({});
  const reduced = useReducedMotion();

  const docTitle = (id: string) => docs.data?.find((d) => d.id === id)?.title ?? id;
  const sel = versions.find((v) => v.version === selected) ?? versions[0]!;
  const a = flattenConfig(sel.config, docTitle, modelName);
  const b = flattenConfig(agent.current.config, docTitle, modelName);
  const changed = Object.keys(b).filter((k) => a[k] !== b[k]);

  const pick = (v: number) => {
    setSelected(v);
    const el = refs.current[v];
    if (el && !reduced) gsap.fromTo(el, { scale: 0.98 }, { scale: 1, duration: MOTION.agent, ease: MOTION.ease, clearProps: "transform" });
  };

  return (
    <div className={ps.versions}>
      <Card className={s.section} aria-labelledby="ver-list-h">
        <h2 id="ver-list-h" className={s.sectionTitle}>
          {c.versions.caption}
        </h2>
        <div role="radiogroup" aria-labelledby="ver-list-h" className={ps.versionList}>
          {versions.map((v) => (
            <button
              key={v.id}
              ref={(el) => {
                refs.current[v.version] = el;
              }}
              type="button"
              role="radio"
              aria-checked={v.version === selected}
              tabIndex={v.version === selected ? 0 : -1}
              className={ps.versionItem}
              onClick={() => pick(v.version)}
              onKeyDown={(e) => {
                const i = versions.findIndex((x) => x.version === selected);
                const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                const next = versions[(i + d + versions.length) % versions.length]!;
                pick(next.version);
                refs.current[next.version]?.focus();
              }}
            >
              <span className={ps.versionTop}>
                <strong>{c.versions.selected(v.version)}</strong>
                {v.version === agent.currentVersion ? <Badge tone="teal">{c.versions.current}</Badge> : null}
                <span className={s.checkMeta}>{formatDateTime(v.createdAt)}</span>
              </span>
              <span className={ps.versionNote}>{v.changeNote || c.versions.noNote}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className={s.section} aria-labelledby="ver-diff-h">
        <h2 id="ver-diff-h" className={s.sectionTitle}>
          {c.versions.compare}
        </h2>
        <div aria-live="polite">
          {sel.version === agent.currentVersion || changed.length === 0 ? (
            <Callout>{c.versions.same}</Callout>
          ) : (
            <Table caption={`${c.versions.compare}: v${sel.version} → v${agent.currentVersion}`}>
              <thead>
                <tr>
                  <th scope="col">{c.versions.field}</th>
                  <th scope="col">{c.versions.selected(sel.version)}</th>
                  <th scope="col">{c.versions.currentCol(agent.currentVersion)}</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((k) => (
                  <tr key={k}>
                    <th scope="row">{c.diffLabels[k] ?? k}</th>
                    <td className={ps.diffOld}>{a[k]}</td>
                    <td className={ps.diffNew}>{b[k]}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
