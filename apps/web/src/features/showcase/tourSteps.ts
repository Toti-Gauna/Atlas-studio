import type { ShowcaseScenario } from "@atlas/contracts";
import { showcaseCopy } from "@/copy/showcase";
import { workflowHref } from "@/features/workflows/status";

type StepKey = keyof typeof showcaseCopy.step;

export interface TourStep {
  key: StepKey;
  title: string;
  description: string;
  href: string;
  /** True when the step targets a deliverable that only exists after a run created it. */
  waitsForRun: boolean;
}

/** Guide steps are built in the client from the slug; each one links into a real screen. */
export function tourSteps(sc: ShowcaseScenario): TourStep[] {
  const wf = workflowHref(sc.workflowId, { project: sc.projectId });
  const run = sc.lastRun;
  const artifactId = run?.artifactIds[0] ?? null;
  const runHref = run ? workflowHref(sc.workflowId, { run: run.workflowRunId }) : wf;
  const resumable = run?.status === "paused" || run?.status === "failed" || run?.status === "awaiting_confirmation";
  const to = (key: StepKey, href: string): TourStep => ({ key, ...showcaseCopy.step[key], href, waitsForRun: false });
  const art = (key: StepKey): TourStep => ({ key, ...showcaseCopy.step[key], href: artifactId ? `/app/artifact/?id=${artifactId}` : "/app/artifacts/", waitsForRun: !artifactId });

  switch (sc.slug) {
    case "compliance":
      return [to("openProject", `/app/project/?id=${sc.projectId}`), to("previewRun", wf), to("confirmBrief", run?.status === "awaiting_confirmation" ? runHref : wf), art("gapReport"), art("requestReview")];
    case "csv_analysis":
      return [to("profileCsv", "/app/document/?id=doc_shipments"), to("runCsv", resumable ? runHref : wf), art("dataReport"), art("exportData")];
    case "presentation":
      return [to("runDeck", resumable ? runHref : wf), art("editSlide"), art("exportPptx")];
  }
}
