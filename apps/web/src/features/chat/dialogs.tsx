"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Comparison, ComparisonRun, ToolProposal } from "@atlas/contracts";
import { api } from "@/lib/api";
import { copy } from "@/copy/en";
import { modelName, ms } from "@/lib/format";
import { costLabel } from "@/features/runs/RunTrace";
import { Badge, Button, Callout, CitationChip, Modal, Select, TextArea, TextField, useToast } from "@/components/ui";
import s from "./chat.module.css";

function CompareCol({ r }: { r: ComparisonRun }) {
  return (
    <section className={s.compareCol} aria-label={modelName(r.modelKey)}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <strong>{modelName(r.modelKey)}</strong>
        <Badge tone={r.status === "succeeded" ? "teal" : r.status === "abstained" ? "info" : "warn"}>{r.status}</Badge>
      </div>
      {r.error ? <Callout tone="warn">{r.error}</Callout> : <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{r.answer}</p>}
      <div className={s.chips}>{r.citations.map((c, i) => <CitationChip key={c.id} index={i + 1} citation={c} />)}</div>
      <dl style={{ fontSize: 13, display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", margin: 0 }}>
        <dt style={{ color: "var(--text-3)" }}>Latency</dt>
        <dd style={{ margin: 0 }}>{ms(r.latencyMs)}</dd>
        <dt style={{ color: "var(--text-3)" }}>Tokens</dt>
        <dd style={{ margin: 0 }}>{r.inputTokens === null ? "not reported (local)" : `${r.inputTokens} in / ${r.outputTokens} out`}</dd>
        <dt style={{ color: "var(--text-3)" }}>Cost</dt>
        <dd style={{ margin: 0 }}>{costLabel(r.costStatus, r.costNanoUsd)}</dd>
      </dl>
    </section>
  );
}

export function CompareDialog({ open, onClose, conversationId, prompt, agentId }: { open: boolean; onClose: () => void; conversationId: string; prompt: string; agentId: string }) {
  const models = useQuery({ queryKey: ["models"], queryFn: api.models, enabled: open });
  const [a, setA] = useState("local:atlas-extractive-v1");
  const [b, setB] = useState("anthropic:claude-sonnet-5-5");
  const [result, setResult] = useState<Comparison | null>(null);
  const run = useMutation({ mutationFn: () => api.comparisons.create({ conversationId, prompt, modelKeys: [a, b], agentId }), onSuccess: setResult });
  useEffect(() => {
    if (open) setResult(null);
  }, [open]);
  const opts = (models.data ?? []).map((m) => ({ value: m.key, label: `${m.displayName}${m.availability.mode === "pending" ? " (pending)" : ""}` }));
  return (
    <Modal open={open} onClose={onClose} wide title="Compare two models" description="Runs two independent executions of the same prompt; each reserves its own budget before calling.">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 14, color: "var(--text-2)" }}>
          Prompt: <q>{prompt}</q>
        </p>
        <div className={s.compare}>
          <Select label="Model A" value={a} onChange={(e) => setA(e.target.value)} options={opts} />
          <Select label="Model B" value={b} onChange={(e) => setB(e.target.value)} options={opts} />
        </div>
        <div>
          <Button variant="primary" loading={run.isPending} disabled={a === b} onClick={() => run.mutate()}>
            Run both
          </Button>
          {a === b ? <span style={{ marginLeft: 8, fontSize: 13, color: "var(--text-3)" }}>Choose two different models.</span> : null}
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

export function BranchDialog({ open, onClose, initial, onSubmit, pending }: { open: boolean; onClose: () => void; initial: string; onSubmit: (text: string) => void; pending: boolean }) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial, open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit as a new branch"
      description="The original branch and its answers stay intact. The new branch keeps the parent, agent and model configuration."
      footer={
        <>
          <Button onClick={onClose}>{copy.actions.cancel}</Button>
          <Button variant="primary" loading={pending} disabled={!text.trim()} onClick={() => onSubmit(text)}>
            Create branch
          </Button>
        </>
      }
    >
      <TextArea label="Message" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
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
  useEffect(() => {
    if (open) {
      setProposal(null);
      setTitle("");
      setDetails("");
    }
  }, [open]);
  const propose = useMutation({ mutationFn: () => api.conversations.proposeTool(conversationId, { title, details, category }), onSuccess: setProposal });
  const confirm = useMutation({
    mutationFn: () => api.toolProposals.confirm(proposal!.id),
    onSuccess: (r) => {
      toast({ tone: "success", title: `Service request #${r.serviceRequest.number} created`, body: "Created once. Confirming again would not create another." });
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={proposal ? "Confirm this action" : "Prepare a service request"}
      description={proposal ? "Nothing has been created yet. Review the effect below." : "Atlas prepares a proposal first; it only takes effect after your confirmation."}
      footer={
        proposal ? (
          <>
            <Button onClick={onClose}>{copy.actions.cancel}</Button>
            <Button variant="primary" loading={confirm.isPending} onClick={() => confirm.mutate()}>
              Confirm and create
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>{copy.actions.cancel}</Button>
            <Button variant="primary" loading={propose.isPending} disabled={!title.trim()} onClick={() => propose.mutate()}>
              Review proposal
            </Button>
          </>
        )
      }
    >
      {proposal ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Callout tone="teal">{proposal.effectSummary}</Callout>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>This proposal expires at {new Date(proposal.expiresAt).toLocaleTimeString()}.</p>
          {confirm.isError ? <Callout tone="danger">{(confirm.error as Error).message}</Callout> : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} options={[{ value: "shipping", label: "Shipping" }, { value: "billing", label: "Billing" }, { value: "account", label: "Account" }, { value: "other", label: "Other" }]} />
          <TextField label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <TextArea label="Details" rows={3} value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} />
          {propose.isError ? <Callout tone="danger">{(propose.error as Error).message}</Callout> : null}
        </div>
      )}
    </Modal>
  );
}
