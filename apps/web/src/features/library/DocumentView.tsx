"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileQuestion } from "lucide-react";
import type { DocumentDetail, DocumentVersion } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { Badge, EmptyState, ErrorState, LoadingBlock, PageHeader, Skeleton, TabPanel, Tabs, type TabDef } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import { CsvProfilePanel } from "./CsvProfilePanel";
import { DocumentActions } from "./DocumentActions";
import { ImagePanel, PagesPanel } from "./ReadingPanels";
import { VersionsTable } from "./VersionsTable";
import { ClassificationBadge, StatusBadge } from "./docBadges";
import s from "./library.module.css";

type Tab = "content" | "versions" | "profile";

/** `v` is a version number (as citations link it) or a version id. */
function resolveVersion(doc: DocumentDetail, v: string | null): DocumentVersion | undefined {
  const byParam = v ? doc.versions.find((x) => x.id === v || String(x.version) === v) : undefined;
  return byParam ?? doc.versions.find((x) => x.published) ?? doc.versions[doc.versions.length - 1];
}

export function DocumentView() {
  const params = useSearchParams();
  const id = params.get("id");
  const v = params.get("v");
  if (!id) {
    return (
      <Page>
        <EmptyState icon={<FileQuestion size={22} />} title={L.detail.missingId} body={L.detail.missingIdBody} action={<Link href="/app/library/">{L.detail.back}</Link>} />
      </Page>
    );
  }
  return <DocumentDetailView id={id} v={v} />;
}

function DocumentDetailView({ id, v }: { id: string; v: string | null }) {
  const router = useRouter();
  const canAdmin = useCan("document.admin");
  const [tab, setTab] = useState<Tab>("content");
  const base = useQuery({ queryKey: ["document", id, null], queryFn: () => api.documents.get(id) });
  const selected = base.data ? resolveVersion(base.data, v) : undefined;
  const publishedId = base.data?.versions.find((x) => x.published)?.id;
  const needsVersionFetch = Boolean(selected && selected.id !== publishedId);
  const versioned = useQuery({
    queryKey: ["document", id, selected?.id ?? null],
    queryFn: () => api.documents.get(id, selected!.id),
    enabled: needsVersionFetch,
  });
  const setVersion = (n: number) => router.replace(`/app/document/?id=${id}&v=${n}`, { scroll: false });

  if (base.isPending)
    return (
      <Page wide>
        <Skeleton lines={2} height={22} />
        <div style={{ marginTop: 24 }}>
          <LoadingBlock rows={4} />
        </div>
      </Page>
    );
  if (base.isError)
    return (
      <Page wide>
        <BackLink />
        <ErrorState error={base.error} onRetry={() => void base.refetch()} />
      </Page>
    );

  const doc = base.data;
  const isCsv = doc.kind === "csv";
  const isImage = doc.kind === "image";
  const tabs: Array<TabDef<Tab>> = [
    { id: "content", label: isImage ? L.detail.tabs.image : L.detail.tabs.content },
    { id: "versions", label: L.detail.tabs.versions, count: doc.versions.length },
    ...(isCsv ? [{ id: "profile" as const, label: L.detail.tabs.profile }] : []),
  ];
  const pagesQuery = needsVersionFetch ? versioned : base;

  return (
    <Page wide>
      <BackLink />
      <PageHeader
        eyebrow={L.detail.eyebrow}
        title={doc.title}
        meta={
          <>
            <Badge>{L.kind[doc.kind]}</Badge>
            <ClassificationBadge value={doc.classification} />
            <StatusBadge status={doc.latestStatus} />
            {doc.publishedVersion ? <Badge tone="teal">v{doc.publishedVersion} {L.detail.published.toLowerCase()}</Badge> : <Badge>{L.list.notPublished}</Badge>}
            {doc.tags.map((t) => (
              <Badge key={t} mono>
                #{t}
              </Badge>
            ))}
            <span className={s.subtle} style={{ alignSelf: "center" }}>
              {L.detail.updated} {formatDateTime(doc.updatedAt)}
            </span>
          </>
        }
        actions={canAdmin ? <DocumentActions doc={doc} onReindexed={setVersion} /> : null}
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} label={L.detail.tabsLabel} idPrefix="doc" />
      <div className={s.tabBody}>
        {tab === "content" ? (
          <TabPanel idPrefix="doc" id="content">
            {isImage ? (
              <ImagePanel doc={doc} />
            ) : pagesQuery.isPending ? (
              <LoadingBlock rows={3} />
            ) : pagesQuery.isError ? (
              <ErrorState error={pagesQuery.error} compact onRetry={() => void pagesQuery.refetch()} />
            ) : (
              <PagesPanel pages={pagesQuery.data?.pages ?? []} version={selected} />
            )}
          </TabPanel>
        ) : null}
        {tab === "versions" ? (
          <TabPanel idPrefix="doc" id="versions">
            <VersionsTable
              versions={doc.versions}
              selectedId={selected?.id ?? null}
              onView={(ver) => {
                setVersion(ver.version);
                setTab("content");
              }}
            />
          </TabPanel>
        ) : null}
        {tab === "profile" && isCsv ? (
          <TabPanel idPrefix="doc" id="profile">
            {doc.csvProfileAvailable ? <CsvProfilePanel documentId={doc.id} /> : <EmptyState title={L.csv.unavailable} body={L.csv.unavailableBody} />}
          </TabPanel>
        ) : null}
      </div>
    </Page>
  );
}

function BackLink() {
  return (
    <Link href="/app/library/" className={s.back}>
      <ArrowLeft size={14} aria-hidden /> {L.detail.back}
    </Link>
  );
}
