"use client";
import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Paperclip, SlidersHorizontal, Square } from "lucide-react";
import type { AgentSummary, WorkMode } from "@atlas/contracts";
import { estimateTokens } from "@atlas/domain";
import { api } from "@/lib/api";
import { modelName } from "@/lib/format";
import { chatCopy } from "@/copy/chat";
import { Badge, Button, IconButton, Modal, Segmented, Select } from "@/components/ui";
import { Popover } from "./Menu";
import s from "./chat.module.css";

const c = chatCopy.composer;

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
  { value: "answer", label: c.modes.answer },
  { value: "draft_artifact", label: c.modes.draft_artifact },
  { value: "plan_then_run", label: c.modes.plan_then_run },
];

/** Composer: visible work mode, one compact Settings control (agent + model), sources and an honest cost line. */
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
  const unavailable = model?.availability.mode === "pending";

  return (
    <>
      <div className={s.composer}>
        <div className={s.composerModes}>
          <Segmented<WorkMode> label={c.modeLabel} value={state.workMode} onChange={(workMode) => onState({ workMode })} options={MODES} />
        </div>
        <label htmlFor="composer-input" className="sr-only">
          {c.label}
        </label>
        <textarea
          id="composer-input"
          ref={inputRef}
          className={s.composerInput}
          placeholder={c.placeholder(agent?.name ?? null)}
          value={value}
          rows={2}
          maxLength={8000}
          disabled={disabled}
          aria-describedby="composer-hint"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!pending && value.trim()) onSend();
            }
          }}
        />
        <span id="composer-hint" className="sr-only">
          {c.hint}
        </span>
        <div className={s.composerBar}>
          <IconButton label={c.attach(state.attachments.length)} size="sm" onClick={() => setAttachOpen(true)} disabled={!projectId}>
            <Paperclip size={16} />
          </IconButton>
          <Popover
            label={c.settingsTitle}
            trigger={(p) => (
              <button type="button" className={s.settingsBtn} {...p} aria-label={`${c.settings}: ${agent?.name ?? ""}, ${model?.displayName ?? ""}`}>
                <SlidersHorizontal size={14} aria-hidden />
                <span className={s.settingsText}>
                  {agent?.name ?? c.settings}
                  {state.pinnedModelKey ? ` · ${modelName(state.pinnedModelKey)}` : ""}
                </span>
                {unavailable ? <span className={s.settingsWarn} aria-hidden /> : null}
              </button>
            )}
          >
            <Select label={c.agent} value={state.agentId ?? ""} onChange={(e) => onState({ agentId: e.target.value })} options={agents.map((a) => ({ value: a.id, label: a.name }))} />
            <Select
              label={c.model}
              value={state.pinnedModelKey ?? ""}
              onChange={(e) => onState({ pinnedModelKey: e.target.value || null })}
              options={[
                { value: "", label: c.agentDefault(modelName(agent?.modelKey ?? "local:atlas-extractive-v1")) },
                ...(models.data ?? []).map((m) => ({
                  value: m.key,
                  label: m.availability.mode === "pending" ? `${m.displayName} — ${c.needsAdmin}` : m.displayName,
                  disabled: m.availability.mode === "pending" && m.key !== state.pinnedModelKey,
                })),
              ]}
            />
            {unavailable && model ? <p className={s.settingsNote}>{c.modelNotConnected(model.displayName)}</p> : null}
          </Popover>
          {extra}
          <div className={s.sendRow}>
            {pending ? (
              <Button size="sm" variant="secondary" icon={<Square size={12} />} onClick={onStop}>
                {c.stop}
              </Button>
            ) : (
              <IconButton label={c.send} variant="primary" disabled={!value.trim() || disabled} onClick={onSend}>
                <ArrowUp size={18} />
              </IconButton>
            )}
          </div>
        </div>
      </div>
      <div className={s.composerFoot} aria-live="polite">
        <span>{state.attachments.length ? c.sourcesSome(state.attachments.length) : c.sourcesAll(readyDocs.length)}</span>
        {model ? (
          <span>
            {model.displayName}
            {unavailable ? null : model.provider === "local" ? ` · ${c.noCharge}` : ` · ${c.estimate(estimateTokens(value))}`}
          </span>
        ) : null}
        {unavailable && model ? <Badge tone="warn">{c.modelNotConnected(model.displayName)}</Badge> : null}
      </div>
      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title={c.attachTitle} description={c.attachDescription} footer={<Button variant="primary" onClick={() => setAttachOpen(false)}>{c.done}</Button>}>
        <fieldset className={s.attachList}>
          <legend className="sr-only">{c.attachLegend}</legend>
          {readyDocs.map((d) => (
            <label key={d.id} className={s.attachItem}>
              <input
                type="checkbox"
                checked={state.attachments.includes(d.id)}
                onChange={(e) => onState({ attachments: e.target.checked ? [...state.attachments, d.id] : state.attachments.filter((x) => x !== d.id) })}
              />
              <span>{d.title}</span>
              <Badge mono>{d.kind}</Badge>
            </label>
          ))}
          {readyDocs.length === 0 ? <p>{c.attachNone}</p> : null}
        </fieldset>
      </Modal>
    </>
  );
});
