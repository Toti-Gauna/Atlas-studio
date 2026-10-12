"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";

/** Query keys shared with ArtifactWorkspace (["artifact", id]) and its save mutation (["artifacts"], ["reviews"]). */
export const keys = {
  artifacts: ["artifacts"] as const,
  artifact: (id: string) => ["artifact", id] as const,
  comments: (id: string) => ["artifact-comments", id] as const,
  shares: (id: string) => ["artifact-shares", id] as const,
  reviews: ["reviews", "all"] as const,
  members: ["members"] as const,
  projects: ["projects"] as const,
};

export function useProjects() {
  const canRead = useCan("project.read");
  return useQuery({ queryKey: keys.projects, queryFn: api.projects.list, enabled: canRead });
}

export function useMembers(enabled = true) {
  return useQuery({ queryKey: keys.members, queryFn: api.members, enabled, staleTime: 60_000 });
}

export function useAllReviews(enabled = true) {
  return useQuery({ queryKey: keys.reviews, queryFn: () => api.reviews.list(), enabled });
}

/** Strips internal idempotency markers from change notes before display. */
export const cleanNote = (note: string) => note.replace(/\s*\[idem:[^\]]+\]/g, "").trim() || "—";
