"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Trash2 } from "lucide-react";
import type { DocumentDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { Button, Modal, useToast } from "@/components/ui";
import { copy } from "@/copy/en";
import { libraryCopy as L } from "@/copy/library";

/** Admin-only actions; the server re-checks document.admin. */
export function DocumentActions({ doc, onReindexed }: { doc: DocumentDetail; onReindexed: (version: number) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const errBody = (e: unknown) => (e instanceof Error ? e.message : undefined);

  const reindex = useMutation({
    mutationFn: () => api.documents.reindex(doc.id),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["document", doc.id] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ tone: "success", title: L.detail.reindexed(d.publishedVersion ?? 0) });
      if (d.publishedVersion) onReindexed(d.publishedVersion);
    },
    onError: (e) => toast({ tone: "error", title: L.detail.reindexFailed, body: errBody(e) }),
  });
  const remove = useMutation({
    mutationFn: () => api.documents.remove(doc.id),
    onSuccess: () => {
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
      qc.removeQueries({ queryKey: ["document", doc.id] });
      toast({ tone: "success", title: L.detail.deleted, body: doc.title });
      router.push("/app/library/");
    },
    onError: (e) => toast({ tone: "error", title: L.detail.deleteFailed, body: errBody(e) }),
  });

  return (
    <>
      <Button icon={<RefreshCw size={14} />} loading={reindex.isPending} onClick={() => reindex.mutate()}>
        {L.detail.reindex}
      </Button>
      <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmOpen(true)}>
        {L.detail.delete}
      </Button>
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={L.detail.deleteTitle}
        description={doc.title}
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>{copy.actions.cancel}</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              {L.detail.delete}
            </Button>
          </>
        }
      >
        <p>{L.detail.deleteBody}</p>
      </Modal>
    </>
  );
}
