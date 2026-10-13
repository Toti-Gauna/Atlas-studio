"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bot, Boxes, Compass, FileText, FolderKanban, MessageSquarePlus, MessagesSquare, Moon, Search } from "lucide-react";
import { can } from "@atlas/domain";
import { api } from "@/lib/api";
import { useSession } from "@/lib/state/session";
import { useTheme } from "@/lib/state/theme";
import { Kbd } from "@/components/ui";
import { ALL_NAV, canSee } from "./nav";
import s from "./shell.module.css";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const role = session?.role;
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: open && Boolean(role && can(role, "project.read")) });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list, enabled: open && Boolean(role && can(role, "agent.read")) });
  const docs = useQuery({ queryKey: ["documents", null], queryFn: () => api.documents.list(), enabled: open && Boolean(role && can(role, "document.read")) });
  const deliverables = useQuery({ queryKey: ["artifacts", null], queryFn: () => api.artifacts.list(), enabled: open && Boolean(role && can(role, "artifact.read")) });
  const convs = useQuery({ queryKey: ["conversations", null], queryFn: () => api.conversations.list(), enabled: open && Boolean(role) });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && d.open) d.close();
  }, [open]);

  const go = (href: string) => () => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (role && can(role, "conversation.use")) out.push({ id: "new-chat", group: "Actions", label: "Ask a question", hint: "New chat", icon: <MessageSquarePlus size={16} />, run: go("/app/chat/?new=1") });
    out.push({ id: "tours", group: "Actions", label: "Take a guided tour", icon: <Compass size={16} />, run: go("/app/showcase/") });
    out.push({ id: "theme", group: "Actions", label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`, icon: <Moon size={16} />, run: () => { setTheme(theme === "dark" ? "light" : "dark"); onClose(); } });
    for (const n of ALL_NAV) if (canSee(role, n)) out.push({ id: `nav-${n.href}`, group: "Go to", label: n.label, icon: <n.icon size={16} />, run: go(n.href) });
    for (const p of projects.data ?? []) out.push({ id: `p-${p.id}`, group: "Projects", label: p.name, hint: `${p.documentCount} sources`, icon: <FolderKanban size={16} />, run: go(`/app/project/?id=${p.id}`) });
    for (const d of deliverables.data ?? []) out.push({ id: `d-${d.id}`, group: "Deliverables", label: d.title, hint: `v${d.currentVersion}`, icon: <Boxes size={16} />, run: go(`/app/artifact/?id=${d.id}`) });
    for (const d of docs.data ?? []) out.push({ id: `s-${d.id}`, group: "Sources", label: d.title, icon: <FileText size={16} />, run: go(`/app/document/?id=${d.id}`) });
    for (const a of agents.data ?? []) out.push({ id: `a-${a.id}`, group: "Agents", label: a.name, hint: `v${a.currentVersion}`, icon: <Bot size={16} />, run: go(`/app/agent/?id=${a.id}`) });
    for (const c of (convs.data ?? []).slice(0, 8)) out.push({ id: `c-${c.id}`, group: "Recent conversations", label: c.title, icon: <MessagesSquare size={16} />, run: go(`/app/chat/?c=${c.id}`) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, theme, projects.data, agents.data, convs.data, docs.data, deliverables.data]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    // Sources and deliverables appear once you type, so the empty palette stays short.
    return t ? items.filter((i) => i.label.toLowerCase().includes(t) || i.group.toLowerCase().includes(t)) : items.filter((i) => i.group !== "Sources" && i.group !== "Deliverables");
  }, [items, q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <dialog
      ref={ref}
      className={s.palette}
      aria-label="Command palette"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <>
          <div className={s.paletteSearch}>
            <Search size={18} aria-hidden />
            <input
              ref={inputRef}
              className={s.paletteInput}
              placeholder="Search sources, deliverables, projects, conversations…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={filtered[active] ? `pal-${filtered[active].id}` : undefined}
            />
          </div>
          <ul id="palette-list" role="listbox" className={s.paletteList}>
            {filtered.length === 0 ? <li className={s.paletteEmpty}>No matches.</li> : null}
            {filtered.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <li key={item.id} role="presentation">
                  {header ? <div className={s.paletteGroup}>{header}</div> : null}
                  <div id={`pal-${item.id}`} role="option" aria-selected={i === active} className={s.paletteItem} onMouseEnter={() => setActive(i)} onClick={item.run}>
                    {item.icon}
                    <span>{item.label}</span>
                    {item.hint ? <span className={s.paletteHint}>{item.hint}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className={s.paletteFoot}>
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
            </span>
            <span>
              <Kbd>Enter</Kbd> open
            </span>
            <span>
              <Kbd>Esc</Kbd> close
            </span>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
