"use client";
import { Menu, MessageSquarePlus, Moon, Search, Sun } from "lucide-react";
import { copy } from "@/copy/en";
import { useCan } from "@/lib/state/session";
import { useTheme } from "@/lib/state/theme";
import { IconButton, Kbd, LinkButton } from "@/components/ui";
import s from "./shell.module.css";

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { theme, setTheme } = useTheme();
  const canChat = useCan("conversation.use");
  const dark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <header className={s.topbar}>
      <IconButton label="Open navigation" className={s.menuBtn} onClick={onMenu}>
        <Menu size={18} />
      </IconButton>
      <button type="button" className={s.searchBtn} onClick={onSearch} aria-keyshortcuts="Control+K Meta+K" aria-label="Search or jump to">
        <Search size={16} aria-hidden />
        <span className={s.searchText}>Search or jump to…</span>
        <span className={s.hideMobile}>
          <Kbd>⌘K</Kbd>
        </span>
      </button>
      <div className={s.topRight}>
        {canChat ? (
          <LinkButton href="/app/chat/?new=1" variant="primary" size="sm" icon={<MessageSquarePlus size={14} aria-hidden />} className={s.newChat}>
            <span className={s.newChatText}>{copy.nav.newChat}</span>
          </LinkButton>
        ) : null}
        <IconButton label={dark ? "Use light theme" : "Use dark theme"} onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
      </div>
    </header>
  );
}
