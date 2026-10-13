"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileQuestion, MessageSquareText, ShieldAlert } from "lucide-react";
import type { DocumentDetail, DocumentVersion, Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { setDraft } from "@/lib/state/drafts";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { Badge, Button, Callout, Card, DescList, EmptyState, ErrorState, LinkButton, LoadingBlock, PageHeader, SectionHead, Skeleton, TabPanel, Tabs, TechDetails, type TabDef } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import { CsvProfilePanel } from "./CsvProfilePanel";
import { DocumentActions } from "./DocumentActions";
import { CsvPreview, ImagePanel, PagesPanel } from "./ReadingPanels";
import { VersionsTable } from "./VersionsTable";
import { ClassificationBadge, DocStatus } from "./docBadges";
import s from "./library.module.css";

type Tab = "content" | "versions" | "profile";
const BACK = { href: "/app/library/", label: L.detail.back };

/** `v` is a version number (as citations link it) or a version id. */
function resolveVersion(doc: DocumentDetail, v: string | null): DocumentVersion | undefined {
  const byParam = v ? doc.versions.find((x) => x.id === v || String(x.version) === v) : undefined;
  return byParam ?? doc.versions.find((x) => x.published) ?? doc.versions[doc.versions.length - 1];
}

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function DocumentView() {
  const params = useSearchParams();
  const id = params.get("id");
  const v = params.get("v");
  if (!id) {
    return (
      <Page>
        <EmptyState icon={<FileQuestion size={22} />} title={L.detail.missingId} body={L.detail.missingIdBody} action={<LinkButton href={BACK.href}>{BACK.label}</LinkButton>} />
      </Page>
    );
  }
  return <DocumentDetailView id={id} v={v} />;
}

/** Primary action: open a new conversation in a project that contains this document, with the question started. */
function AskButton({ doc, projects }: { doc: DocumentDetail; projects: Project[] | undefined }) {
  const router = useRouter();
  const projectId = doc.projectIds[0];
  if (!projectId) return null;
  const agent = projects?.find((p) => p.id === projectId)?.defaultAgentId;
  const prompt = L.detail.askPrompt(doc.title);
  const ask = () => {
    // The composer reads its draft from the new-conversation scope of that project; `attach` and `q` describe the intent for the chat.
    setDraft(`new:${projectId}`, prompt);
    router.push(`/app/chat/?new=1&project=${projectId}${agent ? `&agent=${agent}` : ""}&attach=${doc.id}&q=${encodeURIComponent(prompt)}`);
  };
  return (
    <Button variant="primary" icon={<MessageSquareText size={14} aria-hidden />} onClick={ask}>
      {L.detail.ask}
    </Button>
  );
}

function AboutPanel({ doc, version, projects }: { doc: DocumentDetail; version: DocumentVersion | undefined; projects: Project[] | undefined }) {
  const D = L.detail;
  const projectLinks = doc.projectIds.length ? (
    <span className={s.inlineList}>
      {doc.projectIds.map((pid) => (
        <Link key={pid} href={`/app/project/?id=${pid}`} className={s.inlineLink}>
          {projects?.find((p) => p.id === pid)?.name ?? pid}
        </Link>
      ))}
    </span>
  ) : (
    D.noProject
  );
  const items: Array<[string, ReactNode]> = [
    [D.kind, L.kind[doc.kind]],
    [D.classification, L.classification[doc.classification]],
    [D.version, doc.publishedVersion ? D.versionBadge(doc.publishedVersion) : D.notPublished],
    [D.projects, projectLinks],
    ...(doc.tags.length ? [[D.tags, doc.tags.join(", ")] as [string, string]] : []),
    [D.updated, formatDateTime(doc.updatedAt)],
    ...(version?.pageCount ? [[D.pages, String(version.pageCount)] as [string, string]] : []),
    ...(version ? [[D.size, fileSize(version.byteSize)] as [string, string]] : []),
  ];
  return (
    <aside aria-labelledby="doc-about-h" className={s.aside}>
      <Card>
        <SectionHead id="doc-about-h" title={D.about} />
        <DescList items={items} />
        {doc.sensitiveFindingCount > 0 ? (
          <div className={s.calloutGap}>
            <Callout tone="warn" icon={<ShieldAlert size={16} aria-hidden />}>
              {D.findings(doc.sensitiveFindingCount)} · <Link href="/app/privacy/">{D.reviewInPrivacy}</Link>
            </Callout>
          </div>
        ) : null}
        <div className={s.techGap}>
          <TechDetails>
            <dl className={s.techList}>
              <div className={s.techRow}>
                <dt>Document ID</dt>
                <dd className="mono">{doc.id}</dd>
              </div>
              {version ? (
                <>
                  <div className={s.techRow}>
                    <dt>Version ID</dt>
                    <dd className="mono">{version.id}</dd>
                  </div>
                  <div className={s.techRow}>
                    <dt>SHA-256</dt>
                    <dd className="mono">{version.sha256}</dd>
                  </div>
                  <div className={s.techRow}>
                    <dt>Indexed chunks</dt>
                    <dd className="mono">{version.chunkCount}</dd>
                  </div>
                </>
              ) : null}
              <div className={s.techRow}>
                <dt>MIME type</dt>
                <dd className="mono">{doc.mimeType}</dd>
              </div>
            </dl>
          </TechDetails>
        </div>
      </Card>
    </aside>
  );
}

function DocumentDetailView({ id, v }: { id: string; v: string | null }) {
  const router = useRouter();
  const canAdmin = useCan("document.admin");
  const canChat = useCan("conversation.use");
  const canProjects = useCan("project.read");
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const base = useQuery({ queryKey: ["document", id, null], queryFn: () => api.documents.get(id) });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: canProjects });
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
        <div className={s.loadingGap}>
          <LoadingBlock rows={4} />
        </div>
      </Page>
    );
  if (base.isError)
    return (
      <Page wide>
        <PageHeader back={BACK} title={L.detail.unavailable} />
        <ErrorState error={base.error} onRetry={() => void base.refetch()} />
      </Page>
    );

  const doc = base.data;
  const isCsv = doc.kind === "csv";
  const isImage = doc.kind === "image";
  // A CSV opens on its profile: the summary is more useful than the raw rows.
  const tab: Tab = chosenTab ?? (isCsv && doc.csvProfileAvailable ? "profile" : "content");
  const tabs: Array<TabDef<Tab>> = [
    ...(isCsv ? [{ id: "profile" as const, label: L.detail.tabs.profile }] : []),
    { id: "content", label: isImage ? L.detail.tabs.image : L.detail.tabs.content },
    { id: "versions", label: L.detail.tabs.versions, count: doc.versions.length },
  ];
  const pagesQuery = needsVersionFetch ? versioned : base;

  return (
    <Page wide>
      <PageHeader
        back={BACK}
        title={doc.title}
        meta={
          <>
            <Badge>{L.kind[doc.kind]}</Badge>
            <ClassificationBadge value={doc.classification} />
            {doc.latestStatus !== "ready" ? <DocStatus status={doc.latestStatus} /> : doc.publishedVersion ? <Badge>{L.detail.versionBadge(doc.publishedVersion)}</Badge> : null}
          </>
        }
        actions={
          <>
            {canChat ? <AskButton doc={doc} projects={projects.data} /> : null}
            {canAdmin ? <DocumentActions doc={doc} onReindexed={setVersion} /> : null}
          </>
        }
      />

      <div className={s.docLayout}>
        <div className={s.docMain}>
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
                ) : isCsv ? (
                  <CsvPreview pages={pagesQuery.data?.pages ?? []} version={selected} />
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
        </div>
        <AboutPanel doc={doc} version={selected} projects={projects.data} />
      </div>
    </Page>
  );
}
