"use client";
import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Bot, Cpu, Paperclip, Square } from "lucide-react";
import type { AgentSummary, WorkMode } from "@atlas/contracts";
import { estimateTokens } from "@atlas/domain";
import { api } from "@/lib/api";
import { modelName } from "@/lib/format";
import { Button, IconButton, Modal, Badge } from "@/components/ui";
import s from "./chat.module.css";

export interface ComposerState {
  agentId: string | null;
  pinnedModelKey: string | null;
  workMode: WorkMode;
  attachments: string[];
}

export interface ComposerHandle {
  focus: () => void;
}

const MODES: Array<{ value: WorkMode; label: string }> = [
  { value: "answer", label: "Answer" },
  { value: "plan_then_run", label: "Plan & run" },
  { value: "draft_artifact", label: "Draft deliverable" },
];

/** Spacious composer: attachments, agent, model, mode, sources and an honest estimate. */
export const Composer = forwardRef<ComposerHandle, {
  value: string;
  onChange: (v: string) => void;
  state: ComposerState;
  onState: (patch: Partial<ComposerState>) => void;
  agents: AgentSummary[];
  projectId: string | null;
  pending: boolean;
  onSend: () => void;
  onStop: () => void;
  disabled?: boolean;
  extra?: ReactNode;
}>(function Composer({ value, onChange, state, onState, agents, projectId, pending, onSend, onStop, disabled, extra }, ref) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));
  const [attachOpen, setAttachOpen] = useState(false);
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const docs = useQuery({ queryKey: ["documents", projectId], queryFn: () => api.documents.list(projectId ?? undefined), enabled: Boolean(projectId) });
  const agent = agents.find((a) => a.id === state.agentId);
  const effectiveModel = state.pinnedModelKey ?? agent?.modelKey ?? null;
  const model = models.data?.find((m) => m.key === effectiveModel);
  const readyDocs = (docs.data ?? []).filter((d) => d.latestStatus === "ready");

  return (
    <>
      <div className={s.composer}>
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={inputRef}
          className={s.composerInput}
          placeholder={agent ? `Ask ${agent.name}… (Enter to send, Shift+Enter for a new line)` : "Ask about your sources…"}
          value={value}
          rows={2}
          maxLength={8000}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!pending && value.trim()) onSend();
            }
          }}
        />
        <div className={s.composerBar}>
          <IconButton label={`Attach project sources (${state.attachments.length} selected)`} size="sm" onClick={() => setAttachOpen(true)} disabled={!projectId}>
            <Paperclip size={16} />
          </IconButton>
          <label className={s.pill} title="Agent for the next run">
            <Bot size={14} aria-hidden />
            <span className="sr-only">Agent</span>
            <select className={s.pillSelect} value={state.agentId ?? ""} onChange={(e) => onState({ agentId: e.target.value })}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.pill} title="Model for this conversation">
            <Cpu size={14} aria-hidden />
            <span className="sr-only">Model</span>
            <select className={s.pillSelect} value={state.pinnedModelKey ?? ""} onChange={(e) => onState({ pinnedModelKey: e.target.value || null })}>
              <option value="">Agent default ({modelName(agent?.modelKey ?? "local:atlas-extractive-v1")})</option>
              {(models.data ?? []).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.displayName}
                  {m.availability.mode === "pending" ? " — pending" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={s.pill} title="Work mode">
            <span className="sr-only">Work mode</span>
            <select className={s.pillSelect} value={state.workMode} onChange={(e) => onState({ workMode: e.target.value as WorkMode })}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {extra}
          <div className={s.sendRow}>
            {pending ? (
              <Button size="sm" variant="secondary" icon={<Square size={12} />} onClick={onStop}>
                Stop
              </Button>
            ) : (
              <IconButton label="Send message" variant="primary" disabled={!value.trim() || disabled} onClick={onSend}>
                <ArrowUp size={18} />
              </IconButton>
            )}
          </div>
        </div>
      </div>
      <div className={s.composerFoot} aria-live="polite">
        <span>
          Sources: {state.attachments.length ? `${state.attachments.length} attached` : `all authorized project documents (${readyDocs.length})`}
        </span>
        <span>
          Model: {model?.displayName ?? "—"}
          {model?.availability.mode === "pending" ? <Badge tone="warn">pending</Badge> : null}
        </span>
        <span>
          Estimate:{" "}
          {model?.provider === "local"
            ? "local · no provider charge"
            : model
              ? `≈${estimateTokens(value).toLocaleString()} input tokens + context; reserved before the call`
              : "—"}
        </span>
      </div>
      <Modal
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        title="Attach sources"
        description="Limit this message to specific project documents. Agents can never read documents outside their authorized scope."
        footer={<Button variant="primary" onClick={() => setAttachOpen(false)}>Done</Button>}
      >
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <legend className="sr-only">Project documents</legend>
          {readyDocs.map((d) => (
            <label key={d.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={state.attachments.includes(d.id)}
                onChange={(e) => onState({ attachments: e.target.checked ? [...state.attachments, d.id] : state.attachments.filter((x) => x !== d.id) })}
              />
              <span>{d.title}</span>
              <Badge mono>{d.kind}</Badge>
            </label>
          ))}
          {readyDocs.length === 0 ? <p>No ready documents in this project.</p> : null}
        </fieldset>
      </Modal>
    </>
  );
});
