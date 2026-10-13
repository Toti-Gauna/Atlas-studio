"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Comparison, ComparisonRun, ToolProposal } from "@atlas/contracts";
import { api } from "@/lib/api";
import { copy } from "@/copy/en";
import { chatCopy } from "@/copy/chat";
import { modelName, ms } from "@/lib/format";
import { costLabel } from "@/features/runs/RunTrace";
import { Button, Callout, CitationChip, Modal, Select, StatusBadge, TextArea, TextField, useToast } from "@/components/ui";
import s from "./chat.module.css";

const cc = chatCopy.compare;
const sc = chatCopy.service;

function CompareCol({ r }: { r: ComparisonRun }) {
  return (
    <section className={s.compareCol} aria-label={modelName(r.modelKey)}>
      <div className={s.compareHead}>
        <strong>{modelName(r.modelKey)}</strong>
        <StatusBadge kind="run" status={r.status} />
      </div>
      {r.error ? <Callout tone="warn">{r.error}</Callout> : <p className={s.compareAnswer}>{r.answer}</p>}
      <div className={s.chips}>{r.citations.map((c, i) => <CitationChip key={c.id} index={i + 1} citation={c} />)}</div>
      <dl className={s.compareStats}>
        <dt>{cc.latency}</dt>
        <dd>{ms(r.latencyMs)}</dd>
        <dt>{cc.tokens}</dt>
        <dd>{r.inputTokens === null ? cc.tokensLocal : `${r.inputTokens} in / ${r.outputTokens} out`}</dd>
        <dt>{cc.cost}</dt>
        <dd>{costLabel(r.costStatus, r.costNanoUsd)}</dd>
      </dl>
    </section>
  );
}

/** Compares the question behind the clicked answer on two connected models (never a pending one). */
export function CompareDialog({ open, onClose, conversationId, prompt, agentId }: { open: boolean; onClose: () => void; conversationId: string; prompt: string; agentId: string }) {
  const models = useQuery({ queryKey: ["models"], queryFn: api.models, enabled: open });
  const available = (models.data ?? []).filter((m) => m.availability.mode !== "pending");
  const [picked, setPicked] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });
  const a = picked.a ?? available[0]?.key ?? "";
  const b = picked.b ?? available.find((m) => m.key !== a)?.key ?? "";
  const [result, setResult] = useState<Comparison | null>(null);
  const run = useMutation({ mutationFn: () => api.comparisons.create({ conversationId, prompt, modelKeys: [a, b], agentId }), onSuccess: setResult });
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setResult(null);
  }
  const opts = (models.data ?? []).map((m) => ({
    value: m.key,
    label: m.availability.mode === "pending" ? `${m.displayName} — ${chatCopy.composer.needsAdmin}` : m.displayName,
    disabled: m.availability.mode === "pending",
  }));
  const enough = available.length >= 2;
  return (
    <Modal open={open} onClose={onClose} wide title={cc.title} description={cc.description}>
      <div className={s.dialogStack}>
        <p className={s.compareQuestion}>
          {cc.question}: <q>{prompt}</q>
        </p>
        {models.isSuccess && !enough ? <Callout>{cc.needTwo}</Callout> : null}
        <div className={s.compare}>
          <Select label={cc.a} value={a} onChange={(e) => setPicked((p) => ({ ...p, a: e.target.value }))} options={opts} disabled={!enough} />
          <Select label={cc.b} value={b} onChange={(e) => setPicked((p) => ({ ...p, b: e.target.value }))} options={opts} disabled={!enough} />
        </div>
        <div className={s.inlineRow}>
          <Button variant="primary" loading={run.isPending} disabled={!enough || !a || !b || a === b} onClick={() => run.mutate()}>
            {cc.run}
          </Button>
          {enough && a === b ? <span className={s.mutedNote}>{cc.same}</span> : null}
        </div>
        {run.isError ? <Callout tone="danger">{(run.error as Error).message}</Callout> : null}
        {result ? (
          <>
            <div className={s.compare}>
              <CompareCol r={result.left} />
              <CompareCol r={result.right} />
            </div>
            <Callout>{copy.disclaimers.comparison}</Callout>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

/** "Edit question": the edited question is answered as a new attempt; the original stays under Version. */
export function EditQuestionDialog({ open, onClose, initial, onSubmit, pending }: { open: boolean; onClose: () => void; initial: string; onSubmit: (text: string) => void; pending: boolean }) {
  const [text, setText] = useState(initial);
  const [seed, setSeed] = useState({ initial, open });
  if (seed.initial !== initial || seed.open !== open) {
    setSeed({ initial, open });
    setText(initial);
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={chatCopy.edit.title}
      description={chatCopy.edit.description}
      footer={
        <>
          <Button onClick={onClose}>{copy.actions.cancel}</Button>
          <Button variant="primary" loading={pending} disabled={!text.trim()} onClick={() => onSubmit(text)}>
            {chatCopy.edit.submit}
          </Button>
        </>
      }
    >
      <TextArea label={chatCopy.edit.label} rows={4} value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

/** Núcleo: proposal → visible effect → explicit one-shot confirmation. */
export function ServiceRequestDialog({ open, onClose, conversationId }: { open: boolean; onClose: () => void; conversationId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<ToolProposal["payload"]["category"]>("shipping");
  const [proposal, setProposal] = useState<ToolProposal | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setProposal(null);
      setTitle("");
      setDetails("");
    }
  }
  const propose = useMutation({ mutationFn: () => api.conversations.proposeTool(conversationId, { title, details, category }), onSuccess: setProposal });
  const confirm = useMutation({
    mutationFn: () => api.toolProposals.confirm(proposal!.id),
    onSuccess: (r) => {
      toast({ tone: "success", title: chatCopy.toasts.serviceRequest(r.serviceRequest.number) });
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={proposal ? sc.confirm : sc.prepare}
      description={proposal ? sc.confirmBody : sc.prepareBody}
      footer={
        proposal ? (
          <>
            <Button onClick={onClose}>{copy.actions.cancel}</Button>
            <Button variant="primary" loading={confirm.isPending} onClick={() => confirm.mutate()}>
              {sc.create}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>{copy.actions.cancel}</Button>
            <Button variant="primary" loading={propose.isPending} disabled={!title.trim()} onClick={() => propose.mutate()}>
              {sc.review}
            </Button>
          </>
        )
      }
    >
      {proposal ? (
        <div className={s.dialogStack}>
          <Callout tone="teal">{proposal.effectSummary}</Callout>
          <p className={s.mutedNote}>{sc.expires(new Date(proposal.expiresAt).toLocaleTimeString())}</p>
          {confirm.isError ? <Callout tone="danger">{(confirm.error as Error).message}</Callout> : null}
        </div>
      ) : (
        <div className={s.dialogStack}>
          <Select label={sc.category} value={category} onChange={(e) => setCategory(e.target.value as typeof category)} options={[...sc.categories]} />
          <TextField label={sc.title} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <TextArea label={sc.details} rows={3} value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} />
          {propose.isError ? <Callout tone="danger">{(propose.error as Error).message}</Callout> : null}
        </div>
      )}
    </Modal>
  );
}
