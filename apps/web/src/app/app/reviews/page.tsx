"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui";

/** Reviews moved into the Inbox; old links keep working. */
export default function ReviewsPage() {
  const router = useRouter();
  useEffect(() => router.replace("/app/inbox/?tab=reviews"), [router]);
  return <LoadingBlock rows={2} />;
}
