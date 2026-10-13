"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { Citation } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useReducedMotion } from "@/lib/motion";
import { chatCopy } from "@/copy/chat";
import { Callout, CitationChip, ErrorState, Skeleton, TechDetails } from "@/components/ui";
import s from "./evidence.module.css";

/** Highlights the exact quote inside the page text of the cited version. */
export function HighlightedText({ text, quote }: { text: string; quote: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const i = quote ? text.indexOf(quote) : -1;
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [quote, reduced]);
  if (i < 0) return <p className={s.pageText}>{text}</p>;
  return (
    <p className={s.pageText}>
      {text.slice(0, i)}
      <mark ref={ref} className={s.mark}>
        {quote}
      </mark>
      {text.slice(i + quote.length)}
    </p>
  );
}

const ec = chatCopy.evidence;

function CitedPage({ citation }: { citation: Citation }) {
  const doc = useQuery({ queryKey: ["document", citation.documentId, citation.versionId], queryFn: () => api.documents.get(citation.documentId, citation.versionId) });
  if (doc.isPending) return <Skeleton lines={6} />;
  if (doc.isError) return <ErrorState error={doc.error} compact onRetry={() => void doc.refetch()} />;
  const page = doc.data.pages.find((p) => p.page === citation.page) ?? doc.data.pages.find((p) => p.text.includes(citation.quote));
  const published = doc.data.publishedVersion;
  return (
    <div>
      <div className={s.docHead}>
        <div>
          <div className={s.docTitle}>{citation.documentTitle}</div>
          <div className={s.docMeta}>{ec.version(citation.version, citation.page)}</div>
        </div>
        <Link href={`/app/document/?id=${citation.documentId}&v=${citation.version}`} className={s.openLink}>
          {ec.open} <ExternalLink size={13} aria-hidden />
        </Link>
      </div>
      {published !== null && published !== citation.version ? <Callout tone="warn">{ec.newer(citation.version, published)}</Callout> : null}
      {page ? <HighlightedText text={page.text} quote={citation.quote} /> : <p className={s.pageText}>{ec.gone(citation.quote)}</p>}
      <div className={s.tech}>
        <TechDetails>
          <dl className={s.techList}>
            <dt>Passage</dt>
            <dd className="mono">{citation.chunkId}</dd>
            <dt>Match score</dt>
            <dd>{citation.score}</dd>
            <dt>Document version</dt>
            <dd className="mono">{citation.versionId}</dd>
          </dl>
        </TechDetails>
      </div>
    </div>
  );
}

export function EvidencePanel({ state }: { state: { citations: Citation[]; activeIndex: number } }) {
  const [active, setActive] = useState(state.activeIndex);
  const [from, setFrom] = useState(state);
  if (from !== state) {
    setFrom(state);
    setActive(state.activeIndex);
  }
  const cit = state.citations[active];
  return (
    <div className={s.wrap}>
      <div className={s.chips} role="list" aria-label={ec.sourcesLabel}>
        {state.citations.map((c, i) => (
          <div role="listitem" key={c.id} className={i === active ? s.chipActive : undefined}>
            <CitationChip index={i + 1} citation={c} onOpen={() => setActive(i)} />
          </div>
        ))}
      </div>
      {cit ? <CitedPage key={cit.id} citation={cit} /> : null}
    </div>
  );
}
