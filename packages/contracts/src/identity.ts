import { z } from "zod";
import { DataLabel, Id, IsoDateTime, TimeZone } from "./common";

/**
 * Workspace roles. The server derives the role from the session membership;
 * a role sent by the browser is never authority.
 * - admin: documents, configuration, providers, budgets, members
 * - editor: create/edit artifacts, agents, workflows, run agents
 * - reviewer: comment, approve/reject artifact versions
 * - operator: support inbox, tickets, human replies
 * - viewer: read-only within shared resources
 * - customer: help-desk end user, sees own conversations/tickets only
 */
export const WorkspaceRole = z.enum(["admin", "editor", "reviewer", "operator", "viewer", "customer"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRole>;

export const User = z.object({
  id: Id,
  displayName: z.string().min(1).max(80),
  email: z.string().email(),
  label: DataLabel,
});
export type User = z.infer<typeof User>;

export const Workspace = z.object({
  id: Id,
  name: z.string().min(1).max(80),
  kind: z.enum(["demo_visitor", "standard"]),
  timeZone: TimeZone,
  currency: z.literal("USD"),
  brandName: z.string().max(60),
  /** Demo workspaces expire and are reset; null for standard workspaces. */
  expiresAt: IsoDateTime.nullable(),
  label: DataLabel,
});
export type Workspace = z.infer<typeof Workspace>;

export const Membership = z.object({
  userId: Id,
  workspaceId: Id,
  role: WorkspaceRole,
});
export type Membership = z.infer<typeof Membership>;

export const Session = z.object({
  user: User,
  workspace: Workspace,
  role: WorkspaceRole,
  /** Roles the server allows this demo visitor to switch to inside their own workspace. */
  switchableRoles: z.array(WorkspaceRole),
  csrfToken: z.string(),
  expiresAt: IsoDateTime,
});
export type Session = z.infer<typeof Session>;

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const StartDemoRequest = z.object({
  /** Optional starting role; the server validates it against the demo role set. */
  role: WorkspaceRole.optional(),
});

export const SwitchRoleRequest = z.object({ role: WorkspaceRole });

export const Member = z.object({
  user: User,
  role: WorkspaceRole,
  joinedAt: IsoDateTime,
});
export type Member = z.infer<typeof Member>;
