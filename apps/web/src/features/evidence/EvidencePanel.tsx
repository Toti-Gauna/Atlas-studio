"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ExternalLink } from "lucide-react";
import type { Citation } from "@atlas/contracts";
import { api } from "@/lib/api";
import { gsap, useReducedMotion } from "@/lib/motion";
import { Badge, CitationChip, ErrorState, Skeleton } from "@/components/ui";
import s from "./evidence.module.css";

/** Highlights the exact quote inside the page text of the cited version. */
export function HighlightedText({ text, quote }: { text: string; quote: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const i = quote ? text.indexOf(quote) : -1;
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    if (!reduced) gsap.fromTo(ref.current, { backgroundColor: "rgba(25,182,164,0.45)" }, { backgroundColor: "rgba(25,182,164,0.18)", duration: 0.6, ease: "power1.out" });
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
          <div className={s.docMeta}>
            version {citation.version}
            {citation.page ? ` · page ${citation.page}` : ""} · chunk {citation.chunkId.split("_").slice(-1)[0]}
          </div>
        </div>
        <Link href={`/app/document/?id=${citation.documentId}&v=${citation.version}`} className={s.openLink}>
          Open <ExternalLink size={13} aria-hidden />
        </Link>
      </div>
      {published !== null && published !== citation.version ? (
        <Badge tone="warn">Cited v{citation.version}; current published is v{published}. Showing the cited version.</Badge>
      ) : null}
      {page ? <HighlightedText text={page.text} quote={citation.quote} /> : <p className={s.pageText}>This version is no longer available. The citation snapshot is kept: “{citation.quote}”</p>}
    </div>
  );
}

export function EvidencePanel({ state }: { state: { citations: Citation[]; activeIndex: number } }) {
  const [active, setActive] = useState(state.activeIndex);
  useEffect(() => setActive(state.activeIndex), [state.activeIndex, state.citations]);
  const cit = state.citations[active];
  return (
    <div className={s.wrap}>
      <ol className={s.chain} aria-label="Evidence chain">
        <li>
          <span className="eyebrow">1 · Retrieval</span>
          <span>Authorized, published passages only</span>
        </li>
        <li aria-hidden className={s.arrow}>
          <ArrowDown size={14} />
        </li>
        <li>
          <span className="eyebrow">2 · Answer</span>
          <span>Quoted sentences, no paraphrase (local)</span>
        </li>
        <li aria-hidden className={s.arrow}>
          <ArrowDown size={14} />
        </li>
        <li>
          <span className="eyebrow">3 · Citation</span>
          <span>Exact document version and page</span>
        </li>
      </ol>
      <div className={s.chips} role="list">
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
