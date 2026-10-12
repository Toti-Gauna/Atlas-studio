"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { gsap, MOTION, useReducedMotion } from "@/lib/motion";
import { copy } from "@/copy/en";
import { IconButton, cx } from "./controls";
import s from "./overlays.module.css";

/**
 * Modal built on native <dialog>: focus trap, Escape and inert background come
 * from the platform. GSAP only animates entry (≤ 280 ms); reduced motion skips it.
 */
export function Modal({ open, onClose, title, description, children, footer, wide, labelledBy }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; labelledBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (!reduced) gsap.fromTo(d, { opacity: 0, y: 12, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: MOTION.drawer, ease: MOTION.ease, clearProps: "transform,opacity" });
    } else if (!open && d.open) d.close();
  }, [open, reduced]);
  const titleId = labelledBy ?? `dlg-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <dialog
      ref={ref}
      className={cx(s.dialog, wide && s.dialogWide)}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className={s.dialogInner}>
          <div className={s.dialogHead}>
            <div>
              <h2 id={titleId} className={s.dialogTitle}>
                {title}
              </h2>
              {description ? <div className={s.dialogDesc}>{description}</div> : null}
            </div>
            <IconButton label={copy.actions.close} onClick={onClose} size="sm">
              <X size={16} />
            </IconButton>
          </div>
          <div className={s.dialogBody}>{children}</div>
          {footer ? <div className={s.dialogFoot}>{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Side sheet for tablet/mobile panels and navigation (200–280 ms slide). */
export function Sheet({ open, onClose, side = "right", label, children }: { open: boolean; onClose: () => void; side?: "left" | "right"; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (!reduced) gsap.fromTo(d, { xPercent: side === "right" ? 100 : -100 }, { xPercent: 0, duration: MOTION.drawer, ease: MOTION.ease, clearProps: "transform" });
    } else if (!open && d.open) {
      if (reduced) d.close();
      else gsap.to(d, { xPercent: side === "right" ? 100 : -100, duration: 0.2, ease: "power2.in", onComplete: () => d.close() });
    }
  }, [open, reduced, side]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={cx(s.sheet, side === "left" && s.sheetLeft)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={s.sheetInner}>{open ? children : null}</div>
    </dialog>
  );
}

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}
const ToastCtx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.tone === "error" ? 9000 : 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className={s.toasts} role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx(s.toast, t.tone === "success" && s.toastSuccess, t.tone === "error" && s.toastError)}>
            {t.tone === "success" ? <CheckCircle2 size={18} aria-hidden /> : t.tone === "error" ? <XCircle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
            <div>
              <div className={s.toastTitle}>{t.title}</div>
              {t.body ? <div className={s.toastBody}>{t.body}</div> : null}
            </div>
            <button className={s.toastClose} aria-label={copy.actions.dismiss} onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
