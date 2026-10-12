"use client";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileQuestion } from "lucide-react";
import type { ArtifactDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { Page } from "@/components/shell/StudioShell";
import { ArtifactIcon, Badge, Card, EmptyState, LinkButton, PageHeader, QueryState } from "@/components/ui";
import { ArtifactWorkspace } from "@/features/artifacts/ArtifactWorkspace";
import { keys, useProjects } from "./queries";
import { SharingPanel } from "./SharingPanel";
import { ReviewPanel } from "./ReviewPanel";
import { CommentsPanel } from "./CommentsPanel";
import { VersionHistory } from "./VersionHistory";
import s from "./deliverables.module.css";

export function ArtifactView() {
  const id = useSearchParams().get("id");
  const q = useQuery({ queryKey: keys.artifact(id ?? ""), queryFn: () => api.artifacts.get(id!), enabled: Boolean(id) });

  if (!id) {
    return (
      <Page>
        <EmptyState icon={<FileQuestion size={22} />} title={c.detail.missingId} body={c.detail.missingIdBody} action={<LinkButton href="/app/artifacts/" variant="primary">{c.detail.back}</LinkButton>} />
      </Page>
    );
  }
  return (
    <Page wide>
      <QueryState query={q}>{(d) => <ArtifactLayout detail={d} />}</QueryState>
    </Page>
  );
}

function ArtifactLayout({ detail }: { detail: ArtifactDetail }) {
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === detail.projectId);
  return (
    <>
      <div className={s.backRow}>
        <LinkButton href="/app/artifacts/" variant="ghost" size="sm" icon={<ArrowLeft size={14} aria-hidden />}>
          {c.detail.back}
        </LinkButton>
      </div>
      <PageHeader
        eyebrow={c.detail.eyebrow}
        title={detail.title}
        meta={
          <>
            <Badge icon={<ArtifactIcon type={detail.type} size={12} />}>{c.types[detail.type] ?? detail.type}</Badge>
            {project ? <Badge>{project.name}</Badge> : null}
            <Badge mono>v{detail.currentVersion}</Badge>
            <Badge tone="violet">{c.detail.myRole(c.roles[detail.myRole] ?? detail.myRole)}</Badge>
            <Badge>{c.detail.sources(detail.sourceCount)}</Badge>
          </>
        }
      />
      <div className={s.detailGrid}>
        <Card flush className={s.canvasCard}>
          <ArtifactWorkspace detail={detail} />
        </Card>
        <div className={s.sideCol}>
          <ReviewPanel detail={detail} />
          <SharingPanel detail={detail} />
          <CommentsPanel detail={detail} />
          <VersionHistory detail={detail} />
        </div>
      </div>
    </>
  );
}
