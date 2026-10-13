"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ArtifactContent, ExportFormat, SourceRef } from "@atlas/contracts";
import { api } from "@/lib/api";
import { deliverablesCopy } from "@/copy/deliverables";
import { useToast } from "@/components/ui";

const c = deliverablesCopy.canvas;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function useExportArtifact() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, version, format }: { id: string; version: number; format: ExportFormat }) => api.artifacts.export(id, version, format),
    onSuccess: (file) => {
      downloadBlob(file.blob, file.filename);
      toast({ tone: "success", title: c.exported, body: file.filename });
    },
    onError: (e) => toast({ tone: "error", title: c.exportFailed, body: (e as Error).message }),
  });
}

export function useSaveArtifact(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: { baseVersion: number; content: ArtifactContent; sources: SourceRef[]; changeNote: string }) => api.artifacts.save(id, body),
    onSuccess: (d) => {
      qc.setQueryData(["artifact", id], d);
      void qc.invalidateQueries({ queryKey: ["artifacts"] });
      void qc.invalidateQueries({ queryKey: ["reviews"] });
      toast({ tone: "success", title: c.saved(d.currentVersion) });
    },
    onError: (e) => toast({ tone: "error", title: c.notSaved, body: (e as Error).message }),
  });
}
