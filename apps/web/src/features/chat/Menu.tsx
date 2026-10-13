"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import s from "./menu.module.css";

export interface TriggerProps {
  "aria-haspopup": "menu" | "dialog";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
}

/**
 * Small anchored popover (fixed-positioned so scroll containers never clip it).
 * `kind="menu"` adds menu semantics and arrow-key navigation between items.
 * Closes on Escape (focus returns to the trigger), outside click, scroll or resize.
 */
export function Popover({
  trigger,
  children,
  label,
  kind = "dialog",
  align = "start",
  className,
}: {
  trigger: (props: TriggerProps) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  label: string;
  kind?: "menu" | "dialog";
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({ visibility: "hidden" });
  const wrap = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = (refocus = true) => {
    setOpen(false);
    setPos({ visibility: "hidden" });
    if (refocus) (wrap.current?.querySelector("button, a") as HTMLElement | null)?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !wrap.current || !panel.current) return;
    const t = wrap.current.getBoundingClientRect();
    const p = panel.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - t.bottom;
    const top = below >= p.height + 8 || below >= t.top ? t.bottom + 4 : Math.max(8, t.top - p.height - 4);
    const rawLeft = align === "end" ? t.right - p.width : t.left;
    const left = Math.min(Math.max(8, rawLeft), Math.max(8, vw - p.width - 8));
    setPos({ top, left });
    if (kind === "menu") (panel.current.querySelector('[role="menuitem"]:not([aria-disabled="true"])') as HTMLElement | null)?.focus();
    else (panel.current.querySelector("select, input, textarea, button") as HTMLElement | null)?.focus();
  }, [open, align, kind]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    const onMove = (e: Event) => {
      if (panel.current && e.target instanceof Node && panel.current.contains(e.target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (kind !== "menu" || !panel.current) return;
    // Disabled items stay focusable so their reason can be read.
    const items = [...panel.current.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (d && items.length) {
      e.preventDefault();
      items[(i + d + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <span ref={wrap} className={s.wrap} onKeyDown={open ? onKey : undefined}>
      {trigger({ "aria-haspopup": kind, "aria-expanded": open, "aria-controls": id, onClick: () => (open ? close() : setOpen(true)) })}
      {open ? (
        <div ref={panel} id={id} role={kind} aria-label={label} className={`${s.panel} ${kind === "menu" ? s.menu : s.dialog} ${className ?? ""}`} style={pos}>
          {typeof children === "function" ? children(() => close()) : children}
        </div>
      ) : null}
    </span>
  );
}

/** A menu item; `hint` is a second line (or the reason it is unavailable when disabled). */
export function MenuItem({ icon, children, hint, disabled, onSelect }: { icon?: ReactNode; children: ReactNode; hint?: ReactNode; disabled?: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="menuitem" tabIndex={-1} className={s.item} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onSelect}>
      {icon ? <span className={s.icon}>{icon}</span> : null}
      <span className={s.text}>
        <span>{children}</span>
        {hint ? <span className={s.hint}>{hint}</span> : null}
      </span>
    </button>
  );
}
