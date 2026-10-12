"use client";
import { useState } from "react";
import { Eye, ImageOff } from "lucide-react";
import type { DocumentDetail, DocumentVersion } from "@atlas/contracts";
import { asset } from "@/lib/config";
import { Callout, EmptyState, SectionHead } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import s from "./library.module.css";

/** Extracted page text on a pearl reading surface (stays light in dark mode, like the evidence panel). */
export function PagesPanel({ pages, version }: { pages: DocumentDetail["pages"]; version: DocumentVersion | undefined }) {
  return (
    <section aria-labelledby="pages-h">
      <SectionHead id="pages-h" title={L.detail.pagesHeading(version?.version ?? 0)} aside={version ? `${version.chunkCount} chunks` : undefined} />
      {version?.failureReason ? (
        <div style={{ marginBottom: 12 }}>
          <Callout tone="warn">
            <strong>{L.detail.failedReason}:</strong> {version.failureReason}
          </Callout>
        </div>
      ) : null}
      {pages.length === 0 ? (
        <EmptyState title={L.detail.noPages} body={L.detail.noPagesBody} />
      ) : (
        <ol className={s.pages}>
          {pages.map((p) => (
            <li key={p.page}>
              <h3 className={s.pageLabel}>{L.detail.page(p.page)}</h3>
              <div className={s.pageText}>{p.text}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The document detail carries no image URL; only the seeded demo image has a known public asset. */
export function ImagePanel({ doc }: { doc: DocumentDetail }) {
  const src = doc.id === "doc_dock_photo" ? asset("/demo/dock-utilization-whiteboard.png") : null;
  const [broken, setBroken] = useState(false);
  return (
    <section className={s.stack} aria-label={doc.title}>
      {doc.visionStatus !== "available" ? (
        <Callout tone="warn" icon={<Eye size={16} aria-hidden />}>
          {L.image.vision}
        </Callout>
      ) : null}
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export serves the demo asset as-is
        <img src={src} alt={L.image.alt(doc.title)} className={s.image} onError={() => setBroken(true)} />
      ) : (
        <div className={s.imagePlaceholder} role="img" aria-label={L.image.placeholder}>
          <ImageOff size={28} aria-hidden />
          <span>{L.image.placeholder}</span>
        </div>
      )}
    </section>
  );
}
