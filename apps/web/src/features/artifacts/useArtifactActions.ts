"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ArtifactContent, ExportFormat, SourceRef } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui";

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
      toast({ tone: "success", title: "Export ready", body: file.filename });
    },
    onError: (e) => toast({ tone: "error", title: "Export failed", body: (e as Error).message }),
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
      toast({ tone: "success", title: `Saved as v${d.currentVersion}`, body: "Edits create a new version; earlier approvals stay with their version." });
    },
    onError: (e) => toast({ tone: "error", title: "Not saved", body: (e as Error).message }),
  });
}
