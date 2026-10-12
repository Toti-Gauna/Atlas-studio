"use client";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import type { DocumentSummary, Project } from "@atlas/contracts";
import { api, isApiError } from "@/lib/api";
import { Button, Callout, Modal, Select, TextField, useToast } from "@/components/ui";
import { copy } from "@/copy/en";
import { libraryCopy as L } from "@/copy/library";

const MAX_BYTES = 5 * 1024 * 1024;
const BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const ALLOWED = new Set(Object.values(BY_EXT));
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const ACCEPT = ".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,text/csv,image/png,image/jpeg,image/webp";

/** Browsers report .md/.csv inconsistently (often empty or vnd.ms-excel); the extension decides then. */
function mimeOf(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED.has(file.type)) return file.type;
  return BY_EXT[ext] ?? file.type;
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error ?? new Error(L.upload.readFailed));
    r.readAsText(file);
  });
}

function validate(file: File | null): string | null {
  if (!file) return L.upload.noFile;
  if (!ALLOWED.has(mimeOf(file))) return L.upload.badType;
  if (file.size > MAX_BYTES) return L.upload.tooLarge((file.size / 1024 / 1024).toFixed(1));
  return null;
}

export function UploadModal({ open, onClose, projects, defaultProjectId, onUploaded }: { open: boolean; onClose: () => void; projects: Project[]; defaultProjectId?: string; onUploaded: (d: DocumentSummary) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [fileError, setFileError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const reset = () => {
    setFile(null);
    setTitle("");
    setFileError(null);
    setTouched(false);
    upload.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const upload = useMutation({
    mutationFn: async (f: File) => {
      const mimeType = mimeOf(f);
      const text = TEXT_TYPES.has(mimeType) ? await readText(f) : null;
      return api.documents.upload({ title: title.trim() || f.name, mimeType, projectId, text, byteSize: f.size });
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["project"] });
      toast({ tone: d.latestStatus === "failed" ? "info" : "success", title: L.upload.done, body: `${d.title} · ${L.status[d.latestStatus]}` });
      onUploaded(d);
      close();
    },
    onError: (e) => toast({ tone: "error", title: L.upload.failed, body: e instanceof Error ? e.message : undefined }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const err = validate(file);
    setFileError(err);
    if (err || !file || !projectId) return;
    upload.mutate(file);
  };

  const mime = file ? mimeOf(file) : null;
  const serverError = upload.error;
  const formId = "upload-form";
  return (
    <Modal
      open={open}
      onClose={close}
      title={L.upload.title}
      description={L.upload.description}
      footer={
        <>
          <Button onClick={close}>{copy.actions.cancel}</Button>
          <Button type="submit" form={formId} variant="primary" icon={<Upload size={14} />} loading={upload.isPending} disabled={!file || !projectId}>
            {L.upload.submit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <TextField
          label={L.upload.file}
          type="file"
          accept={ACCEPT}
          hint={L.upload.fileHint}
          error={touched || file ? fileError : null}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setFileError(validate(f));
            upload.reset();
            if (f && !title) setTitle(f.name);
          }}
        />
        <TextField label={L.upload.titleField} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <Select label={L.upload.project} value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} error={touched && !projectId ? L.upload.noProject : null} />
        {mime === "application/pdf" && !fileError ? <Callout tone="info">{L.upload.pdfNote}</Callout> : null}
        {mime?.startsWith("image/") && !fileError ? <Callout tone="info">{L.upload.imageNote}</Callout> : null}
        <div aria-live="assertive">
          {serverError ? (
            <Callout tone="danger">
              <strong>{isApiError(serverError) ? serverError.code : L.upload.failed}</strong> — {serverError instanceof Error ? serverError.message : L.upload.failed}
            </Callout>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
