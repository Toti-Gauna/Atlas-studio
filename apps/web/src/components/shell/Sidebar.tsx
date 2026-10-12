"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { can } from "@atlas/domain";
import { api } from "@/lib/api";
import { useSession } from "@/lib/state/session";
import { copy } from "@/copy/en";
import { IconButton, cx } from "@/components/ui";
import { AtlasMark } from "./AtlasMark";
import { NAV, isActive } from "./nav";
import s from "./shell.module.css";

const DOT: Record<string, string> = { teal: "var(--teal)", violet: "var(--violet)", amber: "#E0A32B", slate: "#64748B" };

export function Sidebar({ rail, onToggle, onNavigate }: { rail: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.role;
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: Boolean(role && can(role, "project.read")) });

  return (
    <nav className={cx(s.sidebar, rail && s.rail)} aria-label="Primary">
      <div className={s.brandRow}>
        <Link href="/app/" className={s.brandLink} onClick={onNavigate} aria-label={`${copy.brand.product} home`}>
          <AtlasMark size={28} />
          <span className={s.brandText}>
            <span className={s.brandName}>{copy.brand.product}</span>
            <br />
            <span className={s.brandSub}>{copy.brand.agency} demo</span>
          </span>
        </Link>
        {onToggle ? (
          <IconButton label="Collapse sidebar" size="sm" className={s.collapseBtn} onClick={onToggle}>
            <PanelLeftClose size={16} />
          </IconButton>
        ) : null}
      </div>
      <div className={s.nav}>
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.requires || (role && can(role, i.requires)));
          if (!items.length) return null;
          return (
            <div key={group.label} className={s.navGroup}>
              <div className={cx("eyebrow", s.navLabel)}>{group.label}</div>
              <ul className={s.navList}>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className={s.navItem} aria-current={active ? "page" : undefined} onClick={onNavigate} title={rail ? item.label : undefined}>
                        <Icon size={18} strokeWidth={1.8} aria-hidden />
                        <span className={s.navText}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {projects.data?.length && !rail ? (
          <div className={s.navGroup}>
            <div className={cx("eyebrow", s.navLabel)}>Recent projects</div>
            <ul className={s.navList}>
              {projects.data.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link href={`/app/project/?id=${p.id}`} className={s.navItem} onClick={onNavigate} aria-current={pathname.startsWith("/app/project") && typeof window !== "undefined" && window.location.search.includes(p.id) ? "page" : undefined}>
                    <span className={s.projectDot} style={{ background: DOT[p.color] }} aria-hidden />
                    <span className={s.navText}>{p.name}</span>
                    <span className={s.navCount}>{p.conversationCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {rail && onToggle ? (
        <div className={s.sidebarFoot}>
          <IconButton label="Expand sidebar" onClick={onToggle}>
            <PanelLeftOpen size={18} />
          </IconButton>
        </div>
      ) : null}
    </nav>
  );
}
