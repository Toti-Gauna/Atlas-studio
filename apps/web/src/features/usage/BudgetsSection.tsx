"use client";
import { useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type { Budget } from "@atlas/contracts";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { copy } from "@/copy/en";
import { usageCopy as c } from "@/copy/usage";
import { Badge, Button, EmptyState, Meter, Modal, QueryState, SectionHead, Switch, TextField, useToast, type Tone } from "@/components/ui";
import { nanoToMilli, nanoToUsdInput, usdToNano } from "./nano";
import s from "./usage.module.css";

type BudgetState = keyof typeof c.budgets.state;

/** Spent + reserved against the limit, as a whole percentage and a state. */
export function budgetStatus(b: Budget): { pct: number; state: BudgetState } {
  const limit = BigInt(b.limitNanoUsd);
  const used = BigInt(b.spentNanoUsd) + BigInt(b.reservedNanoUsd);
  const pct = limit > 0n ? Number((used * 100n) / limit) : 0;
  const state: BudgetState = pct >= 100 ? (b.hardStop ? "blocked" : "over") : pct >= b.alertThresholdPct ? "near" : "ok";
  return { pct, state };
}

const STATE_TONE: Record<BudgetState, Tone> = { ok: "teal", near: "warn", blocked: "danger", over: "danger" };

function BudgetEditModal({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [limit, setLimit] = useState(nanoToUsdInput(budget.limitNanoUsd));
  const [alert, setAlert] = useState(String(budget.alertThresholdPct));
  const [hardStop, setHardStop] = useState(budget.hardStop);
  const [touched, setTouched] = useState(false);
  const limitNano = usdToNano(limit);
  const alertNum = Number(alert);
  const alertOk = /^\d+$/.test(alert) && alertNum >= 1 && alertNum <= 100;
  const save = useMutation({
    mutationFn: () => api.budgets.upsert(budget.id, { limitNanoUsd: limitNano!, alertThresholdPct: alertNum, hardStop }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["budgets"] });
      toast({ tone: "success", title: c.budgets.saved, body: budget.scopeLabel });
      onClose();
    },
    onError: (e) => toast({ tone: "error", title: c.budgets.saveFailed, body: (e as Error).message }),
  });
  const submit = () => {
    setTouched(true);
    if (limitNano && alertOk) save.mutate();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={c.budgets.editTitle(budget.scopeLabel)}
      description={c.budgets.editDesc}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{copy.actions.cancel}</Button>
          <Button variant="primary" onClick={submit} loading={save.isPending}>{copy.actions.save}</Button>
        </>
      }
    >
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField label={c.budgets.limitField} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} hint={c.budgets.limitHint} error={touched && !limitNano ? c.budgets.limitInvalid : null} />
        <TextField label={c.budgets.alertField} inputMode="numeric" value={alert} onChange={(e) => setAlert(e.target.value)} error={touched && !alertOk ? c.budgets.alertInvalid : null} />
        <Switch label={c.budgets.hardStopField} description={c.budgets.hardStopDesc} checked={hardStop} onChange={setHardStop} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function BudgetRow({ b, canEdit, onEdit }: { b: Budget; canEdit: boolean; onEdit: () => void }) {
  const { pct, state } = budgetStatus(b);
  const reserved = BigInt(b.reservedNanoUsd) > 0n;
  return (
    <li className={s.budget}>
      <div className={s.budgetHead}>
        <div className={s.budgetName}>
          <h3 className={s.budgetTitle}>{b.scopeLabel}</h3>
          <span className={s.muted}>
            {c.budgets.scope[b.scope]} · {c.budgets.period[b.period]}
          </span>
        </div>
        <Badge tone={STATE_TONE[state]} dot>
          {c.budgets.state[state]}
        </Badge>
      </div>
      <p className={s.budgetAmount}>
        {c.budgets.of(money(b.spentNanoUsd), money(b.limitNanoUsd))} <span className={s.muted}>· {c.budgets.pct(pct)}</span>
      </p>
      <Meter value={nanoToMilli(b.spentNanoUsd)} reserved={nanoToMilli(b.reservedNanoUsd)} max={nanoToMilli(b.limitNanoUsd)} label={c.budgets.meterLabel(b.scopeLabel)} />
      <p className={s.muted}>
        {c.budgets.alertAt(b.alertThresholdPct)} · {b.hardStop ? c.budgets.hardStopOn : c.budgets.hardStopOff}
        {reserved ? ` · ${c.budgets.reserved(money(b.reservedNanoUsd))}` : ""}
      </p>
      {b.unknownCostEntries ? <p className={s.warnNote}>{c.budgets.unknown(b.unknownCostEntries)}</p> : null}
      {canEdit ? (
        <div>
          <Button size="sm" variant="ghost" icon={<Pencil size={14} aria-hidden />} onClick={onEdit}>
            {c.budgets.edit}
            <span className="sr-only"> {b.scopeLabel}</span>
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** Budget strip: spent vs limit and state for every budget. Budgets ignore the page filters. */
export function BudgetsSection({ query }: { query: UseQueryResult<Budget[]> }) {
  const canEdit = useCan("budget.admin");
  const [editing, setEditing] = useState<Budget | null>(null);
  return (
    <section aria-labelledby="budgets-h">
      <SectionHead id="budgets-h" title={c.budgets.title} aside={c.filters.notAffected} />
      <QueryState query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.budgets.empty} />}>
        {(list) => (
          <ul className={s.budgets}>
            {[...list]
              .sort((a, b) => Number(b.scope === "workspace") - Number(a.scope === "workspace") || budgetStatus(b).pct - budgetStatus(a).pct)
              .map((b) => (
                <BudgetRow key={b.id} b={b} canEdit={canEdit} onEdit={() => setEditing(b)} />
              ))}
          </ul>
        )}
      </QueryState>
      {editing ? <BudgetEditModal budget={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
