"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, BarChart3, BookOpenCheck, Briefcase, Code2, FileText, Info, Layers, PenLine, Presentation, ShieldCheck, Sparkles } from "lucide-react";
import type { Citation, SourceRef } from "@atlas/contracts";
import { cx } from "./controls";
import s from "./surfaces.module.css";

export function Card({ children, className, flush, interactive, as: As = "section", ...rest }: { children: ReactNode; className?: string; flush?: boolean; interactive?: boolean; as?: "section" | "div" | "article" | "li" } & Record<string, unknown>) {
  return (
    <As className={cx(s.card, flush && s.cardFlush, interactive && s.cardInteractive, className)} {...rest}>
      {children}
    </As>
  );
}

export function PageHeader({ eyebrow, title, description, actions, meta }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className={s.pageHeader}>
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div> : null}
        <h1 className={s.pageTitle}>{title}</h1>
        {description ? <p className={s.pageDesc}>{description}</p> : null}
        {meta ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{meta}</div> : null}
      </div>
      {actions ? <div className={s.pageActions}>{actions}</div> : null}
    </header>
  );
}

export function SectionHead({ title, aside, id }: { title: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className={s.sectionHead}>
      <h2 className={s.sectionTitle} id={id}>
        {title}
      </h2>
      {aside ? <div className={s.sectionAside}>{aside}</div> : null}
    </div>
  );
}

export function Stat({ value, label, note }: { value: ReactNode; label: ReactNode; note?: ReactNode }) {
  return (
    <div className={s.stat}>
      <div className={s.statValue}>{value}</div>
      <div className={s.statLabel}>{label}</div>
      {note ? <div className={s.statNote}>{note}</div> : null}
    </div>
  );
}

export function Table({ children, caption, className }: { children: ReactNode; caption?: string; className?: string }) {
  return (
    <div className={cx(s.tableWrap, className)} role="region" aria-label={caption} tabIndex={0}>
      <table className={s.table}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}
export const numCell = s.num;

export interface TabDef<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ tabs, value, onChange, label, idPrefix }: { tabs: Array<TabDef<T>>; value: T; onChange: (t: T) => void; label: string; idPrefix: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next]!.id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className={s.tabs}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          id={`${idPrefix}-tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`${idPrefix}-panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          className={s.tab}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {t.count !== undefined ? <span className={s.tabCount}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idPrefix, id, children }: { idPrefix: string; id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} tabIndex={0} style={{ outline: "none" }}>
      {children}
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={s.avatar} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {initials}
    </span>
  );
}

const PROFILE_ICON: Record<string, typeof ShieldCheck> = {
  compliance: ShieldCheck,
  presentation: Presentation,
  data: BarChart3,
  sales: Briefcase,
  architecture: Code2,
  research: BookOpenCheck,
  custom: Sparkles,
};

export function AgentGlyph({ profile, size = 36, teal }: { profile: string; size?: number; teal?: boolean }) {
  const Icon = PROFILE_ICON[profile] ?? Sparkles;
  return (
    <span className={cx(s.glyph, teal && s.glyphTeal)} style={{ width: size, height: size }} aria-hidden>
      <Icon size={size * 0.48} strokeWidth={1.8} />
    </span>
  );
}

export function ArtifactIcon({ type, size = 18 }: { type: string; size?: number }) {
  const Icon = type === "presentation" ? Presentation : type === "table" ? Layers : type === "report" ? FileText : PenLine;
  return <Icon size={size} aria-hidden strokeWidth={1.8} />;
}

export function CitationChip({ index, citation, onOpen }: { index: number; citation: Pick<Citation, "documentTitle" | "version" | "page"> | SourceRef; onOpen?: () => void }) {
  const inner = (
    <>
      <span className={s.chipRef}>S{index}</span>
      <span className={s.chipTitle}>{citation.documentTitle}</span>
      <span className={s.chipMeta}>
        v{citation.version}
        {citation.page ? ` · p.${citation.page}` : ""}
      </span>
    </>
  );
  return onOpen ? (
    <button type="button" className={s.chip} onClick={onOpen} aria-label={`Open source S${index}: ${citation.documentTitle}, version ${citation.version}${citation.page ? `, page ${citation.page}` : ""}`}>
      {inner}
    </button>
  ) : (
    <span className={s.chip}>{inner}</span>
  );
}

export function Callout({ tone = "neutral", children, icon }: { tone?: "neutral" | "info" | "warn" | "teal" | "danger"; children: ReactNode; icon?: ReactNode }) {
  const cls = { neutral: "", info: s.calloutInfo, warn: s.calloutWarn, teal: s.calloutTeal, danger: s.calloutDanger }[tone];
  return (
    <div className={cx(s.callout, cls)}>
      {icon ?? (tone === "warn" || tone === "danger" ? <AlertTriangle size={16} aria-hidden /> : <Info size={16} aria-hidden />)}
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Meter({ value, reserved = 0, max, label }: { value: number; reserved?: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const rpct = max > 0 ? Math.min(100 - pct, (reserved / max) * 100) : 0;
  return (
    <div className={cx(s.meter, pct >= 100 ? s.meterOver : pct >= 80 && s.meterWarn)} role="meter" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={s.meterFill} style={{ width: `${pct}%` }} />
      {rpct > 0 ? <div className={s.meterReserved} style={{ left: `${pct}%`, width: `${rpct}%` }} /> : null}
    </div>
  );
}

export function DescList({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className={s.dl}>
      {items.map(([k, v], i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
