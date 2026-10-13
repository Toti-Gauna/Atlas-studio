"use client";
import { useMemo, useState } from "react";
import { Eye, ImageOff } from "lucide-react";
import type { DocumentDetail, DocumentVersion } from "@atlas/contracts";
import { parseCsv } from "@atlas/domain";
import { asset } from "@/lib/config";
import { Callout, EmptyState, SectionHead, Table } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import s from "./library.module.css";

function FailureCallout({ version }: { version: DocumentVersion | undefined }) {
  if (!version?.failureReason) return null;
  return (
    <div className={s.calloutGap}>
      <Callout tone="warn">
        <strong>{L.detail.failedReason}.</strong> {version.failureReason}
      </Callout>
    </div>
  );
}

/** Extracted page text on a pearl reading surface (stays light in dark mode, like the evidence panel). */
export function PagesPanel({ pages, version }: { pages: DocumentDetail["pages"]; version: DocumentVersion | undefined }) {
  return (
    <section aria-labelledby="pages-h">
      <SectionHead id="pages-h" title={L.detail.pagesHeading(version?.version ?? 0)} />
      <FailureCallout version={version} />
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

/** CSV content as a table: the stored preview text parsed with the same parser the profile uses. */
export function CsvPreview({ pages, version }: { pages: DocumentDetail["pages"]; version: DocumentVersion | undefined }) {
  const parsed = useMemo(() => {
    const text = pages.map((p) => p.text).join("\n");
    return text.trim() ? parseCsv(text) : null;
  }, [pages]);
  return (
    <section aria-labelledby="csv-preview-h">
      <SectionHead id="csv-preview-h" title={L.csv.previewHeading} aside={parsed ? L.csv.previewNote(parsed.rows.length) : undefined} />
      <FailureCallout version={version} />
      {!parsed || parsed.headers.length === 0 ? (
        <EmptyState title={L.detail.noPages} body={L.detail.noPagesBody} />
      ) : (
        <Table caption={L.csv.previewCaption} className={s.csvTable}>
          <thead>
            <tr>
              {parsed.headers.map((h, i) => (
                <th key={`${h}-${i}`} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((r, ri) => (
              <tr key={ri}>
                {parsed.headers.map((_, ci) => (
                  <td key={ci} className={s.nowrap}>
                    {r[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
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
        <Callout tone="info" icon={<Eye size={16} aria-hidden />}>
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
