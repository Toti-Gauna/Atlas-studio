"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, Maximize2, PenLine, Save } from "lucide-react";
import type { ArtifactContent, ArtifactDetail, ReviewState } from "@atlas/contracts";
import { canOnArtifact } from "@atlas/domain";
import { api } from "@/lib/api";
import { deliverablesCopy } from "@/copy/deliverables";
import { Button, Callout, ErrorState, LoadingBlock, Segmented, StatusBadge, TextField } from "@/components/ui";
import { MenuItem, Popover } from "@/components/ui";
import { ArtifactPreview } from "./ArtifactPreview";
import { ArtifactEditor } from "./ArtifactEditor";
import { useExportArtifact, useSaveArtifact } from "./useArtifactActions";
import { nativeFormat, otherFormats } from "./formats";
import s from "./artifact.module.css";

const c = deliverablesCopy.canvas;

/** Artifact review state in the shared status dictionary ("in review" = an open review request). */
export const reviewStatusKey = (state: ReviewState) => (state === "in_review" ? "open" : state);

/** Review state as a badge, or nothing for a plain draft (badges mark exceptions). */
export function ReviewStateBadge({ state, showDraft }: { state: ReviewState; showDraft?: boolean }) {
  if (state === "draft" && !showDraft) return null;
  return <StatusBadge kind="review" status={reviewStatusKey(state)} />;
}

function ExportActions({ id, version, content }: { id: string; version: number; content: ArtifactContent }) {
  const exp = useExportArtifact();
  const native = nativeFormat(content);
  const others = otherFormats(content);
  return (
    <div className={s.exportGroup}>
      <Button size="sm" variant="primary" icon={<Download size={14} />} loading={exp.isPending && exp.variables?.format === native} onClick={() => exp.mutate({ id, version, format: native })}>
        {c.export(native.toUpperCase())}
      </Button>
      {others.length ? (
        <Popover
          kind="menu"
          align="end"
          label={c.otherFormats}
          trigger={(p) => (
            <Button size="sm" loading={exp.isPending && exp.variables?.format !== native} {...p}>
              {c.otherFormats}
              <ChevronDown size={13} aria-hidden />
            </Button>
          )}
        >
          {(close) =>
            others.map((f) => (
              <MenuItem key={f} icon={<Download size={15} />} onSelect={() => { close(); exp.mutate({ id, version, format: f }); }}>
                {c.formats[f] ?? f.toUpperCase()}
              </MenuItem>
            ))
          }
        </Popover>
      ) : null}
    </div>
  );
}

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
  const editing = mode === "edit" && viewVersion === detail.currentVersion;
  const bound = detail.current.reviewState === "approved" || detail.current.reviewState === "in_review";

  return (
    <div>
      <div className={s.toolbar}>
        <label className={s.versionPick}>
          <span className="sr-only">{c.version}</span>
          <select
            value={viewVersion}
            onChange={(e) => {
              setViewVersion(Number(e.target.value));
              setMode("preview");
            }}
          >
            {[...detail.versions].reverse().map((v) => (
              <option key={v.version} value={v.version}>
                {c.versionOption(v.version, v.version === detail.currentVersion, v.reviewState === "approved")}
              </option>
            ))}
          </select>
        </label>
        {compact && shown ? <ReviewStateBadge state={shown.reviewState} /> : null}
        {canEdit && viewVersion === detail.currentVersion ? (
          <Segmented<"preview" | "edit"> label={c.mode} value={mode} onChange={setMode} options={[{ value: "preview", label: c.preview }, { value: "edit", label: c.edit }]} />
        ) : null}
        <div className={s.toolbarEnd}>
          {compact ? (
            <Link href={`/app/artifact/?id=${detail.id}`} className={s.fullView}>
              <Maximize2 size={14} aria-hidden /> {c.fullView}
            </Link>
          ) : null}
          {!editing && shown ? <ExportActions id={detail.id} version={shown.version} content={shown.content} /> : null}
        </div>
      </div>
      <div className={s.panelBody}>
        {editing ? (
          <div className={s.editWrap}>
            {bound ? <Callout tone="warn">{c.versionRule(detail.currentVersion + 1, detail.currentVersion, detail.current.reviewState === "approved")}</Callout> : null}
            <ArtifactEditor value={draft} onChange={setDraft} sources={detail.current.sources} />
            <TextField label={c.changeNote} placeholder={c.changeNotePlaceholder} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <div className={s.saveBar}>
              <Button
                variant="primary"
                icon={<Save size={14} />}
                disabled={!dirty}
                loading={save.isPending}
                onClick={() =>
                  save.mutate(
                    { baseVersion: detail.currentVersion, content: draft, sources: detail.current.sources, changeNote: note.trim() || c.defaultNote },
                    {
                      onSuccess: () => {
                        setMode("preview");
                        setNote("");
                      },
                    },
                  )
                }
              >
                {c.save(detail.currentVersion + 1)}
              </Button>
              {dirty ? (
                <Button variant="ghost" onClick={() => setDraft(detail.current.content)}>
                  {c.discard}
                </Button>
              ) : null}
              <span className={s.saveState} aria-live="polite">
                {dirty ? c.unsaved : c.noChanges}
              </span>
            </div>
          </div>
        ) : !shown ? (
          versionQ.isError ? <ErrorState error={versionQ.error} compact /> : <LoadingBlock rows={3} />
        ) : (
          <div className={s.editWrap}>
            {!canEdit ? <p className={s.byline}>{c.readOnly(deliverablesCopy.roles[detail.myRole] ?? detail.myRole)}</p> : null}
            <ArtifactPreview content={shown.content} sources={shown.sources} />
            <p className={s.byline}>
              <PenLine size={12} aria-hidden /> {c.byline(shown.version, shown.authorName, shown.changeNote.replace(/\s*\[idem:[^\]]+\]/, ""))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function CanvasPanel({ artifactId }: { artifactId: string }) {
  const q = useQuery({ queryKey: ["artifact", artifactId], queryFn: () => api.artifacts.get(artifactId) });
  if (q.isPending) return <div className={s.panelPad}><LoadingBlock rows={4} /></div>;
  if (q.isError) return <div className={s.panelPad}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div>;
  return (
    <div>
      <div className={s.canvasTitle}>{q.data.title}</div>
      <ArtifactWorkspace detail={q.data} compact />
    </div>
  );
}
