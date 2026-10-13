"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileQuestion } from "lucide-react";
import type { ArtifactDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { Page } from "@/components/shell/StudioShell";
import { ArtifactIcon, Badge, Card, EmptyState, LinkButton, PageHeader, QueryState, TabPanel, Tabs } from "@/components/ui";
import { ArtifactWorkspace, ReviewStateBadge } from "@/features/artifacts/ArtifactWorkspace";
import { keys, useProjects } from "./queries";
import { ShareButton } from "./SharingPanel";
import { RequestReview, ReviewDecisionCard, ReviewHistory } from "./ReviewPanel";
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

type SideTab = "comments" | "history";

function ArtifactLayout({ detail }: { detail: ArtifactDetail }) {
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === detail.projectId);
  const comments = useQuery({ queryKey: keys.comments(detail.id), queryFn: () => api.artifacts.comments(detail.id) });
  const [tab, setTab] = useState<SideTab>("comments");
  const limited = c.detail.limitedRole[detail.myRole];
  return (
    <>
      <PageHeader
        back={{ href: "/app/artifacts/", label: c.detail.back }}
        title={detail.title}
        description={[project?.name, c.detail.sources(detail.sourceCount)].filter(Boolean).join(" · ")}
        meta={
          <>
            <Badge icon={<ArtifactIcon type={detail.type} size={12} />}>{c.types[detail.type] ?? detail.type}</Badge>
            <ReviewStateBadge state={detail.reviewState} />
            {limited ? <Badge>{limited}</Badge> : null}
          </>
        }
        actions={
          <>
            <RequestReview detail={detail} />
            <ShareButton detail={detail} />
          </>
        }
      />
      <div className={s.detailGrid}>
        <Card flush className={s.canvasCard}>
          <ArtifactWorkspace detail={detail} />
        </Card>
        <div className={s.sideCol}>
          <ReviewDecisionCard detail={detail} />
          <Card className={s.sideCard}>
            <Tabs<SideTab>
              idPrefix="deliverable"
              label={c.detail.tabs}
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "comments", label: c.detail.comments, count: comments.data?.length || undefined },
                { id: "history", label: c.detail.history, count: detail.versions.length },
              ]}
            />
            <TabPanel idPrefix="deliverable" id={tab}>
              {tab === "comments" ? (
                <CommentsPanel detail={detail} />
              ) : (
                <div className={s.tabBody}>
                  <VersionHistory detail={detail} />
                  <ReviewHistory detail={detail} />
                </div>
              )}
            </TabPanel>
          </Card>
        </div>
      </div>
    </>
  );
}
