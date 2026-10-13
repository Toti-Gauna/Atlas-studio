"use client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { ModelRegistryEntry, ProviderStatus, TokenPriceTable } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDate, tokens } from "@/lib/format";
import { Badge, Card, DescList, EmptyState, ErrorState, LoadingBlock, ModeBadge, SectionHead, TechDetails } from "@/components/ui";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

const m = c.models;
const price = (v: string | null) => (v === null ? m.unknown : `$${v}`);
const tok = (n: number | null) => (n === null ? m.unknown : m.tokensValue(tokens(n)));

function PriceLine({ model }: { model: ModelRegistryEntry }) {
  const p = model.currentPrice;
  if (!p || p.kind === "unverified") return <p className={s.subtle}>{m.unverifiedPrice}</p>;
  if (p.kind === "no_provider_charge") return <p className={s.priceLine}>{m.noCharge}</p>;
  return (
    <p className={s.priceLine}>
      {m.priceInOut(price(p.base.inputPerMTok), price(p.base.outputPerMTok))} <span className={s.subtle}>{m.perMTok}</span>
    </p>
  );
}

function DetailedPrices({ model }: { model: ModelRegistryEntry }) {
  const p = model.currentPrice;
  if (!p || p.kind !== "provider_charge") return null;
  const rows: Array<[keyof TokenPriceTable, string]> = [
    ["inputPerMTok", m.input],
    ["outputPerMTok", m.output],
    ["cacheWrite5mPerMTok", m.write5m],
    ["cacheWrite1hPerMTok", m.write1h],
    ["cacheReadPerMTok", m.cacheRead],
  ];
  return (
    <details className={s.disclosure}>
      <summary>{m.detailed}</summary>
      <div className={s.disclosureBody}>
        <DescList items={rows.map(([k, label]) => [label, price(p.base[k])])} />
        {p.tiers.map((t) => (
          <p key={t.promptTokensAbove} className={s.subtle}>
            {m.tierRow(t.promptTokensAbove.toLocaleString("en-US"))}{" "}
            {m.tierPrices(price(t.prices.inputPerMTok), price(t.prices.outputPerMTok), price(t.prices.cacheWrite5mPerMTok), price(t.prices.cacheWrite1hPerMTok), price(t.prices.cacheReadPerMTok))}
          </p>
        ))}
        <p className={s.subtle}>{m.priceVersion(p.version, formatDate(p.effectiveFrom))}</p>
      </div>
    </details>
  );
}

function Verification({ model }: { model: ModelRegistryEntry }) {
  const v = model.verification;
  return (
    <div className={s.verify}>
      <Badge tone={v.status === "verified" ? "teal" : "warn"}>{v.status === "verified" ? m.verified : m.pending}</Badge>
      <span className={s.subtle}>{m.checkedAt(formatDate(v.checkedAt))}</span>
      {v.sources.map((src) => (
        <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className={s.extLink}>
          {src.label} <ExternalLink size={12} aria-hidden />
          <span className="sr-only">{m.opensNewTab}</span>
        </a>
      ))}
      {v.notes ? <span className={s.subtle}>{v.notes}</span> : null}
    </div>
  );
}

function ModelCard({ model, providerName }: { model: ModelRegistryEntry; providerName: string }) {
  return (
    <Card as="li" className={s.modelCard}>
      <div className={s.providerHead}>
        <div>
          <h3 className={s.cardTitle}>{model.displayName}</h3>
          <p className={s.subtle}>
            {providerName} · {model.family}
          </p>
        </div>
        <ModeBadge mode={model.availability.mode} />
      </div>
      {model.availability.reason ? <p className={s.subtle}>{model.availability.reason}</p> : null}
      <PriceLine model={model} />
      <DescList
        items={[
          [m.capabilities, model.capabilities.map((cap) => c.capabilities[cap] ?? cap).join(" · ") || "—"],
          [m.context, tok(model.contextWindowTokens)],
          [m.maxOutput, tok(model.maxOutputTokens)],
        ]}
      />
      <Verification model={model} />
      <DetailedPrices model={model} />
      <TechDetails>
        Model ID <span className="mono">{model.modelId ?? m.notAsserted}</span> · registry key <span className="mono">{model.key}</span>
        {model.currentPrice ? (
          <>
            {" "}· price version id <span className="mono">{model.currentPrice.id}</span>
          </>
        ) : null}
      </TechDetails>
    </Card>
  );
}

function PendingProviderCard({ p }: { p: ProviderStatus }) {
  return (
    <Card as="li" className={s.modelCard}>
      <div className={s.providerHead}>
        <div>
          <h3 className={s.cardTitle}>{p.displayName}</h3>
          <p className={s.subtle}>{m.notAsserted}</p>
        </div>
        <ModeBadge mode={p.mode} />
      </div>
      <p className={s.subtle}>{m.pendingProviderNote}</p>
      <p className={s.subtle}>{m.unverifiedPrice}</p>
      <div className={s.verify}>
        <Badge tone="warn">{m.pending}</Badge>
        <span className={s.subtle}>{p.reason}</span>
      </div>
    </Card>
  );
}

/** Model registry as cards: name, availability and input/output price first; the rest on demand. */
export function ModelsTab() {
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers });
  if (models.isPending) return <LoadingBlock rows={5} />;
  if (models.isError) return <ErrorState error={models.error} onRetry={() => void models.refetch()} />;
  const list = models.data;
  const provName = (id: string) => providers.data?.find((p) => p.provider === id)?.displayName ?? id;
  const pendingProviders = (providers.data ?? []).filter((p) => p.mode === "pending" && !list.some((x) => x.provider === p.provider));
  const regVersion = list[0]?.registryVersion;

  return (
    <section aria-labelledby="models-h" className={s.stack}>
      <SectionHead id="models-h" title={m.heading} aside={regVersion ? m.registryVersion(regVersion) : null} />
      <p className={s.subtle}>{m.intro}</p>
      {list.length === 0 && pendingProviders.length === 0 ? (
        <EmptyState title={m.empty} />
      ) : (
        <ul className={s.cards} aria-label={m.listLabel}>
          {list.map((x) => (
            <ModelCard key={x.key} model={x} providerName={provName(x.provider)} />
          ))}
          {pendingProviders.map((p) => (
            <PendingProviderCard key={p.provider} p={p} />
          ))}
        </ul>
      )}
      {providers.isError ? <ErrorState compact error={providers.error} onRetry={() => void providers.refetch()} /> : null}
    </section>
  );
}
