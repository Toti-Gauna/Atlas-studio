import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { agentsCopy as c } from "@/copy/agents";

export function BackLink() {
  return (
    <Link href="/app/agents/" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <ArrowLeft size={14} aria-hidden /> {c.editor.back}
    </Link>
  );
}
