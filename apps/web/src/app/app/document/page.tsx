"use client";
import { Suspense } from "react";
import { DocumentView } from "@/features/library/DocumentView";
import { LoadingBlock } from "@/components/ui";

export default function DocumentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <DocumentView />
    </Suspense>
  );
}
