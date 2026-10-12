"use client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { ModelRegistryEntry, ProviderStatus, TokenPriceTable } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDate, tokens } from "@/lib/format";
import { Badge, Callout, EmptyState, ErrorState, LoadingBlock, ModeBadge, SectionHead, Table, numCell } from "@/components/ui";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

const m = c.models;
const PRICE_KEYS: Array<keyof TokenPriceTable> = ["inputPerMTok", "outputPerMTok", "cacheWrite5mPerMTok", "cacheWrite1hPerMTok", "cacheReadPerMTok"];
const price = (v: string | null) => (v === null ? m.unknown : `$${v}`);

function PriceCells({ model }: { model: ModelRegistryEntry }) {
  const p = model.currentPrice;
  if (!p || p.kind === "unverified") return <td colSpan={5} className={s.subtle}>{m.unverifiedPrice}</td>;
  if (p.kind === "no_provider_charge") return <td colSpan={5}>{m.noCharge}</td>;
  return (
    <>
      {PRICE_KEYS.map((k) => (
        <td key={k} className={numCell}>
          {price(p.base[k])}
        </td>
      ))}
    </>
  );
}

function Verification({ model }: { model: ModelRegistryEntry }) {
  const v = model.verification;
  return (
    <div className={s.cellStack}>
      <Badge tone={v.status === "verified" ? "teal" : "warn"}>{v.status === "verified" ? m.verified : m.pending}</Badge>
      {v.sources.map((src) => (
        <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className={s.extLink}>
          {src.label} <ExternalLink size={12} aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
      <span className={s.subtle}>{m.checkedAt(formatDate(v.checkedAt))}</span>
      {v.notes ? <span className={s.subtle}>{v.notes}</span> : null}
    </div>
  );
}

function ModelRow({ model, providerName }: { model: ModelRegistryEntry; providerName: string }) {
  return (
    <tr>
      <th scope="row">
        <span className={s.cellStack}>
          <span className={s.strong}>{model.displayName}</span>
          <span className={s.subtle}>{model.family}</span>
        </span>
      </th>
      <td className="mono">{model.modelId ?? m.notAsserted}</td>
      <td>{providerName}</td>
      <td>
        <span className={s.chips}>
          {model.capabilities.map((cap) => (
            <Badge key={cap}>{c.capabilities[cap] ?? cap}</Badge>
          ))}
        </span>
      </td>
      <td className={numCell}>{tokens(model.contextWindowTokens)}</td>
      <td className={numCell}>{tokens(model.maxOutputTokens)}</td>
      <td>
        <span className={s.cellStack}>
          <ModeBadge mode={model.availability.mode} />
          {model.availability.reason ? <span className={s.subtle}>{model.availability.reason}</span> : null}
        </span>
      </td>
      <PriceCells model={model} />
      <td className="mono">{model.currentPrice ? `v${model.currentPrice.version} · ${formatDate(model.currentPrice.effectiveFrom)}` : "—"}</td>
      <td>
        <Verification model={model} />
      </td>
    </tr>
  );
}

function PendingProviderRow({ p }: { p: ProviderStatus }) {
  return (
    <tr>
      <th scope="row">
        <span className={s.cellStack}>
          <span className={s.strong}>{p.displayName}</span>
          <span className={s.subtle}>{m.pendingProviderNote}</span>
        </span>
      </th>
      <td className="mono">{m.notAsserted}</td>
      <td>{p.displayName}</td>
      <td>—</td>
      <td className={numCell}>—</td>
      <td className={numCell}>—</td>
      <td>
        <ModeBadge mode={p.mode} />
      </td>
      <td colSpan={5} className={s.subtle}>
        {m.unverifiedPrice}
      </td>
      <td>—</td>
      <td>
        <span className={s.cellStack}>
          <Badge tone="warn">{m.pending}</Badge>
          <span className={s.subtle}>{p.reason}</span>
        </span>
      </td>
    </tr>
  );
}

export function ModelsTab() {
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers });
  if (models.isPending) return <LoadingBlock rows={5} />;
  if (models.isError) return <ErrorState error={models.error} onRetry={() => void models.refetch()} />;
  const list = models.data;
  const provName = (id: string) => providers.data?.find((p) => p.provider === id)?.displayName ?? id;
  const pendingProviders = (providers.data ?? []).filter((p) => p.mode === "pending" && !list.some((x) => x.provider === p.provider));
  const tiered = list.filter((x) => x.currentPrice && x.currentPrice.tiers.length > 0);
  const regVersion = list[0]?.registryVersion;

  return (
    <section aria-labelledby="models-h" className={s.stack}>
      <SectionHead id="models-h" title={m.heading} aside={regVersion ? <Badge mono>{m.registryVersion(regVersion)}</Badge> : null} />
      <p className={s.subtle}>{m.intro}</p>
      {list.length === 0 && pendingProviders.length === 0 ? (
        <EmptyState title={m.empty} />
      ) : (
        <Table caption={m.caption} className={s.wideTable}>
          <thead>
            <tr>
              <th scope="col">{m.model}</th>
              <th scope="col">{m.modelId}</th>
              <th scope="col">{m.provider}</th>
              <th scope="col">{m.capabilities}</th>
              <th scope="col" className={numCell}>{m.context}</th>
              <th scope="col" className={numCell}>{m.maxOutput}</th>
              <th scope="col">{m.availability}</th>
              <th scope="col" className={numCell}>{m.input}</th>
              <th scope="col" className={numCell}>{m.output}</th>
              <th scope="col" className={numCell}>{m.write5m}</th>
              <th scope="col" className={numCell}>{m.write1h}</th>
              <th scope="col" className={numCell}>{m.cacheRead}</th>
              <th scope="col">{m.priceVersion}</th>
              <th scope="col">{m.verification}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <ModelRow key={x.key} model={x} providerName={provName(x.provider)} />
            ))}
            {pendingProviders.map((p) => (
              <PendingProviderRow key={p.provider} p={p} />
            ))}
          </tbody>
        </Table>
      )}
      {providers.isError ? <ErrorState compact error={providers.error} onRetry={() => void providers.refetch()} /> : null}
      {tiered.length ? (
        <Callout>
          <strong>{m.tiers}.</strong>
          {tiered.map((x) => (
            <div key={x.key} style={{ marginTop: 6 }}>
              <span className={s.strong}>{x.displayName}</span>
              {x.currentPrice!.tiers.map((t) => (
                <div key={t.promptTokensAbove}>
                  {m.tierRow(t.promptTokensAbove.toLocaleString("en-US"))} input {price(t.prices.inputPerMTok)}, output {price(t.prices.outputPerMTok)}, cache write 5m {price(t.prices.cacheWrite5mPerMTok)}, 1h {price(t.prices.cacheWrite1hPerMTok)}, cache read {price(t.prices.cacheReadPerMTok)} per MTok.
                </div>
              ))}
            </div>
          ))}
        </Callout>
      ) : null}
    </section>
  );
}
