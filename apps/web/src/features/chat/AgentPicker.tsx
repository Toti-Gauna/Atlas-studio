"use client";
import { useRef } from "react";
import type { AgentSummary } from "@atlas/contracts";
import { gsap, MOTION, useReducedMotion } from "@/lib/motion";
import { AgentGlyph } from "@/components/ui";
import s from "./chat.module.css";

/** Radio-card gallery; selection animates 180–220 ms and changes the real run config. */
export function AgentPicker({ agents, value, onChange, label = "Agent" }: { agents: AgentSummary[]; value: string | null; onChange: (id: string) => void; label?: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduced = useReducedMotion();
  const select = (id: string) => {
    onChange(id);
    const el = refs.current[id];
    if (el && !reduced) gsap.fromTo(el, { scale: 0.97 }, { scale: 1, duration: MOTION.agent, ease: MOTION.ease, clearProps: "transform" });
  };
  return (
    <div role="radiogroup" aria-label={label} className={s.agents}>
      {agents.map((a, i) => (
        <button
          key={a.id}
          ref={(el) => {
            refs.current[a.id] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          tabIndex={value === a.id || (!value && i === 0) ? 0 : -1}
          className={s.agentCard}
          onClick={() => select(a.id)}
          onKeyDown={(e) => {
            const idx = agents.findIndex((x) => x.id === (value ?? agents[0]?.id));
            const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (d) {
              e.preventDefault();
              const next = agents[(idx + d + agents.length) % agents.length]!;
              select(next.id);
              refs.current[next.id]?.focus();
            }
          }}
        >
          <AgentGlyph profile={a.profile} size={34} />
          <span>
            <span className={s.agentName}>{a.name}</span>
            <span className={s.agentDesc} style={{ display: "block" }}>
              {a.description.length > 92 ? `${a.description.slice(0, 90)}…` : a.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
