import { z } from "zod";
import { DataLabel, Id, IsoDateTime } from "./common";

export const Project = z.object({
  id: Id,
  name: z.string().min(1).max(80),
  objective: z.string().max(400),
  defaultAgentId: Id.nullable(),
  color: z.enum(["teal", "violet", "amber", "slate"]),
  documentCount: z.number().int().nonnegative(),
  conversationCount: z.number().int().nonnegative(),
  artifactCount: z.number().int().nonnegative(),
  memoryEnabled: z.boolean(),
  label: DataLabel,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Project = z.infer<typeof Project>;

export const MemoryScope = z.enum(["project_context", "user_preference"]);
export type MemoryScope = z.infer<typeof MemoryScope>;

/**
 * Memory is opt-in and visible. An item only influences new runs when it is
 * approved AND enabled AND (for project_context) belongs to the run's project.
 * Proposed items wait for the owner's approval — no hidden inferences.
 */
export const MemoryItem = z.object({
  id: Id,
  scope: MemoryScope,
  projectId: Id.nullable(),
  ownerUserId: Id,
  content: z.string().min(1).max(500),
  status: z.enum(["proposed", "approved", "disabled"]),
  source: z.enum(["user_entered", "proposed_by_agent"]),
  sourceRunId: Id.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type MemoryItem = z.infer<typeof MemoryItem>;

export const MemoryConsent = z.object({
  projectId: Id,
  userId: Id,
  enabled: z.boolean(),
  changedAt: IsoDateTime,
});
export type MemoryConsent = z.infer<typeof MemoryConsent>;

export const CreateProjectRequest = z.object({
  name: z.string().min(1).max(80),
  objective: z.string().max(400),
  defaultAgentId: Id.nullable(),
});

export const CreateMemoryRequest = z.object({
  scope: MemoryScope,
  projectId: Id.nullable(),
  content: z.string().min(1).max(500),
});

export const UpdateMemoryRequest = z.object({
  content: z.string().min(1).max(500).optional(),
  status: z.enum(["approved", "disabled"]).optional(),
});
