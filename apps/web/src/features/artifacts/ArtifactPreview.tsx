"use client";
import type { ArtifactContent, ReportBlock, Slide, SourceRef } from "@atlas/contracts";
import { SLIDE_LAYOUT } from "@atlas/renderers";
import { deliverablesCopy } from "@/copy/deliverables";
import { CitationChip } from "@/components/ui";
import s from "./artifact.module.css";

/**
 * Safe preview: renders structured fields as text nodes only (no HTML/JS from
 * content). The slide geometry mirrors the PPTX renderer so preview = export.
 */
function Block({ b }: { b: ReportBlock }) {
  switch (b.type) {
    case "heading": {
      const H = (`h${Math.min(4, b.level + 1)}`) as "h2" | "h3" | "h4";
      return <H className={s[`h${b.level}`]}>{b.text}</H>;
    }
    case "paragraph":
      return (
        <p className={s.p}>
          {b.text}
          {b.sourceRefs.map((r) => (
            <sup key={r} className={s.ref}>
              [{r}]
            </sup>
          ))}
        </p>
      );
    case "bullets":
      return (
        <ul className={s.ul}>
          {b.items.map((i, k) => (
            <li key={k}>{i}</li>
          ))}
        </ul>
      );
    case "callout":
      return <div className={`${s.callout} ${s[`callout_${b.tone}`]}`}><strong>{b.tone === "gap" ? "Gap" : b.tone === "warning" ? "Warning" : "Note"}:</strong> {b.text}</div>;
    case "table_ref":
      return (
        <figure className={s.figure}>
          <figcaption className={s.caption}>{b.caption}</figcaption>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>{b.columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );
    case "code":
      return (
        <pre className={s.code}>
          <code>{b.text}</code>
        </pre>
      );
  }
}

const pct = (inches: number, total: number) => `${(inches / total) * 100}%`;

export function SlidePreview({ slide, index, total, theme, sources }: { slide: Slide; index: number; total: number; theme: "atlas_light" | "atlas_ink"; sources: SourceRef[] }) {
  const L = SLIDE_LAYOUT;
  const box = (x: number, y: number, w: number, h: number) => ({ left: pct(x, L.width), top: pct(y, L.height), width: pct(w, L.width), height: pct(h, L.height) });
  const bodyW = L.width - L.margin * 2;
  const refs = slide.sourceRefs.map((r) => sources.find((x) => x.ref === r)).filter(Boolean) as SourceRef[];
  return (
    <div className={`${s.slide} ${theme === "atlas_ink" ? s.slideInk : ""}`} role="img" aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}>
      <div className={s.slideBar} />
      {slide.layout === "title" ? (
        <>
          <div className={s.slideTitleBig} style={box(L.margin, 2.3, bodyW, 1.4)}>{slide.title}</div>
          <div className={s.slideAccent} style={{ left: pct(L.margin, L.width), top: pct(3.75, L.height), width: pct(2.2, L.width) }} />
          {slide.subtitle ? <div className={s.slideSub} style={box(L.margin, 3.8, bodyW, 0.8)}>{slide.subtitle}</div> : null}
        </>
      ) : (
        <>
          <div className={s.slideTitle} style={box(L.margin, L.titleY, bodyW, 0.9)}>{slide.title}</div>
          {slide.layout === "two_column" ? (
            <>
              <ul className={s.slideBullets} style={box(L.margin, L.bodyY, bodyW / 2 - 0.2, 4.8)}>{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
              <ul className={s.slideBullets} style={box(L.margin + bodyW / 2 + 0.2, L.bodyY, bodyW / 2 - 0.2, 4.8)}>{slide.right.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </>
          ) : slide.layout === "metric" && slide.metric ? (
            <>
              <div className={s.slideMetric} style={box(L.margin, L.bodyY, 4.6, 1.6)}>{slide.metric.value}</div>
              <div className={s.slideSub} style={box(L.margin, L.bodyY + 1.6, 4.6, 0.8)}>{slide.metric.label}</div>
              <ul className={s.slideBullets} style={box(L.margin + 5, L.bodyY, bodyW - 5, 4.8)}>{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </>
          ) : (
            <ul className={s.slideBullets} style={box(L.margin, L.bodyY, bodyW, 4.8)}>{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
          )}
        </>
      )}
      {refs.length ? (
        <div className={s.slideSources} style={box(L.margin, 6.55, bodyW, 0.35)}>
          Sources: {refs.map((r) => `[${r.ref}] ${r.documentTitle} v${r.version}${r.page ? ` p.${r.page}` : ""}`).join("  ·  ")}
        </div>
      ) : null}
      <div className={s.slideNum} style={box(L.margin, 6.95, bodyW, 0.3)}>
        {index + 1} / {total} · DEMO data (fictional)
      </div>
    </div>
  );
}

export function ArtifactPreview({ content, sources }: { content: ArtifactContent; sources: SourceRef[] }) {
  return (
    <div className={s.preview}>
      {content.type === "report" ? (
        <article className={s.doc}>{content.blocks.map((b, i) => <Block key={i} b={b} />)}</article>
      ) : content.type === "table" ? (
        <article className={s.doc}>
          <h2 className={s.h1}>{content.title}</h2>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>{content.columns.map((c) => <th key={c.key} className={c.kind === "number" ? s.num : undefined}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {content.rows.map((r, i) => (
                  <tr key={i}>{content.columns.map((c) => <td key={c.key} className={c.kind === "number" ? s.num : undefined}>{String(r[c.key] ?? "")}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {content.note ? <p className={s.note}>{content.note}</p> : null}
        </article>
      ) : (
        <div className={s.deck}>
          {content.slides.map((sl, i) => (
            <figure key={sl.id} className={s.slideFigure}>
              <SlidePreview slide={sl} index={i} total={content.slides.length} theme={content.theme} sources={sources} />
              {sl.notes ? <figcaption className={s.notes}>{deliverablesCopy.preview.notes}: {sl.notes}</figcaption> : null}
            </figure>
          ))}
        </div>
      )}
      {sources.length ? (
        <section className={s.sources} aria-label="Sources">
          <h3 className={s.sourcesHead}>{deliverablesCopy.preview.sources}</h3>
          <ul>
            {sources.map((src) => (
              <li key={src.ref}>
                <CitationChip index={Number(src.ref.slice(1))} citation={src} />
                <q className={s.quote}>{src.quote}</q>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
