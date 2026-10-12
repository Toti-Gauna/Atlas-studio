"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Maximize2, PenLine, Save } from "lucide-react";
import type { ArtifactContent, ArtifactDetail, ExportFormat } from "@atlas/contracts";
import { supportedFormats } from "@atlas/renderers";
import { api } from "@/lib/api";
import { canOnArtifact } from "@atlas/domain";
import { Badge, Button, Callout, ErrorState, LoadingBlock, Segmented, TextField } from "@/components/ui";
import { ArtifactPreview } from "./ArtifactPreview";
import { ArtifactEditor } from "./ArtifactEditor";
import { useExportArtifact, useSaveArtifact } from "./useArtifactActions";
import s from "./artifact.module.css";

export const REVIEW_TONE = { draft: "neutral", in_review: "info", approved: "teal", changes_requested: "warn" } as const;
export const REVIEW_LABEL = { draft: "Draft", in_review: "In review", approved: "Approved", changes_requested: "Changes requested" } as const;

/**
 * Canvas: preview and structured edit of the version you are viewing. Export
 * always renders the saved version shown, so preview and download match.
 */
export function ArtifactWorkspace({ detail, compact }: { detail: ArtifactDetail; compact?: boolean }) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [viewVersion, setViewVersion] = useState(detail.currentVersion);
  const [draft, setDraft] = useState<ArtifactContent>(detail.current.content);
  const [note, setNote] = useState("");
  const save = useSaveArtifact(detail.id);
  const exp = useExportArtifact();
  const canEdit = canOnArtifact(detail.myRole, "edit");

  // Reset view and draft when a new version is saved (render-time sync, no effect).
  const [syncedVersion, setSyncedVersion] = useState(detail.currentVersion);
  if (syncedVersion !== detail.currentVersion) {
    setSyncedVersion(detail.currentVersion);
    setViewVersion(detail.currentVersion);
    setDraft(detail.current.content);
  }

  const versionQ = useQuery({
    queryKey: ["artifact", detail.id, "v", viewVersion],
    queryFn: () => api.artifacts.version(detail.id, viewVersion),
    enabled: viewVersion !== detail.currentVersion,
  });
  const shown = viewVersion === detail.currentVersion ? detail.current : versionQ.data;
  const dirty = JSON.stringify(draft) !== JSON.stringify(detail.current.content);

  return (
    <div>
      <div className={s.toolbar}>
        <Badge tone={REVIEW_TONE[shown?.reviewState ?? "draft"]}>{REVIEW_LABEL[shown?.reviewState ?? "draft"]}</Badge>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <span className="sr-only">Version</span>
          <select value={viewVersion} onChange={(e) => { setViewVersion(Number(e.target.value)); setMode("preview"); }} style={{ height: 30, borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", padding: "0 8px" }}>
            {[...detail.versions].reverse().map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version}{v.version === detail.currentVersion ? " (current)" : ""}{v.reviewState === "approved" ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>
        {canEdit && viewVersion === detail.currentVersion ? (
          <Segmented<"preview" | "edit"> label="Canvas mode" value={mode} onChange={setMode} options={[{ value: "preview", label: "Preview" }, { value: "edit", label: "Edit" }]} />
        ) : null}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {compact ? (
            <Link href={`/app/artifact/?id=${detail.id}`} className="sr-only-focusable" aria-label="Open full view" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "var(--teal-ink)", textDecoration: "none" }}>
              <Maximize2 size={14} aria-hidden /> Full view
            </Link>
          ) : null}
        </div>
      </div>
      <div className={s.panelBody}>
        {mode === "edit" && viewVersion === detail.currentVersion ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ArtifactEditor value={draft} onChange={setDraft} />
            <TextField label="Change note" placeholder="What changed?" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            {detail.current.reviewState === "approved" || detail.current.reviewState === "in_review" ? (
              <Callout tone="warn">Saving creates v{detail.currentVersion + 1}. The {detail.current.reviewState === "approved" ? "approval" : "open review"} stays bound to v{detail.currentVersion}; the new version needs its own review.</Callout>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                variant="primary"
                icon={<Save size={14} />}
                disabled={!dirty}
                loading={save.isPending}
                onClick={() =>
                  save.mutate(
                    { baseVersion: detail.currentVersion, content: draft, sources: detail.current.sources, changeNote: note.trim() || "Edited in canvas" },
                    { onSuccess: () => { setMode("preview"); setNote(""); } },
                  )
                }
              >
                Save as v{detail.currentVersion + 1}
              </Button>
              <Button icon={<Eye size={14} />} onClick={() => setMode("preview")}>
                Preview
              </Button>
              {dirty ? <Button variant="ghost" onClick={() => setDraft(detail.current.content)}>Discard changes</Button> : null}
            </div>
          </div>
        ) : !shown ? (
          versionQ.isError ? <ErrorState error={versionQ.error} compact /> : <LoadingBlock rows={3} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span className="eyebrow" style={{ marginRight: 4 }}>Export v{shown.version}</span>
              {supportedFormats(shown.content).map((f: ExportFormat) => (
                <Button key={f} size="sm" icon={<Download size={13} />} loading={exp.isPending && exp.variables?.format === f} onClick={() => exp.mutate({ id: detail.id, version: shown.version, format: f })}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
            {!canEdit ? <Callout>You have {detail.myRole} access: you can view and export this artifact but not edit it.</Callout> : null}
            <ArtifactPreview content={shown.content} sources={shown.sources} />
            <div style={{ fontSize: 12, color: "var(--text-3)", display: "flex", gap: 6, alignItems: "center" }}>
              <PenLine size={12} aria-hidden /> v{shown.version} by {shown.authorName} · {shown.changeNote.replace(/\s*\[idem:[^\]]+\]/, "")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CanvasPanel({ artifactId }: { artifactId: string }) {
  const q = useQuery({ queryKey: ["artifact", artifactId], queryFn: () => api.artifacts.get(artifactId) });
  if (q.isPending) return <div style={{ padding: 16 }}><LoadingBlock rows={4} /></div>;
  if (q.isError) return <div style={{ padding: 16 }}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div>;
  return (
    <div>
      <div style={{ padding: "12px 16px 0", fontFamily: "var(--font-display)", fontWeight: 700 }}>{q.data.title}</div>
      <ArtifactWorkspace detail={q.data} compact />
    </div>
  );
}
