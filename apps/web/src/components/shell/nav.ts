import { BarChart3, Bot, Boxes, FileCheck2, FolderKanban, Gauge, History, Home, Inbox, Library, MessagesSquare, Settings, ShieldCheck, Sparkles, Workflow, type LucideIcon } from "lucide-react";
import { copy } from "@/copy/en";
import type { Action } from "@atlas/domain";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when the session role lacks this action (server still enforces). */
  requires?: Action;
  match?: string[];
}

export const NAV: Array<{ label: string; items: NavItem[] }> = [
  {
    label: copy.nav.groupWork,
    items: [
      { href: "/app/", label: copy.nav.home, icon: Home },
      { href: "/app/chat/", label: copy.nav.chat, icon: MessagesSquare, requires: "conversation.use" },
      { href: "/app/projects/", label: copy.nav.projects, icon: FolderKanban, requires: "project.read", match: ["/app/project/"] },
      { href: "/app/library/", label: copy.nav.library, icon: Library, requires: "document.read", match: ["/app/document/"] },
      { href: "/app/artifacts/", label: copy.nav.artifacts, icon: Boxes, requires: "artifact.read", match: ["/app/artifact/"] },
      { href: "/app/reviews/", label: copy.nav.reviews, icon: FileCheck2, requires: "artifact.read" },
    ],
  },
  {
    label: copy.nav.groupBuild,
    items: [
      { href: "/app/agents/", label: copy.nav.agents, icon: Bot, requires: "agent.read", match: ["/app/agent/"] },
      { href: "/app/workflows/", label: copy.nav.workflows, icon: Workflow, requires: "workflow.read", match: ["/app/workflow/"] },
      { href: "/app/showcase/", label: copy.nav.showcase, icon: Sparkles, requires: "project.read" },
    ],
  },
  {
    label: copy.nav.groupOperate,
    items: [
      { href: "/app/inbox/", label: copy.nav.inbox, icon: Inbox, requires: "ticket.reply_own", match: ["/app/ticket/"] },
      { href: "/app/usage/", label: copy.nav.usage, icon: BarChart3, requires: "usage.read" },
      { href: "/app/privacy/", label: copy.nav.privacy, icon: ShieldCheck, requires: "privacy.read" },
      { href: "/app/runs/", label: copy.nav.runs, icon: History, requires: "project.read" },
      { href: "/app/evaluations/", label: copy.nav.evaluations, icon: Gauge, requires: "usage.read" },
      { href: "/app/settings/", label: copy.nav.settings, icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);

export function isActive(pathname: string, item: NavItem): boolean {
  const p = pathname.replace(/\/?$/, "/");
  if (item.href === "/app/") return p === "/app/";
  return p.startsWith(item.href) || (item.match ?? []).some((m) => p.startsWith(m));
}
