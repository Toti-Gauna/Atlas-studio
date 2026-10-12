"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import type { Ticket } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { deskCopy as c } from "@/copy/desk";
import { Avatar, Button, Card, TextArea, cx, useToast } from "@/components/ui";
import s from "./desk.module.css";

/** Reply thread: operator and customer messages are styled differently; both can reply. */
export function TicketThread({ ticket, isCustomer }: { ticket: Ticket; isCustomer: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canReply = useCan("ticket.reply_own");
  const [text, setText] = useState("");
  const reply = useMutation({
    mutationFn: (body: string) => api.tickets.reply(ticket.id, body),
    onSuccess: (t) => {
      qc.setQueryData(["ticket", ticket.id], t);
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      setText("");
      toast({ tone: "success", title: c.ticket.sent });
    },
    onError: (e) => toast({ tone: "error", title: c.ticket.sendFailed, body: (e as Error).message }),
  });
  const submit = () => {
    if (text.trim()) reply.mutate(text.trim());
  };

  return (
    <section aria-labelledby="thread-h" className={s.thread}>
      <h2 id="thread-h" className={s.h2}>{c.ticket.thread}</h2>
      {ticket.replies.length === 0 ? (
        <p className={s.muted}>{c.ticket.noReplies}</p>
      ) : (
        <ol className={s.replies} aria-live="polite">
          {ticket.replies.map((r) => (
            <li key={r.id} className={cx(s.reply, r.authorRole === "operator" && s.replyOperator, r.authorRole === "system" && s.replySystem)}>
              <div className={s.replyHead}>
                <Avatar name={r.authorName} size={24} />
                <strong>{r.authorName}</strong>
                <span className={s.roleTag}>{c.ticket.roles[r.authorRole]}</span>
                <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)} className={s.muted}>
                  {relativeTime(r.createdAt)}
                </time>
              </div>
              <p className={s.replyBody}>{r.body}</p>
            </li>
          ))}
        </ol>
      )}
      {canReply ? (
        <Card>
          <form
            className={s.replyForm}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <TextArea
              label={c.ticket.replyField}
              rows={4}
              maxLength={4000}
              value={text}
              placeholder={isCustomer ? c.ticket.replyCustomerPlaceholder : c.ticket.replyPlaceholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              hint={`${text.length} / 4,000 · Ctrl/⌘ + Enter to send`}
            />
            <div>
              <Button type="submit" variant="primary" icon={<Send size={14} aria-hidden />} loading={reply.isPending} disabled={!text.trim()}>
                {c.ticket.send}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </section>
  );
}
