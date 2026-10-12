"use client";
import { Suspense } from "react";
import { ProjectView } from "@/features/projects/ProjectView";
import { LoadingBlock } from "@/components/ui";

export default function ProjectPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <ProjectView />
    </Suspense>
  );
}
