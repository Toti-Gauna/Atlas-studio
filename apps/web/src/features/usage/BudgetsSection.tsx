"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type { Budget } from "@atlas/contracts";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { copy } from "@/copy/en";
import { usageCopy as c } from "@/copy/usage";
import { Badge, Button, Card, EmptyState, Meter, Modal, QueryState, SectionHead, Switch, TextField, useToast } from "@/components/ui";
import { nanoToMilli, nanoToUsdInput, usdToNano } from "./nano";
import s from "./usage.module.css";

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

function BudgetCard({ b, canEdit, onEdit }: { b: Budget; canEdit: boolean; onEdit: () => void }) {
  return (
    <Card as="li" className={s.budget}>
      <div className={s.cardHead}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{c.budgets.scope[b.scope]} · {c.budgets.period[b.period]}</div>
          <h3 className={s.budgetTitle}>{b.scopeLabel}</h3>
        </div>
        {canEdit ? (
          <Button size="sm" variant="ghost" icon={<Pencil size={14} aria-hidden />} onClick={onEdit} aria-label={`${c.budgets.edit} ${b.scopeLabel}`}>
            {c.budgets.edit}
          </Button>
        ) : null}
      </div>
      <p className="tabular" style={{ fontWeight: 600 }}>
        {money(b.spentNanoUsd)} <span className={s.muted}>/ {money(b.limitNanoUsd)}</span>
      </p>
      <Meter value={nanoToMilli(b.spentNanoUsd)} reserved={nanoToMilli(b.reservedNanoUsd)} max={nanoToMilli(b.limitNanoUsd)} label={c.budgets.meterLabel(b.scopeLabel)} />
      <dl className={s.budgetMeta}>
        <div><dt>{c.budgets.spent}</dt><dd>{money(b.spentNanoUsd)}</dd></div>
        <div><dt>{c.budgets.reserved}</dt><dd>{money(b.reservedNanoUsd)}</dd></div>
        <div><dt>{c.budgets.alert}</dt><dd>{b.alertThresholdPct}%</dd></div>
      </dl>
      <div className={s.badges}>
        <Badge tone={b.hardStop ? "info" : "neutral"} title={b.hardStop ? c.budgets.hardStopOn : c.budgets.hardStopOff}>
          {c.budgets.hardStop}: {b.hardStop ? "on" : "off"}
        </Badge>
        {b.unknownCostEntries ? <Badge tone="warn">{c.budgets.unknown(b.unknownCostEntries)}</Badge> : null}
      </div>
    </Card>
  );
}

export function BudgetsSection() {
  const canEdit = useCan("budget.admin");
  const q = useQuery({ queryKey: ["budgets"], queryFn: api.budgets.list });
  const [editing, setEditing] = useState<Budget | null>(null);
  return (
    <section aria-labelledby="budgets-h" className={s.section}>
      <SectionHead id="budgets-h" title={c.budgets.title} />
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.budgets.empty} />}>
        {(list) => (
          <ul className={s.budgets}>
            {list.map((b) => (
              <BudgetCard key={b.id} b={b} canEdit={canEdit} onEdit={() => setEditing(b)} />
            ))}
          </ul>
        )}
      </QueryState>
      {editing ? <BudgetEditModal budget={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
