"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui";
import { projectsCopy as P } from "@/copy/projects";

type Patch = Partial<Pick<Project, "name" | "objective" | "defaultAgentId" | "memoryEnabled">>;

/** PATCH /projects/:id; the server stays the authority (project.write). */
export function useProjectUpdate(id: string, successTitle: (p: Project, patch: Patch) => string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (patch: Patch) => api.projects.update(id, patch),
    onSuccess: (p, patch) => {
      qc.setQueryData(["project", id], p);
      void qc.invalidateQueries({ queryKey: ["projects"] });
      if (patch.defaultAgentId !== undefined || patch.objective !== undefined) void qc.invalidateQueries({ queryKey: ["recommendations"] });
      toast({ tone: "success", title: successTitle(p, patch) });
    },
    onError: (e) => toast({ tone: "error", title: P.detail.updateFailed, body: e instanceof Error ? e.message : undefined }),
  });
}
