import type { ArtifactContent, ExportFormat } from "@atlas/contracts";
import { supportedFormats } from "@atlas/renderers";

/** Native export per type: deck → PPTX, report → PDF, table → CSV. */
export function nativeFormat(content: ArtifactContent): ExportFormat {
  return content.type === "presentation" ? "pptx" : content.type === "table" ? "csv" : "pdf";
}

/** Other formats that make sense for the type (no CSV/JSON for decks). */
export function otherFormats(content: ArtifactContent): ExportFormat[] {
  const native = nativeFormat(content);
  return supportedFormats(content).filter((f) => f !== native && !(content.type === "presentation" && (f === "csv" || f === "json")));
}
