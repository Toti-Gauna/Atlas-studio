import type { ArtifactContent, SourceRef } from "@atlas/contracts";
import { toCsv } from "@atlas/domain";

export interface ExportMeta {
  artifactId: string;
  version: number;
  exportedAt: string;
  workspaceName: string;
  label: "DEMO" | "LIVE";
}

const footer = (meta: ExportMeta) => `Atlas Studio · ${meta.workspaceName} · artifact ${meta.artifactId} v${meta.version} · exported ${meta.exportedAt}${meta.label === "DEMO" ? " · DEMO data (fictional)" : ""}`;

function sourcesMd(sources: SourceRef[]): string {
  if (!sources.length) return "";
  return `\n\n## Sources\n\n${sources.map((s) => `- **[${s.ref}]** ${s.documentTitle} · v${s.version}${s.page ? ` · p.${s.page}` : ""} — “${s.quote}”`).join("\n")}`;
}

const mdEscapeCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderMarkdown(content: ArtifactContent, sources: SourceRef[], meta: ExportMeta): string {
  const out: string[] = [];
  if (content.type === "report") {
    for (const b of content.blocks) {
      switch (b.type) {
        case "heading":
          out.push(`${"#".repeat(b.level)} ${b.text}`);
          break;
        case "paragraph":
          out.push(b.text + (b.sourceRefs.length ? ` ${b.sourceRefs.map((r) => `[${r}]`).join("")}` : ""));
          break;
        case "bullets":
          out.push(b.items.map((i) => `- ${i}`).join("\n"));
          break;
        case "callout":
          out.push(`> **${b.tone === "gap" ? "Gap" : b.tone === "warning" ? "Warning" : "Note"}:** ${b.text}`);
          break;
        case "table_ref":
          out.push(`*${b.caption}*\n\n| ${b.columns.map(mdEscapeCell).join(" | ")} |\n| ${b.columns.map(() => "---").join(" | ")} |\n${b.rows.map((r) => `| ${r.map(mdEscapeCell).join(" | ")} |`).join("\n")}`);
          break;
        case "code":
          out.push(`\`\`\`${b.language}\n${b.text}\n\`\`\``);
          break;
      }
    }
  } else if (content.type === "table") {
    out.push(`# ${content.title}`);
    out.push(`| ${content.columns.map((c) => mdEscapeCell(c.label)).join(" | ")} |\n| ${content.columns.map(() => "---").join(" | ")} |\n${content.rows.map((r) => `| ${content.columns.map((c) => mdEscapeCell(String(r[c.key] ?? ""))).join(" | ")} |`).join("\n")}`);
    if (content.note) out.push(`_${content.note}_`);
  } else {
    out.push(`# ${content.title}\n\nAudience: ${content.audience}`);
    content.slides.forEach((s, i) => {
      out.push(`---\n\n## ${i + 1}. ${s.title}${s.subtitle ? `\n\n${s.subtitle}` : ""}`);
      if (s.metric) out.push(`**${s.metric.value}** — ${s.metric.label}`);
      if (s.bullets.length) out.push(s.bullets.map((b) => `- ${b}`).join("\n"));
      if (s.right.length) out.push(s.right.map((b) => `- ${b}`).join("\n"));
      if (s.sourceRefs.length) out.push(`Sources: ${s.sourceRefs.map((r) => `[${r}]`).join(" ")}`);
      if (s.notes) out.push(`> Speaker notes: ${s.notes}`);
    });
  }
  return `${out.join("\n\n")}${sourcesMd(sources)}\n\n---\n\n${footer(meta)}\n`;
}

/** Tabular export. Formula-like cells are neutralized by toCsv. */
export function renderCsv(content: ArtifactContent): string {
  if (content.type === "table") {
    return toCsv(content.columns.map((c) => c.label), content.rows.map((r) => content.columns.map((c) => r[c.key] ?? null)));
  }
  if (content.type === "report") {
    const tables = content.blocks.filter((b): b is Extract<typeof b, { type: "table_ref" }> => b.type === "table_ref");
    if (!tables.length) return toCsv(["block", "text"], content.blocks.map((b, i) => [String(i + 1), "text" in b ? b.text : "items" in b ? b.items.join(" / ") : ""]));
    return tables.map((t) => `# ${t.caption}\r\n${toCsv(t.columns, t.rows)}`).join("\r\n");
  }
  return toCsv(["slide", "title", "bullets", "notes", "sources"], content.slides.map((s, i) => [i + 1, s.title, [...s.bullets, ...s.right].join(" / "), s.notes, s.sourceRefs.join(" ")]));
}

export function renderJson(content: ArtifactContent, sources: SourceRef[], meta: ExportMeta): string {
  return JSON.stringify({ meta, content, sources }, null, 2);
}

const EXTRA_WIN_ANSI = new Set([0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac]);
const WIN_ANSI_OK = (c: number) => c === 9 || c === 10 || c === 13 || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || EXTRA_WIN_ANSI.has(c);

/** pdf-lib standard fonts use WinAnsi; map common Unicode to safe equivalents. */
export function winAnsiSafe(s: string): string {
  return s
    .replace(/[→⇒]/g, "->")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[×]/g, "x")
    .replace(/[·]/g, "-")
    .replace(/[−]/g, "-")
    .split("")
    .map((ch) => (WIN_ANSI_OK(ch.charCodeAt(0)) ? ch : "?"))
    .join("");
}

export { footer as exportFooter };
