"use client";
import { Suspense } from "react";
import { ChatView } from "@/features/chat/ChatView";
import { LoadingBlock } from "@/components/ui";

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingBlock /></div>}>
      <ChatView />
    </Suspense>
  );
}
