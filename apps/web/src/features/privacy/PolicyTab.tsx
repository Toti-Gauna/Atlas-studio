"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type { Classification, DetectorId, PrivacyPolicy } from "@atlas/contracts";
import { DETECTOR_CATALOG } from "@atlas/domain";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { copy } from "@/copy/en";
import { privacyCopy as c } from "@/copy/privacy";
import { Badge, Button, Card, DescList, QueryState, Switch, TextField, useToast } from "@/components/ui";
import s from "./privacy.module.css";

const CLASSES: Classification[] = ["public", "internal", "confidential", "restricted"];
const RET_KEYS = ["conversations", "runTraces", "originalsAfterRedaction"] as const;
const RET_MIN = { conversations: 1, runTraces: 1, originalsAfterRedaction: 0 };
const detectorLabel = (id: string) => DETECTOR_CATALOG.find((d) => d.id === id)?.label ?? id;
const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

function Checks<T extends string>({ legend, options, value, onChange }: { legend: string; options: Array<{ value: T; label: string }>; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <fieldset className={s.fieldset}>
      <legend className={s.legend}>{legend}</legend>
      <ul className={s.checkGrid}>
        {options.map((o) => (
          <li key={o.value}>
            <label className={s.check}>
              <input type="checkbox" checked={value.includes(o.value)} onChange={(e) => onChange(toggle(value, o.value, e.target.checked))} />
              <span>{o.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function PolicyForm({ policy, onDone }: { policy: PrivacyPolicy; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<PrivacyPolicy>(policy);
  const [ret, setRet] = useState<Record<(typeof RET_KEYS)[number], string>>({
    conversations: String(policy.retentionDays.conversations),
    runTraces: String(policy.retentionDays.runTraces),
    originalsAfterRedaction: String(policy.retentionDays.originalsAfterRedaction),
  });
  const retValid = (k: (typeof RET_KEYS)[number]) => /^\d+$/.test(ret[k]) && Number(ret[k]) >= RET_MIN[k] && Number(ret[k]) <= 3650;
  const save = useMutation({
    mutationFn: () => api.privacy.updatePolicy({ ...draft, retentionDays: { conversations: Number(ret.conversations), runTraces: Number(ret.runTraces), originalsAfterRedaction: Number(ret.originalsAfterRedaction) } }),
    onSuccess: (p) => {
      qc.setQueryData(["privacy-policy"], p);
      toast({ tone: "success", title: c.policy.saved, body: c.policy.version(p.version) });
      onDone();
    },
    onError: (e) => toast({ tone: "error", title: c.policy.failed, body: (e as Error).message }),
  });
  const classOpts = CLASSES.map((x) => ({ value: x, label: c.classification[x] ?? x }));
  return (
    <form
      className={s.stack}
      onSubmit={(e) => {
        e.preventDefault();
        if (RET_KEYS.every(retValid)) save.mutate();
      }}
    >
      <Checks legend={c.policy.reviewRequired} options={classOpts} value={draft.reviewRequiredFor} onChange={(v) => setDraft({ ...draft, reviewRequiredFor: v })} />
      <Checks legend={c.policy.blockExternal} options={classOpts} value={draft.blockExternalFor} onChange={(v) => setDraft({ ...draft, blockExternalFor: v })} />
      <Switch label={c.policy.consent} description={c.policy.consentDesc} checked={draft.externalTransferRequiresConsent} onChange={(v) => setDraft({ ...draft, externalTransferRequiresConsent: v })} />
      <fieldset className={s.fieldset}>
        <legend className={s.legend}>{c.policy.retention}</legend>
        <div className={s.formRow}>
          {RET_KEYS.map((k) => (
            <TextField
              key={k}
              label={k === "conversations" ? c.policy.conversations : k === "runTraces" ? c.policy.runTraces : c.policy.originals}
              inputMode="numeric"
              value={ret[k]}
              onChange={(e) => setRet({ ...ret, [k]: e.target.value })}
              error={retValid(k) ? null : c.policy.retentionInvalid}
              hint={`${RET_MIN[k]}–3650`}
            />
          ))}
        </div>
      </fieldset>
      <Checks<DetectorId> legend={c.policy.detectors} options={DETECTOR_CATALOG.map((d) => ({ value: d.id, label: d.label }))} value={draft.enabledDetectors} onChange={(v) => setDraft({ ...draft, enabledDetectors: v })} />
      <div className={s.actions}>
        <Button type="submit" variant="primary" loading={save.isPending}>{c.policy.save}</Button>
        <Button variant="ghost" onClick={onDone}>{copy.actions.cancel}</Button>
      </div>
    </form>
  );
}

const list = (xs: string[], label: (x: string) => string) => (xs.length ? <span className={s.badges}>{xs.map((x) => <Badge key={x}>{label(x)}</Badge>)}</span> : "—");

export function PolicyTab() {
  const isAdmin = useCan("privacy.admin");
  const q = useQuery({ queryKey: ["privacy-policy"], queryFn: api.privacy.policy });
  const [editing, setEditing] = useState(false);
  return (
    <QueryState query={q}>
      {(p) => (
        <Card>
          <div className={s.reviewHead}>
            <div>
              <h2 className={s.h2}>{c.policy.version(p.version)}</h2>
              <p className={s.muted}>{c.policy.updated} {formatDateTime(p.updatedAt)}</p>
            </div>
            {isAdmin && !editing ? (
              <Button icon={<Pencil size={14} aria-hidden />} onClick={() => setEditing(true)}>{c.policy.edit}</Button>
            ) : null}
          </div>
          {editing ? (
            <PolicyForm policy={p} onDone={() => setEditing(false)} />
          ) : (
            <>
              <DescList
                items={[
                  [c.policy.reviewRequired, list(p.reviewRequiredFor, (x) => c.classification[x] ?? x)],
                  [c.policy.blockExternal, list(p.blockExternalFor, (x) => c.classification[x] ?? x)],
                  [c.policy.consent, p.externalTransferRequiresConsent ? "Required" : "Not required"],
                  [c.policy.conversations, `${p.retentionDays.conversations} days`],
                  [c.policy.runTraces, `${p.retentionDays.runTraces} days`],
                  [c.policy.originals, `${p.retentionDays.originalsAfterRedaction} days`],
                  [c.policy.detectors, list(p.enabledDetectors, detectorLabel)],
                ]}
              />
              {!isAdmin ? <p className={`${s.muted} ${s.noteTop}`}>{c.policy.adminOnly}</p> : null}
            </>
          )}
        </Card>
      )}
    </QueryState>
  );
}
