"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, FolderPlus, Upload } from "lucide-react";
import type { DocumentSummary, IngestionStatus } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { Button, Callout, EmptyState, LinkButton, PageHeader, QueryState, Select, StatusBadge, statusLabel } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import { DocumentsTable, FailureReason } from "./DocumentsTable";
import { SearchPanel } from "./SearchPanel";
import { UploadModal } from "./UploadModal";
import s from "./library.module.css";

const STATUSES: IngestionStatus[] = ["queued", "parsing", "indexing", "ready", "failed"];

export function LibraryView() {
  const canUpload = useCan("document.upload");
  const canProjects = useCan("project.read");
  const docs = useQuery({ queryKey: ["documents", null], queryFn: () => api.documents.list() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: canProjects });
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | IngestionStatus>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lastUpload, setLastUpload] = useState<DocumentSummary | null>(null);

  const filtered = useMemo(
    () => (docs.data ?? []).filter((d) => (!projectFilter || d.projectIds.includes(projectFilter)) && (!statusFilter || d.latestStatus === statusFilter)),
    [docs.data, projectFilter, statusFilter],
  );
  // Show the server's current view of the uploaded row (status may differ from the upload response).
  const uploadedNow = lastUpload ? (docs.data?.find((d) => d.id === lastUpload.id) ?? lastUpload) : null;
  const clearFilters = () => {
    setProjectFilter("");
    setStatusFilter("");
  };
  // Every document belongs to a project: with none, the way forward is creating one (E22).
  const noProjects = projects.isSuccess && projects.data.length === 0;
  const headerAction = !canUpload ? null : noProjects ? (
    <LinkButton href="/app/projects/" variant="primary" icon={<FolderPlus size={14} aria-hidden />}>
      {L.list.noProjectsTitle}
    </LinkButton>
  ) : (
    <Button variant="primary" icon={<Upload size={14} />} onClick={() => setUploadOpen(true)} disabled={!projects.data?.length}>
      {L.list.upload}
    </Button>
  );

  return (
    <Page wide>
      <PageHeader title={L.list.title} description={L.list.description} actions={headerAction} />

      <SearchPanel projectId={projectFilter || undefined} />

      <div className={s.filters} role="group" aria-label={L.list.filtersLabel}>
        <Select
          label={L.list.filterProject}
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          options={[{ value: "", label: L.list.allProjects }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))]}
        />
        <Select
          label={L.list.filterStatus}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | IngestionStatus)}
          options={[{ value: "", label: L.list.allStatuses }, ...STATUSES.map((st) => ({ value: st, label: statusLabel("document", st) }))]}
        />
      </div>

      <div aria-live="polite">
        {uploadedNow ? (
          <div className={s.uploadNotice}>
            <Callout tone={uploadedNow.latestStatus === "failed" ? "warn" : "teal"}>
              <span className={s.uploadNoticeRow}>
                <strong>{uploadedNow.title}</strong>
                <StatusBadge kind="document" status={uploadedNow.latestStatus} />
              </span>
              {uploadedNow.latestStatus === "failed" ? <FailureReason id={uploadedNow.id} /> : uploadedNow.kind === "image" ? L.upload.imageNote : null}
            </Callout>
          </div>
        ) : null}
      </div>

      <QueryState
        query={docs}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState title={L.list.emptyTitle} body={noProjects && canUpload ? L.list.noProjectsBody : L.list.emptyBody} icon={<FolderOpen size={22} />} />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState title={L.list.emptyFiltered} body={L.list.emptyFilteredBody} action={<Button onClick={clearFilters}>{L.list.clearFilters}</Button>} />
          ) : (
            <DocumentsTable docs={filtered} projects={projects.data} highlightId={lastUpload?.id} />
          )
        }
      </QueryState>

      {canUpload && projects.data?.length ? (
        <UploadModal key={projectFilter} open={uploadOpen} onClose={() => setUploadOpen(false)} projects={projects.data} defaultProjectId={projectFilter || undefined} onUploaded={setLastUpload} />
      ) : null}
    </Page>
  );
}
