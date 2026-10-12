"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSession } from "@/lib/state/session";
import { readPref, writePref } from "@/lib/state/prefs";
import { copy } from "@/copy/en";
import { IconButton, cx } from "@/components/ui";
import { useInbox } from "@/features/inbox/useInbox";
import { AtlasMark } from "./AtlasMark";
import { NAV, canSee, isActive, type NavGroup } from "./nav";
import s from "./shell.module.css";

const noopSubscribe = () => () => {};

function useFolded(group: NavGroup, pathname: string): [boolean, () => void] {
  const [open, setOpen] = useState<boolean | null>(null);
  const inside = group.items.some((i) => isActive(pathname, i));
  const remembered = useSyncExternalStore(noopSubscribe, () => readPref("local", `nav.${group.id}`) === "open", () => false);
  const stored = open ?? remembered;
  const expanded = !group.collapsible || inside || stored;
  const toggle = () => {
    const next = !expanded;
    setOpen(next);
    writePref("local", `nav.${group.id}`, next ? "open" : null);
  };
  return [expanded, toggle];
}

function Group({ group, rail, pathname, onNavigate, badge }: { group: NavGroup; rail: boolean; pathname: string; onNavigate?: () => void; badge: (href: string) => number }) {
  const { data: session } = useSession();
  const items = group.items.filter((i) => canSee(session?.role, i));
  const [expanded, toggle] = useFolded(group, pathname);
  if (!items.length) return null;
  const listId = `nav-${group.id}`;
  return (
    <div className={s.navGroup}>
      {group.label && !rail ? (
        group.collapsible ? (
          <button type="button" className={s.navGroupToggle} aria-expanded={expanded} aria-controls={listId} onClick={toggle}>
            <ChevronRight size={14} aria-hidden className={s.navChevron} />
            {group.label}
          </button>
        ) : (
          <div className={s.navLabel}>{group.label}</div>
        )
      ) : null}
      {rail && group.label ? <hr className={s.navRule} aria-hidden /> : null}
      {expanded || rail ? (
        <ul className={s.navList} id={listId}>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            const n = badge(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} className={s.navItem} aria-current={active ? "page" : undefined} onClick={onNavigate} title={rail ? item.label : undefined}>
                  <Icon size={18} strokeWidth={1.8} aria-hidden />
                  <span className={s.navText}>{item.label}</span>
                  {n > 0 ? (
                    <span className={s.navBadge}>
                      {n}
                      <span className="sr-only"> waiting</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function Sidebar({ rail, variant = "desktop", onToggle, onExpand, onNavigate }: { rail: boolean; variant?: "desktop" | "sheet"; onToggle?: () => void; onExpand?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const inbox = useInbox();
  const badge = (href: string) => (href === "/app/inbox/" ? inbox.total : 0);

  return (
    <nav className={cx(s.sidebar, variant === "desktop" && s.sidebarDesktop, rail && s.rail)} aria-label="Primary">
      <div className={s.brandRow}>
        <Link href="/app/" className={s.brandLink} onClick={onNavigate} aria-label={`${copy.brand.product} home`}>
          <AtlasMark size={28} />
          <span className={s.brandText}>
            <span className={s.brandName}>{copy.brand.product}</span>
            {session ? <span className={s.brandSub}>{session.workspace.name}</span> : null}
          </span>
        </Link>
        {onToggle && !rail ? (
          <IconButton label="Collapse sidebar" size="sm" className={s.collapseBtn} onClick={onToggle}>
            <PanelLeftClose size={16} />
          </IconButton>
        ) : null}
      </div>
      <div className={s.nav}>
        {NAV.map((group) => (
          <Group key={group.id} group={group} rail={rail} pathname={pathname} onNavigate={onNavigate} badge={badge} />
        ))}
      </div>
      {rail && (onToggle || onExpand) ? (
        <div className={s.sidebarFoot}>
          <IconButton label="Expand sidebar" onClick={onToggle ?? onExpand}>
            <PanelLeftOpen size={18} />
          </IconButton>
        </div>
      ) : null}
    </nav>
  );
}
