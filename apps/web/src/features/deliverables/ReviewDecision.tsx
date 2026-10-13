"use client";
import { useState } from "react";
import { Check, PenLine } from "lucide-react";
import type { ReviewRequest } from "@atlas/contracts";
import { reviewsCopy as c } from "@/copy/reviews";
import { Button, TextArea } from "@/components/ui";
import s from "./deliverables.module.css";

/** Approve / request changes for the open request on the current version. */
export function ReviewDecision({ request, pending, onDecide, asAdmin }: { request: ReviewRequest; pending: "approve" | "request_changes" | null; onDecide: (d: "approve" | "request_changes", note: string) => void; asAdmin?: boolean }) {
  const [note, setNote] = useState("");
  const [needNote, setNeedNote] = useState(false);
  return (
    <div className={s.decision}>
      <h3 className={s.subhead}>{asAdmin ? c.panel.decideAsAdminTitle(request.version) : c.panel.decideTitle(request.version)}</h3>
      {asAdmin ? <p className={s.muted}>{c.panel.decideAsAdminNote(request.reviewerName)}</p> : null}
      <TextArea
        label={c.panel.note}
        hint={c.panel.noteHint}
        error={needNote && !note.trim() ? c.panel.noteRequired : null}
        rows={3}
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className={s.actions}>
        <Button variant="primary" icon={<Check size={14} aria-hidden />} loading={pending === "approve"} disabled={pending !== null} onClick={() => onDecide("approve", note)}>
          {c.panel.approve} v{request.version}
        </Button>
        <Button
          icon={<PenLine size={14} aria-hidden />}
          loading={pending === "request_changes"}
          disabled={pending !== null}
          onClick={() => {
            if (!note.trim()) {
              setNeedNote(true);
              return;
            }
            onDecide("request_changes", note);
          }}
        >
          {c.panel.requestChanges}
        </Button>
      </div>
    </div>
  );
}
