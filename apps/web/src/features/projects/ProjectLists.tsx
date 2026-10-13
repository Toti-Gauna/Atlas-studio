"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileStack, FolderOpen, MessageSquare } from "lucide-react";
import type { ArtifactSummary, ConversationSummary, Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { plural, relativeTime } from "@/lib/format";
import { ArtifactIcon, Badge, EmptyState, LinkButton, QueryState, StatusBadge } from "@/components/ui";
import { projectsCopy as P } from "@/copy/projects";
import { DocumentsTable } from "@/features/library/DocumentsTable";
import s from "./projects.module.css";

export function ConversationRows({ list, label }: { list: ConversationSummary[]; label: string }) {
  return (
    <ul className={s.rows} aria-label={label}>
      {list.map((c) => (
        <li key={c.id}>
          <Link href={`/app/chat/?c=${c.id}`} className={s.row}>
            <MessageSquare size={16} aria-hidden className={s.rowIcon} />
            <span className={s.rowMain}>
              <span className={s.rowTitle}>{c.title}</span>
              <span className={s.rowMeta}>{c.lastMessagePreview}</span>
            </span>
            <span className={s.rowAside}>
              {c.hasOpenTicket ? <Badge tone="warn">{P.detail.openTicket}</Badge> : null}
              <span className="tabular">{plural(c.messageCount, "message")}</span>
              <span>{relativeTime(c.updatedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Review state is shown only when someone has to act (in review, changes requested); otherwise plain text. */
function ReviewState({ state }: { state: ArtifactSummary["reviewState"] }) {
  if (state === "in_review" || state === "changes_requested") return <StatusBadge kind="review" status={state} />;
  return <span>{P.detail.review[state]}</span>;
}

export function DeliverableRows({ list, label }: { list: ArtifactSummary[]; label: string }) {
  return (
    <ul className={s.rows} aria-label={label}>
      {list.map((a) => (
        <li key={a.id}>
          <Link href={`/app/artifact/?id=${a.id}`} className={s.row}>
            <span className={s.artifactIcon}>
              <ArtifactIcon type={a.type} />
            </span>
            <span className={s.rowMain}>
              <span className={s.rowTitle}>{a.title}</span>
              <span className={s.rowMeta}>
                v{a.currentVersion} · {a.ownerName} · {plural(a.sourceCount, "source")}
              </span>
            </span>
            <span className={s.rowAside}>
              <ReviewState state={a.reviewState} />
              <span>{relativeTime(a.updatedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ConversationsTab({ project }: { project: Project }) {
  const q = useQuery({ queryKey: ["conversations", project.id], queryFn: () => api.conversations.list(project.id) });
  return (
    <QueryState
      query={q}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon={<MessageSquare size={22} />} title={P.detail.noConversations} body={P.detail.noConversationsBody} />}
    >
      {(list) => <ConversationRows list={list} label={P.detail.conversationsCaption} />}
    </QueryState>
  );
}

export function SourcesTab({ project }: { project: Project }) {
  const q = useQuery({ queryKey: ["documents", project.id], queryFn: () => api.documents.list(project.id) });
  return (
    <QueryState
      query={q}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon={<FolderOpen size={22} />} title={P.detail.noSources} body={P.detail.noSourcesBody} action={<LinkButton href="/app/library/">{P.detail.openLibrary}</LinkButton>} />}
    >
      {(docs) => (
        <>
          <DocumentsTable docs={docs} projects={[project]} caption={P.detail.sourcesCaption(project.name)} />
          <p className={s.footNote}>
            <Link href="/app/library/">{P.detail.openLibrary}</Link> {P.detail.manageInLibrary}
          </p>
        </>
      )}
    </QueryState>
  );
}

export function DeliverablesTab({ project }: { project: Project }) {
  const q = useQuery({ queryKey: ["artifacts", project.id], queryFn: () => api.artifacts.list(project.id) });
  return (
    <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={<FileStack size={22} />} title={P.detail.noDeliverables} body={P.detail.noDeliverablesBody} />}>
      {(list) => <DeliverableRows list={list} label={P.detail.deliverablesCaption} />}
    </QueryState>
  );
}

