"use client";
import { Suspense } from "react";
import { WorkflowView } from "@/features/workflows/WorkflowView";
import { LoadingBlock } from "@/components/ui";

export default function WorkflowPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <WorkflowView />
    </Suspense>
  );
}
