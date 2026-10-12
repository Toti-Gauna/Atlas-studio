"use client";
import { Suspense } from "react";
import { SettingsView } from "@/features/settings/SettingsView";
import { LoadingBlock } from "@/components/ui";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <SettingsView />
    </Suspense>
  );
}
