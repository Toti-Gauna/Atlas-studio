"use client";
import { Suspense } from "react";
import { ArtifactView } from "@/features/deliverables/ArtifactView";
import { LoadingBlock } from "@/components/ui";

export default function ArtifactPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <ArtifactView />
    </Suspense>
  );
}
