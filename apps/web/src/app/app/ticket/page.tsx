"use client";
import { Suspense } from "react";
import { TicketView } from "@/features/desk/TicketView";
import { LoadingBlock } from "@/components/ui";

export default function TicketPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <TicketView />
    </Suspense>
  );
}
