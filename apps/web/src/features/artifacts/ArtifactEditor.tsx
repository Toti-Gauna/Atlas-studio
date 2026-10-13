"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ArtifactContent, ReportBlock, Slide, SourceRef } from "@atlas/contracts";
import { deliverablesCopy } from "@/copy/deliverables";
import { Button, IconButton, Select, TextArea, TextField } from "@/components/ui";
import { SlidePreview } from "./ArtifactPreview";
import s from "./artifact.module.css";

const e = deliverablesCopy.editor;
const LAYOUTS = Object.entries(e.layouts).map(([value, label]) => ({ value, label }));

function DeckEditor({ value, onChange, sources }: { value: Extract<ArtifactContent, { type: "presentation" }>; onChange: (v: ArtifactContent) => void; sources: SourceRef[] }) {
  const [sel, setSel] = useState(0);
  const i = Math.min(sel, value.slides.length - 1);
  const sl = value.slides[i]!;
  const setSlide = (patch: Partial<Slide>) => onChange({ ...value, slides: value.slides.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const move = (d: -1 | 1) => {
    const next = [...value.slides];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange({ ...value, slides: next });
    setSel(i + d);
  };
  const add = () => {
    const slide: Slide = { id: `s${Date.now()}`, layout: "bullets", title: e.newSlide, subtitle: null, bullets: [e.newPoint], right: [], metric: null, notes: "", sourceRefs: [] };
    onChange({ ...value, slides: [...value.slides.slice(0, i + 1), slide, ...value.slides.slice(i + 1)] });
    setSel(i + 1);
  };
  return (
    <div className={s.editor}>
      <div className={s.editGrid3}>
        <TextField label={e.deckTitle} value={value.title} maxLength={200} onChange={(ev) => onChange({ ...value, title: ev.target.value })} />
        <TextField label={e.audience} value={value.audience} maxLength={200} onChange={(ev) => onChange({ ...value, audience: ev.target.value })} />
        <Select label={e.theme} value={value.theme} onChange={(ev) => onChange({ ...value, theme: ev.target.value as typeof value.theme })} options={[{ value: "atlas_light", label: e.themes.atlas_light }, { value: "atlas_ink", label: e.themes.atlas_ink }]} />
      </div>
      <div className={s.deckEditor}>
        <div className={s.slideRail}>
          <ol className={s.slideList} aria-label={e.slides}>
            {value.slides.map((x, k) => (
              <li key={x.id}>
                <button type="button" className={s.slideItem} aria-current={k === i ? "true" : undefined} onClick={() => setSel(k)}>
                  <span className={s.slideNo}>{k + 1}</span>
                  <span className={s.slideItemText}>
                    <span className={s.slideItemTitle}>{x.title || e.untitled}</span>
                    <span className={s.slideItemLayout}>{e.layouts[x.layout]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <Button size="sm" icon={<Plus size={14} />} disabled={value.slides.length >= 40} onClick={add}>
            {e.addSlide}
          </Button>
        </div>
        <div className={s.slideForm}>
          <SlidePreview slide={sl} index={i} total={value.slides.length} theme={value.theme} sources={sources} />
          <div className={s.editRow}>
            <h3 className={s.editHead}>{e.slideN(i + 1)}</h3>
            <span className={s.editRowEnd}>
              <IconButton size="sm" label={e.moveUp(i + 1)} disabled={i === 0} onClick={() => move(-1)}>
                <ArrowUp size={16} />
              </IconButton>
              <IconButton size="sm" label={e.moveDown(i + 1)} disabled={i === value.slides.length - 1} onClick={() => move(1)}>
                <ArrowDown size={16} />
              </IconButton>
              <IconButton
                size="sm"
                label={e.deleteSlide(i + 1)}
                disabled={value.slides.length === 1}
                onClick={() => {
                  onChange({ ...value, slides: value.slides.filter((_, k) => k !== i) });
                  setSel(Math.max(0, i - 1));
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </span>
          </div>
          <Select label={e.layout} value={sl.layout} onChange={(ev) => setSlide({ layout: ev.target.value as Slide["layout"], metric: ev.target.value === "metric" ? (sl.metric ?? { value: "0", label: e.metricLabel }) : sl.metric })} options={LAYOUTS} />
          <TextField label={e.title} value={sl.title} maxLength={120} onChange={(ev) => setSlide({ title: ev.target.value })} />
          {sl.layout === "title" ? <TextField label={e.subtitle} value={sl.subtitle ?? ""} maxLength={200} onChange={(ev) => setSlide({ subtitle: ev.target.value || null })} /> : null}
          {sl.layout === "metric" && sl.metric ? (
            <div className={s.editGrid2}>
              <TextField label={e.metricValue} value={sl.metric.value} maxLength={24} onChange={(ev) => setSlide({ metric: { ...sl.metric!, value: ev.target.value } })} />
              <TextField label={e.metricLabel} value={sl.metric.label} maxLength={80} onChange={(ev) => setSlide({ metric: { ...sl.metric!, label: ev.target.value } })} />
            </div>
          ) : null}
          {sl.layout !== "title" ? <TextArea label={sl.layout === "two_column" ? e.leftColumn : e.bullets} value={sl.bullets.join("\n")} rows={3} onChange={(ev) => setSlide({ bullets: ev.target.value.split("\n").slice(0, 8) })} /> : null}
          {sl.layout === "two_column" ? <TextArea label={e.rightColumn} value={sl.right.join("\n")} rows={3} onChange={(ev) => setSlide({ right: ev.target.value.split("\n").slice(0, 8) })} /> : null}
          <TextArea label={e.notes} value={sl.notes} rows={2} maxLength={1200} onChange={(ev) => setSlide({ notes: ev.target.value })} />
        </div>
      </div>
    </div>
  );
}

/** Structured editor: users edit fields, never raw HTML. Output is validated server-side. */
export function ArtifactEditor({ value, onChange, sources = [] }: { value: ArtifactContent; onChange: (v: ArtifactContent) => void; sources?: SourceRef[] }) {
  if (value.type === "presentation") return <DeckEditor value={value} onChange={onChange} sources={sources} />;
  if (value.type === "table") {
    return (
      <div className={s.editor}>
        <TextField label={e.title} value={value.title} onChange={(ev) => onChange({ ...value, title: ev.target.value })} />
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead>
              <tr>{value.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {value.rows.map((r, i) => (
                <tr key={i}>
                  {value.columns.map((c) => (
                    <td key={c.key}>
                      <input
                        aria-label={`${c.label}, row ${i + 1}`}
                        className={s.cellInput}
                        value={String(r[c.key] ?? "")}
                        inputMode={c.kind === "number" ? "decimal" : undefined}
                        onChange={(ev) => {
                          const v = c.kind === "number" && ev.target.value !== "" && !Number.isNaN(Number(ev.target.value)) ? Number(ev.target.value) : ev.target.value;
                          onChange({ ...value, rows: value.rows.map((row, k) => (k === i ? { ...row, [c.key]: v } : row)) });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TextArea label={e.note} value={value.note ?? ""} rows={2} onChange={(ev) => onChange({ ...value, note: ev.target.value || null })} />
      </div>
    );
  }
  const setBlock = (i: number, b: ReportBlock) => onChange({ ...value, blocks: value.blocks.map((x, k) => (k === i ? b : x)) });
  return (
    <div className={s.editor}>
      <TextField label={e.reportTitle} value={value.title} maxLength={200} onChange={(ev) => onChange({ ...value, title: ev.target.value })} />
      {value.blocks.map((b, i) => (
        <div key={i} className={s.editBlock}>
          <div className={s.editRow}>
            <span className={s.editHead}>{e.blocks[b.type]}</span>
            <IconButton label={e.deleteBlock(i + 1)} size="sm" className={s.editRowEnd} onClick={() => onChange({ ...value, blocks: value.blocks.filter((_, k) => k !== i) })}>
              <Trash2 size={14} />
            </IconButton>
          </div>
          {b.type === "heading" ? <TextField label={e.blocks.heading} hideLabel value={b.text} onChange={(ev) => setBlock(i, { ...b, text: ev.target.value })} /> : null}
          {b.type === "paragraph" ? <TextArea label={e.blocks.paragraph} hideLabel rows={3} value={b.text} onChange={(ev) => setBlock(i, { ...b, text: ev.target.value })} hint={b.sourceRefs.length ? e.sourcesKept(b.sourceRefs.join(", ")) : undefined} /> : null}
          {b.type === "callout" ? <TextArea label={e.blocks.callout} hideLabel rows={2} value={b.text} onChange={(ev) => setBlock(i, { ...b, text: ev.target.value })} /> : null}
          {b.type === "bullets" ? <TextArea label={e.bullets} hideLabel rows={3} value={b.items.join("\n")} onChange={(ev) => setBlock(i, { ...b, items: ev.target.value.split("\n") })} /> : null}
          {b.type === "code" ? <TextArea label={e.blocks.code} hideLabel rows={4} value={b.text} onChange={(ev) => setBlock(i, { ...b, text: ev.target.value })} /> : null}
          {b.type === "table_ref" ? <p className={s.editHint}>{e.computedTable(b.caption, b.rows.length)}</p> : null}
          {b.type === "table_ref" ? <TextField label={e.caption} value={b.caption} onChange={(ev) => setBlock(i, { ...b, caption: ev.target.value })} /> : null}
        </div>
      ))}
      <div className={s.editRow}>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "paragraph", text: "", sourceRefs: [] }] })}>
          {e.blocks.paragraph}
        </Button>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "heading", level: 2, text: e.section }] })}>
          {e.blocks.heading}
        </Button>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "bullets", items: [e.item], sourceRefs: [] }] })}>
          {e.blocks.bullets}
        </Button>
      </div>
    </div>
  );
}
