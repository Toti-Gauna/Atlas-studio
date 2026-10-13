"use client";
import type { Project } from "@atlas/contracts";
import { projectColor } from "@/components/ui";
import s from "./projects.module.css";

/** Project identity dot from the categorical palette (never a status color). */
export function ProjectDot({ color }: { color: Project["color"] }) {
  return <span className={s.dot} style={{ background: projectColor(color) }} aria-hidden />;
}

export const newChatHref = (p: Pick<Project, "id" | "defaultAgentId">) => `/app/chat/?new=1&project=${p.id}${p.defaultAgentId ? `&agent=${p.defaultAgentId}` : ""}`;
