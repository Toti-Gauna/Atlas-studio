import type { ShareRole, WorkspaceRole } from "@atlas/contracts";

/**
 * Workspace permission matrix. The API evaluates `can(role, action)` from the
 * session membership; resource ownership/share checks are applied on top.
 */
export const ACTIONS = [
  "project.read",
  "project.write",
  "memory.write",
  "document.read",
  "document.upload",
  "document.admin",
  "conversation.use",
  "agent.read",
  "agent.write",
  "artifact.read",
  "artifact.write",
  "artifact.share",
  "review.decide",
  "review.comment",
  "workflow.read",
  "workflow.write",
  "workflow.run",
  "usage.read",
  "budget.admin",
  "privacy.read",
  "privacy.admin",
  "ticket.inbox",
  "ticket.reply_own",
  "evaluation.run",
  "settings.admin",
] as const;
export type Action = (typeof ACTIONS)[number];

const MATRIX: Record<WorkspaceRole, readonly Action[]> = {
  admin: ACTIONS,
  editor: [
    "project.read", "project.write", "memory.write", "document.read", "document.upload", "conversation.use", "agent.read", "agent.write",
    "artifact.read", "artifact.write", "artifact.share", "review.comment", "workflow.read", "workflow.write", "workflow.run", "usage.read", "privacy.read",
  ],
  reviewer: ["project.read", "document.read", "conversation.use", "agent.read", "artifact.read", "review.decide", "review.comment", "workflow.read", "usage.read", "privacy.read"],
  operator: ["project.read", "document.read", "conversation.use", "agent.read", "artifact.read", "ticket.inbox", "ticket.reply_own", "privacy.read"],
  viewer: ["project.read", "document.read", "agent.read", "artifact.read", "workflow.read", "privacy.read"],
  customer: ["conversation.use", "ticket.reply_own"],
};

export function can(role: WorkspaceRole, action: Action): boolean {
  return MATRIX[role].includes(action);
}

export function permissionMatrix(): Record<WorkspaceRole, readonly Action[]> {
  return MATRIX;
}

/** Artifact-level role check: owner > editor > reviewer > viewer. */
export function canOnArtifact(share: ShareRole | "owner" | null, action: "view" | "edit" | "review" | "comment" | "share"): boolean {
  if (!share) return false;
  if (share === "owner") return true;
  switch (action) {
    case "view":
      return true;
    case "edit":
      return share === "editor";
    case "review":
      return share === "reviewer";
    case "comment":
      return share === "editor" || share === "reviewer";
    case "share":
      return false;
  }
}

export const DEMO_SWITCHABLE_ROLES: WorkspaceRole[] = ["admin", "editor", "reviewer", "operator", "viewer", "customer"];
