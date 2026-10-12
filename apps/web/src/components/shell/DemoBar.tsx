"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import type { WorkspaceRole } from "@atlas/contracts";
import { copy } from "@/copy/en";
import { landing } from "@/copy/landing";
import { DATA_MODE } from "@/lib/config";
import { useSession, useSwitchRole } from "@/lib/state/session";
import { previewEnabled, writePref } from "@/lib/state/prefs";
import { Modal, ModeBadge, useToast } from "@/components/ui";
import s from "./shell.module.css";

const noopSubscribe = () => () => {};

function RoleMenu() {
  const { data: session } = useSession();
  const switchRole = useSwitchRole();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session) return null;
  const pick = (role: WorkspaceRole) => {
    setOpen(false);
    if (role === session.role) return;
    switchRole.mutate(role, {
      onSuccess: (next) => {
        writePref("session", "demoRole", next.role);
        toast({ tone: "info", title: copy.demo.roleSwitched(copy.roles[next.role].label) });
      },
      onError: (err) => toast({ tone: "error", title: "Couldn’t switch role", body: (err as Error).message }),
    });
  };

  return (
    <div className={s.roleMenu} ref={ref}>
      <button type="button" className={s.bannerBtn} aria-haspopup="true" aria-expanded={open} aria-controls={menuId} disabled={switchRole.isPending} onClick={() => setOpen((o) => !o)}>
        <span className={s.hideMobile}>{copy.demo.viewAs}:&nbsp;</span>
        <strong>{copy.roles[session.role].label}</strong>
        <ChevronDown size={12} aria-hidden />
      </button>
      {open ? (
        <div className={s.roleList} id={menuId} role="group" aria-label={copy.demo.viewAs}>
          {session.switchableRoles.map((r) => (
            <button key={r} type="button" className={s.roleOption} aria-pressed={r === session.role} onClick={() => pick(r)}>
              <span className={s.roleCheck}>{r === session.role ? <Check size={14} aria-hidden /> : null}</span>
              <span>
                <span className={s.roleName}>{copy.roles[r].label}</span>
                <span className={s.roleDesc}>{copy.roles[r].desc}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WhatsReal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={landing.statusTitle} description={copy.demo.banner}>
      <ul className={s.realList}>
        {landing.status.map((row) => (
          <li key={row.item} className={s.realRow}>
            <span className={s.realItem}>{row.item}</span>
            <ModeBadge mode={row.mode} />
            <span className={s.realNote}>{row.note}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** The single, persistent demo signal: data provenance, tours, honesty and role switching. */
export function DemoBar({ onPreview }: { onPreview: () => void }) {
  const [real, setReal] = useState(false);
  const preview = useSyncExternalStore(noopSubscribe, previewEnabled, () => false);
  return (
    <div className={s.banner} role="note" aria-label="Demo workspace">
      <span className={s.bannerTag}>{copy.demo.tag}</span>
      <span className={s.bannerDetail}>
        {copy.demo.banner}
        {DATA_MODE === "fixture" ? <span className={s.hideMobile}> · {copy.demo.resets}</span> : null}
      </span>
      <span className={s.bannerActions}>
        <Link href="/app/showcase/" className={s.bannerLink}>
          {copy.demo.tours}
        </Link>
        <button type="button" className={s.bannerLink} onClick={() => setReal(true)}>
          {copy.demo.whatsReal}
        </button>
        {DATA_MODE === "fixture" && preview ? (
          <button type="button" className={s.bannerLink} onClick={onPreview}>
            {copy.demo.preview}
          </button>
        ) : null}
        <RoleMenu />
      </span>
      <WhatsReal open={real} onClose={() => setReal(false)} />
    </div>
  );
}
