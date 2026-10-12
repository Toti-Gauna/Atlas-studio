"use client";
import { Suspense } from "react";
import { AgentEditor } from "@/features/agents/AgentEditor";
import { LoadingBlock } from "@/components/ui";

export default function AgentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <AgentEditor />
    </Suspense>
  );
}
