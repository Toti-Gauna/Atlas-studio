/** FIXTURE (P02 preview only): authorization-scoped reads used by the preview engine. */
import type { AgentConfig, AgentVersion, ModelRegistryEntry, RoutingDecision, TaskKind, Capability } from "@atlas/contracts";
import { MODEL_REGISTRY, route, type ChunkInput } from "@atlas/domain";
import type { Db } from "./db";
import { previewState } from "./preview";

export function registryNow(): ModelRegistryEntry[] {
  const { localAdapterOnline } = previewState.get();
  return MODEL_REGISTRY.map((m) =>
    m.provider === "local" && !localAdapterOnline
      ? { ...m, availability: { mode: "pending" as const, reason: "Local adapter offline (preview control)." } }
      : m,
  );
}

/** Published, non-deleted chunks of documents in the project, filtered BEFORE scoring. */
export function authorizedChunks(db: Db, projectId: string, config?: AgentConfig): ChunkInput[] {
  const out: ChunkInput[] = [];
  for (const d of db.documents) {
    if (d.deleted || !d.summary.projectIds.includes(projectId)) continue;
    if (config?.sourceScope.mode === "selected_documents" && !config.sourceScope.documentIds.includes(d.summary.id)) continue;
    const published = d.versions.find((v) => v.published);
    if (!published) continue;
    for (const c of d.chunks[published.id] ?? []) {
      out.push({ id: c.id, documentId: d.summary.id, versionId: published.id, version: published.version, documentTitle: d.summary.title, page: c.page, text: c.text });
    }
  }
  return out;
}

export function currentAgentVersion(db: Db, agentId: string): AgentVersion | null {
  const a = db.agents.find((x) => x.summary.id === agentId && !x.deleted);
  if (!a) return null;
  return a.versions.find((v) => v.version === a.summary.currentVersion) ?? null;
}

export function activeMemoryIds(db: Db, projectId: string, userId: string): string[] {
  const project = db.projects.find((p) => p.id === projectId);
  return db.memories
    .filter((m) => m.status === "approved")
    .filter((m) => (m.scope === "user_preference" ? m.ownerUserId === userId : project?.memoryEnabled && m.projectId === projectId))
    .map((m) => m.id);
}

export function routeFor(
  db: Db,
  task: TaskKind,
  pinned: string | null,
  agentModelKey: string | null,
  caps: Capability[],
  approvedFallbackKey?: string | null,
): RoutingDecision {
  return route({ task, pinnedModelKey: pinned, agentModelKey, requiredCapabilities: caps, approvedFallbackKey: approvedFallbackKey ?? null }, db.routingPolicy, registryNow());
}

export function taskForProfile(profile: string): TaskKind {
  switch (profile) {
    case "compliance":
      return "compliance_review";
    case "data":
      return "data_analysis";
    case "presentation":
      return "presentation";
    case "architecture":
      return "architecture";
    case "sales":
    case "research":
      return "drafting";
    default:
      return "chat_answer";
  }
}

export function hashConfig(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `cfg_${(h >>> 0).toString(16).padStart(8, "0")}`;
}
