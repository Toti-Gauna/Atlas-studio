"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Check, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import type { MemoryItem } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Button, Modal, StatusBadge, TextArea, useToast } from "@/components/ui";
import { copy } from "@/copy/en";
import { projectsCopy as P } from "@/copy/projects";
import s from "./projects.module.css";

const M = P.memory;

/** Where an agent-suggested memory came from: a link to its conversation, never the raw run id. */
function SourceConversationLink({ runId }: { runId: string }) {
  const run = useQuery({ queryKey: ["run", runId], queryFn: () => api.runs.get(runId), staleTime: 5 * 60_000 });
  const conversationId = run.data?.conversationId;
  if (!conversationId) return null;
  return (
    <Link href={`/app/chat/?c=${conversationId}`} className={s.memLink}>
      {M.viewSource}
    </Link>
  );
}

function useMemoryMutations(queryKey: QueryKey) {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = (e: unknown) => toast({ tone: "error", title: copy.states.errorTitle, body: e instanceof Error ? e.message : undefined });
  const done = (title: string) => {
    void qc.invalidateQueries({ queryKey });
    toast({ tone: "success", title });
  };
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { content?: string; status?: "approved" | "disabled" } }) => api.memories.update(id, body),
    onSuccess: () => done(M.updated),
    onError,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.memories.remove(id), onSuccess: () => done(M.deleted), onError });
  return { update, remove };
}

function MemoryRow({ item, canWrite, queryKey }: { item: MemoryItem; canWrite: boolean; queryKey: QueryKey }) {
  const { update, remove } = useMemoryMutations(queryKey);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content);
  const [confirm, setConfirm] = useState(false);
  const setStatus = (status: "approved" | "disabled") => update.mutate({ id: item.id, body: { status } });
  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    update.mutate({ id: item.id, body: { content: text.trim() } }, { onSuccess: () => setEditing(false) });
  };

  return (
    <li className={s.memItem} data-status={item.status}>
      <div className={s.memBadges}>
        <StatusBadge kind="memory" status={item.status} />
        <span className={s.memMeta}>
          {M.source[item.source]} · {formatDateTime(item.updatedAt)}
        </span>
        {item.sourceRunId ? <SourceConversationLink runId={item.sourceRunId} /> : null}
      </div>
      {editing ? (
        <form onSubmit={saveEdit} className={s.inlineForm}>
          <TextArea label={M.editLabel} hideLabel value={text} maxLength={500} rows={2} autoFocus onChange={(e) => setText(e.target.value)} hint={`${text.length}/500`} />
          <div className={s.rowActions}>
            <Button type="submit" size="sm" variant="primary" loading={update.isPending} disabled={!text.trim()}>
              {M.save}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setText(item.content);
                setEditing(false);
              }}
            >
              {copy.actions.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <p className={s.memContent}>{item.content}</p>
      )}
      {canWrite && !editing ? (
        <div className={s.rowActions}>
          {item.status === "proposed" ? (
            <Button size="sm" variant="primary" icon={<Check size={13} aria-hidden />} onClick={() => setStatus("approved")} disabled={update.isPending}>
              {M.approve}
            </Button>
          ) : item.status === "approved" ? (
            <Button size="sm" icon={<PowerOff size={13} aria-hidden />} onClick={() => setStatus("disabled")} disabled={update.isPending}>
              {M.disable}
            </Button>
          ) : (
            <Button size="sm" icon={<Power size={13} aria-hidden />} onClick={() => setStatus("approved")} disabled={update.isPending}>
              {M.enable}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Pencil size={13} aria-hidden />} onClick={() => setEditing(true)}>
            {M.edit}
          </Button>
          <Button size="sm" variant="ghost" icon={<Trash2 size={13} aria-hidden />} onClick={() => setConfirm(true)}>
            {M.delete}
          </Button>
        </div>
      ) : null}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={M.deleteTitle}
        description={<q>{item.content}</q>}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{copy.actions.cancel}</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(item.id, { onSuccess: () => setConfirm(false) })}>
              {M.delete}
            </Button>
          </>
        }
      >
        <p>{M.deleteBody}</p>
      </Modal>
    </li>
  );
}

export function MemoryList({ items, canWrite, queryKey, caption }: { items: MemoryItem[]; canWrite: boolean; queryKey: QueryKey; caption: string }) {
  return (
    <ul className={s.memList} aria-label={caption}>
      {items.map((m) => (
        <MemoryRow key={m.id} item={m} canWrite={canWrite} queryKey={queryKey} />
      ))}
    </ul>
  );
}

export function AddMemoryForm({ scope, projectId, queryKey, label, placeholder }: { scope: MemoryItem["scope"]; projectId: string | null; queryKey: QueryKey; label: string; placeholder: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const create = useMutation({
    mutationFn: () => api.memories.create({ scope, projectId, content: text.trim() }),
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey });
      toast({ tone: "success", title: M.added });
    },
  });
  return (
    <form
      className={s.addForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) create.mutate();
      }}
    >
      <TextArea label={label} value={text} maxLength={500} rows={2} placeholder={placeholder} hint={`${M.addHint} (${text.length}/500)`} error={create.isError ? (create.error instanceof Error ? create.error.message : copy.states.errorBody) : null} onChange={(e) => setText(e.target.value)} />
      <div>
        <Button type="submit" variant="secondary" loading={create.isPending} disabled={!text.trim()}>
          {M.add}
        </Button>
      </div>
    </form>
  );
}
