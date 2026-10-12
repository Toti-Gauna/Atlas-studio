"use client";
import { Suspense } from "react";
import { RunsView } from "@/features/runs-history/RunsView";
import { LoadingBlock } from "@/components/ui";

export default function RunsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <RunsView />
    </Suspense>
  );
}
