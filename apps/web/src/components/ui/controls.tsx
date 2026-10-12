"use client";
import Link from "next/link";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Cloud, CloudOff, Cpu } from "lucide-react";
import type { IntegrationMode } from "@atlas/contracts";
import { copy } from "@/copy/en";
import s from "./controls.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink";
type Size = "sm" | "md" | "lg";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

function btnClass(variant: Variant, size: Size, icon?: boolean, block?: boolean) {
  return cx(s.btn, variant === "ink" ? s.inkBtn : s[variant], size !== "md" && s[size], icon && s.icon, block && s.block);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", loading, icon, block, children, className, disabled, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={cx(btnClass(variant, size, false, block), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={s.spinner} aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, variant = "ghost", size = "md", children, className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant; size?: Size }) {
  return (
    <button type={type} aria-label={label} title={label} className={cx(btnClass(variant, size, true), className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", icon, children, className }: { href: string; variant?: Variant; size?: Size; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx(btnClass(variant, size), className)}>
      {icon}
      {children}
    </Link>
  );
}

interface FieldShell {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  hideLabel?: boolean;
}

function Shell({ id, label, hint, error, hideLabel, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label htmlFor={id} className={cx(s.label, hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-err`} className={s.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className={s.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, error, hideLabel, id, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input id={fid} className={s.input} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined} {...rest} />
    </Shell>
  );
}

export const TextArea = forwardRef<HTMLTextAreaElement, FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ label, hint, error, hideLabel, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <textarea ref={ref} id={fid} className={s.textarea} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined} {...rest} />
    </Shell>
  );
});

export function Select({ label, hint, error, hideLabel, id, options, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string; disabled?: boolean }> }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <select id={fid} className={s.select} aria-describedby={hint ? `${fid}-hint` : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={s.switchRow}>
      <div>
        <div id={id} className={s.label} style={{ color: "var(--text)" }}>
          {label}
        </div>
        {description ? <div className={s.hint}>{description}</div> : null}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className={s.switch} disabled={disabled} onClick={() => onChange(!checked)} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={s.segmented}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={s.segment}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value);
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(options[(i + 1) % options.length]!.value);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(options[(i - 1 + options.length) % options.length]!.value);
            }
          }}
          tabIndex={value === o.value ? 0 : -1}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type Tone = "neutral" | "teal" | "violet" | "warn" | "danger" | "info";

export function Badge({ tone = "neutral", mono, dot, icon, children, title }: { tone?: Tone; mono?: boolean; dot?: boolean; icon?: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span className={cx(s.badge, tone === "danger" ? s.dangerTone : s[tone], mono && s.mono)} title={title}>
      {dot ? <span className={s.dot} aria-hidden /> : icon}
      {children}
    </span>
  );
}

export function DemoTag({ label = "DEMO" }: { label?: string }) {
  return (
    <span className={cx(s.badge, s.demoTag)} title={copy.disclaimers.demoData}>
      {label}
    </span>
  );
}

export function ModeBadge({ mode, long }: { mode: IntegrationMode; long?: boolean }) {
  const map = {
    local: { tone: "teal" as const, icon: <Cpu size={12} aria-hidden />, text: long ? copy.modes.localLong : copy.modes.local },
    connected: { tone: "info" as const, icon: <Cloud size={12} aria-hidden />, text: copy.modes.connected },
    pending: { tone: "warn" as const, icon: <CloudOff size={12} aria-hidden />, text: long ? copy.modes.pendingLong : copy.modes.pending },
  }[mode];
  return (
    <Badge tone={map.tone} icon={map.icon} title={mode === "local" ? copy.modes.localLong : mode === "pending" ? copy.modes.pendingLong : undefined}>
      {map.text}
    </Badge>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

export { cx };
