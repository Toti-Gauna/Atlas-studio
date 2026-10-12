import { BarChart3, Bot, Boxes, FolderKanban, Gauge, History, Home, Inbox, Library, MessagesSquare, Settings, ShieldCheck, Workflow, type LucideIcon } from "lucide-react";
import type { WorkspaceRole } from "@atlas/contracts";
import { can, type Action } from "@atlas/domain";
import { copy } from "@/copy/en";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when the session role lacks this action (server still enforces). */
  requires?: Action;
  /** Visible when the role has any of these actions. */
  requiresAny?: Action[];
  match?: string[];
}

export interface NavGroup {
  id: string;
  /** Primary group has no heading. */
  label?: string;
  /** Collapsible groups start closed unless the current route is inside. */
  collapsible?: boolean;
  items: NavItem[];
}

/**
 * Information architecture: daily work first, building second, administration
 * folded away. Guided tours and preview tooling live in the demo banner.
 */
export const NAV: NavGroup[] = [
  {
    id: "work",
    items: [
      { href: "/app/", label: copy.nav.home, icon: Home },
      { href: "/app/chat/", label: copy.nav.chat, icon: MessagesSquare, requires: "conversation.use" },
      { href: "/app/projects/", label: copy.nav.projects, icon: FolderKanban, requires: "project.read", match: ["/app/project/"] },
      { href: "/app/library/", label: copy.nav.library, icon: Library, requires: "document.read", match: ["/app/document/"] },
      { href: "/app/artifacts/", label: copy.nav.artifacts, icon: Boxes, requires: "artifact.read", match: ["/app/artifact/"] },
      { href: "/app/inbox/", label: copy.nav.inbox, icon: Inbox, requiresAny: ["artifact.read", "ticket.reply_own", "privacy.read"], match: ["/app/ticket/", "/app/reviews/"] },
    ],
  },
  {
    id: "build",
    label: copy.nav.groupBuild,
    items: [
      { href: "/app/agents/", label: copy.nav.agents, icon: Bot, requires: "agent.read", match: ["/app/agent/"] },
      { href: "/app/workflows/", label: copy.nav.workflows, icon: Workflow, requires: "workflow.read", match: ["/app/workflow/"] },
    ],
  },
  {
    id: "admin",
    label: copy.nav.groupAdmin,
    collapsible: true,
    items: [
      { href: "/app/usage/", label: copy.nav.usage, icon: BarChart3, requires: "usage.read" },
      { href: "/app/privacy/", label: copy.nav.privacy, icon: ShieldCheck, requires: "privacy.read" },
      { href: "/app/runs/", label: copy.nav.runs, icon: History, requires: "project.read" },
      { href: "/app/evaluations/", label: copy.nav.evaluations, icon: Gauge, requires: "usage.read" },
      { href: "/app/settings/", label: copy.nav.settings, icon: Settings, requires: "project.read" },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);

export function canSee(role: WorkspaceRole | undefined, item: NavItem): boolean {
  if (item.requires) return Boolean(role && can(role, item.requires));
  if (item.requiresAny) return Boolean(role && item.requiresAny.some((a) => can(role, a)));
  return true;
}

export function isActive(pathname: string, item: NavItem): boolean {
  const p = pathname.replace(/\/?$/, "/");
  if (item.href === "/app/") return p === "/app/";
  return p.startsWith(item.href) || (item.match ?? []).some((m) => p.startsWith(m));
}
