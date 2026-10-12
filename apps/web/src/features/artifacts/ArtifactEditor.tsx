"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ArtifactContent, ReportBlock, Slide } from "@atlas/contracts";
import { Button, IconButton, Select, TextArea, TextField } from "@/components/ui";
import s from "./artifact.module.css";

/** Structured editor: users edit fields, never raw HTML. Output is validated server-side. */
export function ArtifactEditor({ value, onChange }: { value: ArtifactContent; onChange: (v: ArtifactContent) => void }) {
  if (value.type === "presentation") {
    const setSlide = (i: number, patch: Partial<Slide>) => onChange({ ...value, slides: value.slides.map((sl, k) => (k === i ? { ...sl, ...patch } : sl)) });
    const move = (i: number, d: -1 | 1) => {
      const next = [...value.slides];
      const [x] = next.splice(i, 1);
      next.splice(i + d, 0, x!);
      onChange({ ...value, slides: next });
    };
    return (
      <div className={s.editor}>
        <TextField label="Deck title" value={value.title} maxLength={200} onChange={(e) => onChange({ ...value, title: e.target.value })} />
        <TextField label="Audience" value={value.audience} maxLength={200} onChange={(e) => onChange({ ...value, audience: e.target.value })} />
        <Select label="Theme" value={value.theme} onChange={(e) => onChange({ ...value, theme: e.target.value as typeof value.theme })} options={[{ value: "atlas_light", label: "Atlas Pearl" }, { value: "atlas_ink", label: "Atlas Ink" }]} />
        {value.slides.map((sl, i) => (
          <fieldset key={sl.id} className={s.editBlock}>
            <legend className="eyebrow">Slide {i + 1}</legend>
            <div className={s.editRow}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Select label="Layout" value={sl.layout} onChange={(e) => setSlide(i, { layout: e.target.value as Slide["layout"], metric: e.target.value === "metric" ? (sl.metric ?? { value: "0", label: "Metric" }) : sl.metric })} options={["title", "bullets", "two_column", "metric", "closing"].map((l) => ({ value: l, label: l.replace("_", " ") }))} />
              </div>
              <IconButton label={`Move slide ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={16} />
              </IconButton>
              <IconButton label={`Move slide ${i + 1} down`} disabled={i === value.slides.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={16} />
              </IconButton>
              <IconButton label={`Delete slide ${i + 1}`} disabled={value.slides.length === 1} onClick={() => onChange({ ...value, slides: value.slides.filter((_, k) => k !== i) })}>
                <Trash2 size={16} />
              </IconButton>
            </div>
            <TextField label="Title" value={sl.title} maxLength={120} onChange={(e) => setSlide(i, { title: e.target.value })} />
            {sl.layout === "title" ? <TextField label="Subtitle" value={sl.subtitle ?? ""} maxLength={200} onChange={(e) => setSlide(i, { subtitle: e.target.value || null })} /> : null}
            {sl.layout === "metric" && sl.metric ? (
              <div className={s.editRow}>
                <TextField label="Metric value" value={sl.metric.value} maxLength={24} onChange={(e) => setSlide(i, { metric: { ...sl.metric!, value: e.target.value } })} />
                <TextField label="Metric label" value={sl.metric.label} maxLength={80} onChange={(e) => setSlide(i, { metric: { ...sl.metric!, label: e.target.value } })} />
              </div>
            ) : null}
            {sl.layout !== "title" ? <TextArea label="Bullets (one per line)" value={sl.bullets.join("\n")} rows={3} onChange={(e) => setSlide(i, { bullets: e.target.value.split("\n").slice(0, 8) })} /> : null}
            {sl.layout === "two_column" ? <TextArea label="Right column (one per line)" value={sl.right.join("\n")} rows={3} onChange={(e) => setSlide(i, { right: e.target.value.split("\n").slice(0, 8) })} /> : null}
            <TextArea label="Speaker notes" value={sl.notes} rows={2} maxLength={1200} onChange={(e) => setSlide(i, { notes: e.target.value })} />
          </fieldset>
        ))}
        <Button icon={<Plus size={14} />} disabled={value.slides.length >= 40} onClick={() => onChange({ ...value, slides: [...value.slides, { id: `s${Date.now()}`, layout: "bullets", title: "New slide", subtitle: null, bullets: ["Point"], right: [], metric: null, notes: "", sourceRefs: [] }] })}>
          Add slide
        </Button>
      </div>
    );
  }
  if (value.type === "table") {
    return (
      <div className={s.editor}>
        <TextField label="Title" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
        <div style={{ overflowX: "auto" }}>
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
                        style={{ width: "100%", minWidth: 80, border: "1px solid var(--line)", borderRadius: 6, padding: "4px 6px", background: "var(--surface)" }}
                        value={String(r[c.key] ?? "")}
                        inputMode={c.kind === "number" ? "decimal" : undefined}
                        onChange={(e) => {
                          const v = c.kind === "number" && e.target.value !== "" && !Number.isNaN(Number(e.target.value)) ? Number(e.target.value) : e.target.value;
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
        <TextArea label="Note" value={value.note ?? ""} rows={2} onChange={(e) => onChange({ ...value, note: e.target.value || null })} />
      </div>
    );
  }
  const setBlock = (i: number, b: ReportBlock) => onChange({ ...value, blocks: value.blocks.map((x, k) => (k === i ? b : x)) });
  return (
    <div className={s.editor}>
      <TextField label="Report title" value={value.title} maxLength={200} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      {value.blocks.map((b, i) => (
        <div key={i} className={s.editBlock}>
          <div className={s.editRow}>
            <span className="eyebrow">{b.type.replace("_", " ")}</span>
            <IconButton label={`Delete block ${i + 1}`} size="sm" style={{ marginLeft: "auto" }} onClick={() => onChange({ ...value, blocks: value.blocks.filter((_, k) => k !== i) })}>
              <Trash2 size={14} />
            </IconButton>
          </div>
          {b.type === "heading" ? <TextField label="Heading" hideLabel value={b.text} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} /> : null}
          {b.type === "paragraph" ? <TextArea label="Paragraph" hideLabel rows={3} value={b.text} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} hint={b.sourceRefs.length ? `Sources kept: ${b.sourceRefs.join(", ")}` : undefined} /> : null}
          {b.type === "callout" ? <TextArea label="Callout" hideLabel rows={2} value={b.text} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} /> : null}
          {b.type === "bullets" ? <TextArea label="Bullets (one per line)" hideLabel rows={3} value={b.items.join("\n")} onChange={(e) => setBlock(i, { ...b, items: e.target.value.split("\n") })} /> : null}
          {b.type === "code" ? <TextArea label="Code (text only)" hideLabel rows={4} value={b.text} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} /> : null}
          {b.type === "table_ref" ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Computed table “{b.caption}” ({b.rows.length} rows). Values come from tools; edit the caption only.</p> : null}
          {b.type === "table_ref" ? <TextField label="Caption" value={b.caption} onChange={(e) => setBlock(i, { ...b, caption: e.target.value })} /> : null}
        </div>
      ))}
      <div className={s.editRow}>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "paragraph", text: "", sourceRefs: [] }] })}>
          Paragraph
        </Button>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "heading", level: 2, text: "Section" }] })}>
          Heading
        </Button>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "bullets", items: ["Item"], sourceRefs: [] }] })}>
          Bullets
        </Button>
      </div>
    </div>
  );
}
