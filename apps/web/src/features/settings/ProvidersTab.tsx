"use client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Callout, Card, DescList, EmptyState, ModeBadge, QueryState, SectionHead } from "@/components/ui";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={s.yesNo} data-on={value}>
      {value ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
      {value ? c.providers.yes : c.providers.no}
    </span>
  );
}

export function ProvidersTab() {
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers });
  return (
    <section aria-labelledby="prov-h" className={s.stack}>
      <SectionHead id="prov-h" title={c.providers.heading} />
      <Callout icon={<KeyRound size={16} aria-hidden />}>{c.providers.note}</Callout>
      <QueryState query={providers} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.providers.empty} />}>
        {(list) => (
          <ul className={s.cards}>
            {list.map((p) => (
              <Card as="li" key={p.provider} className={s.providerCard}>
                <div className={s.providerHead}>
                  <h3 className={s.cardTitle}>{p.displayName}</h3>
                  <ModeBadge mode={p.mode} />
                </div>
                <p className={s.subtle}>{p.reason}</p>
                <DescList
                  items={[
                    [c.providers.credentials, <YesNo key="c" value={p.credentialsConfigured} />],
                    [c.providers.budget, <YesNo key="b" value={p.budgetAuthorized} />],
                    [c.providers.checked, p.lastCheckedAt ? formatDateTime(p.lastCheckedAt) : c.providers.neverChecked],
                  ]}
                />
              </Card>
            ))}
          </ul>
        )}
      </QueryState>
    </section>
  );
}
