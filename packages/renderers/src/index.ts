import type { ArtifactContent, ExportFormat, SourceRef } from "@atlas/contracts";
import { renderCsv, renderJson, renderMarkdown, type ExportMeta } from "./text";

export { renderCsv, renderJson, renderMarkdown, winAnsiSafe, type ExportMeta } from "./text";
export { SLIDE_LAYOUT } from "./layout";

export const MIME: Record<ExportFormat, string> = {
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function supportedFormats(content: ArtifactContent): ExportFormat[] {
  return content.type === "presentation" ? ["pptx", "pdf", "md", "csv", "json"] : ["pdf", "md", "csv", "json"];
}

export function exportFilename(title: string, version: number, format: ExportFormat): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "artifact";
  return `${slug}-v${version}.${format}`;
}

/** Renders any supported format. PDF/PPTX modules load lazily to keep bundles small. */
export async function renderExport(format: ExportFormat, content: ArtifactContent, sources: SourceRef[], meta: ExportMeta): Promise<Uint8Array | string> {
  if (!supportedFormats(content).includes(format)) throw new Error(`${format.toUpperCase()} export is not available for ${content.type} artifacts.`);
  switch (format) {
    case "md":
      return renderMarkdown(content, sources, meta);
    case "csv":
      return renderCsv(content);
    case "json":
      return renderJson(content, sources, meta);
    case "pdf": {
      const { renderPdf } = await import("./pdf");
      return renderPdf(content, sources, meta);
    }
    case "pptx": {
      const { renderPptx } = await import("./pptx");
      return renderPptx(content, sources, meta);
    }
  }
}
