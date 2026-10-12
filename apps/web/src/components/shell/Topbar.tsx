"use client";
import { Menu, Moon, Search, SlidersHorizontal, Sun } from "lucide-react";
import type { WorkspaceRole } from "@atlas/contracts";
import { useSession, useSwitchRole } from "@/lib/state/session";
import { useTheme } from "@/lib/state/theme";
import { DATA_MODE } from "@/lib/config";
import { IconButton, Kbd, ModeBadge, useToast } from "@/components/ui";
import s from "./shell.module.css";

const ROLE_LABEL: Record<WorkspaceRole, string> = { admin: "Admin", editor: "Editor", reviewer: "Reviewer", operator: "Operator", viewer: "Viewer", customer: "Customer" };

export function Topbar({ onMenu, onSearch, onPreview }: { onMenu: () => void; onSearch: () => void; onPreview: () => void }) {
  const { data: session } = useSession();
  const switchRole = useSwitchRole();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const dark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <header className={s.topbar}>
      <IconButton label="Open navigation" className={s.menuBtn} onClick={onMenu}>
        <Menu size={18} />
      </IconButton>
      <button type="button" className={s.searchBtn} onClick={onSearch} aria-keyshortcuts="Control+K Meta+K">
        <Search size={16} aria-hidden />
        <span className={s.searchText}>Search or jump to…</span>
        <span className={s.hideMobile}>
          <Kbd>⌘K</Kbd>
        </span>
      </button>
      <div className={s.topRight}>
        <span className={s.hideMobile}>
          <ModeBadge mode="local" />
        </span>
        {session ? (
          <label>
            <span className="sr-only">Demo role</span>
            <select
              className={s.roleSelect}
              value={session.role}
              disabled={switchRole.isPending}
              onChange={(e) =>
                switchRole.mutate(e.target.value as WorkspaceRole, {
                  onSuccess: (s2) => toast({ tone: "info", title: `Role: ${ROLE_LABEL[s2.role]}`, body: "New server session issued for your demo workspace." }),
                  onError: (err) => toast({ tone: "error", title: "Role switch failed", body: (err as Error).message }),
                })
              }
            >
              {session.switchableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <IconButton label={dark ? "Use light theme" : "Use dark theme"} onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        {DATA_MODE === "fixture" ? (
          <IconButton label="Preview states" onClick={onPreview}>
            <SlidersHorizontal size={18} />
          </IconButton>
        ) : null}
      </div>
    </header>
  );
}
