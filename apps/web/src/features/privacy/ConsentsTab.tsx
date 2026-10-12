"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExternalTransferConsent } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { privacyCopy as c } from "@/copy/privacy";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, QueryState, Select, Table, useToast } from "@/components/ui";
import s from "./privacy.module.css";

type Scope = ExternalTransferConsent["scope"];

function consentState(x: ExternalTransferConsent): "revoked" | "expired" | "active" {
  if (x.revokedAt) return "revoked";
  return Date.parse(x.expiresAt) < Date.now() ? "expired" : "active";
}

function GrantForm() {
  const qc = useQueryClient();
  const toast = useToast();
  const docs = useQuery({ queryKey: ["documents", null], queryFn: () => api.documents.list() });
  const [provider, setProvider] = useState("anthropic");
  const [scope, setScope] = useState<Scope>("single_run");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const grant = useMutation({
    mutationFn: () => api.privacy.grantConsent({ provider, documentIds: picked, scope }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-consents"] });
      toast({ tone: "success", title: c.consents.granted, body: c.consents.providers[provider] });
      setPicked([]);
    },
    onError: (e) => toast({ tone: "error", title: c.consents.failed, body: (e as Error).message }),
  });
  return (
    <Card>
      <h2 className={s.h2}>{c.consents.grantTitle}</h2>
      <p className={s.muted} style={{ marginBottom: 12 }}>{c.consents.grantBody}</p>
      <form
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          if (!picked.length) return setError(c.consents.pickDocs);
          setError(null);
          grant.mutate();
        }}
      >
        <div className={s.formRow}>
          <Select label={c.consents.provider} value={provider} onChange={(e) => setProvider(e.target.value)} options={Object.entries(c.consents.providers).map(([value, label]) => ({ value, label }))} />
          <Select label={c.consents.scope} value={scope} onChange={(e) => setScope(e.target.value as Scope)} options={Object.entries(c.consents.scopes).map(([value, label]) => ({ value, label }))} />
        </div>
        <fieldset className={s.fieldset} aria-describedby={error ? "consent-docs-err" : undefined}>
          <legend className={s.legend}>{c.consents.documents}</legend>
          {docs.isPending ? (
            <LoadingBlock rows={2} />
          ) : docs.isError ? (
            <ErrorState error={docs.error} compact onRetry={() => void docs.refetch()} />
          ) : (
            <ul className={s.checkList}>
              {docs.data.map((d) => (
                <li key={d.id}>
                  <label className={s.check}>
                    <input type="checkbox" checked={picked.includes(d.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))} />
                    <span>{d.title}</span>
                    <Badge tone={d.classification === "restricted" || d.classification === "confidential" ? "warn" : "neutral"}>{c.classification[d.classification]}</Badge>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {error ? <p id="consent-docs-err" role="alert" className={s.error}>{error}</p> : null}
        </fieldset>
        <div>
          <Button type="submit" variant="primary" loading={grant.isPending}>{c.consents.grant}</Button>
        </div>
      </form>
    </Card>
  );
}

export function ConsentsTab() {
  const isAdmin = useCan("privacy.admin");
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["privacy-consents"], queryFn: api.privacy.consents });
  const docs = useQuery({ queryKey: ["documents", null], queryFn: () => api.documents.list() });
  const title = (id: string) => docs.data?.find((d) => d.id === id)?.title ?? id;
  const revoke = useMutation({
    mutationFn: (id: string) => api.privacy.revokeConsent(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-consents"] });
      toast({ tone: "success", title: c.consents.revokedToast });
    },
    onError: (e) => toast({ tone: "error", title: c.consents.failed, body: (e as Error).message }),
  });

  return (
    <div className={s.stack}>
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.consents.empty} body={c.consents.emptyBody} />}>
        {(list) => (
          <Table caption={c.consents.caption}>
            <thead>
              <tr>
                <th scope="col">{c.consents.provider}</th>
                <th scope="col">{c.consents.documents}</th>
                <th scope="col">{c.consents.scope}</th>
                <th scope="col">{c.consents.grantedBy}</th>
                <th scope="col">{c.consents.expires}</th>
                <th scope="col">{c.consents.status}</th>
                {isAdmin ? <th scope="col"><span className="sr-only">{c.consents.revoke}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((x) => {
                const st = consentState(x);
                const name = c.consents.providers[x.provider] ?? x.provider;
                return (
                  <tr key={x.id}>
                    <td style={{ fontWeight: 600 }}>{name}</td>
                    <td>{x.documentIds.map(title).join(", ") || "—"}</td>
                    <td>{c.consents.scopes[x.scope] ?? x.scope}</td>
                    <td>{x.grantedByName}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(x.expiresAt)}</td>
                    <td>
                      <Badge tone={st === "active" ? "teal" : "neutral"}>{c.consents[st]}</Badge>
                      {x.revokedAt ? <div className={s.muted}>{formatDateTime(x.revokedAt)}</div> : null}
                    </td>
                    {isAdmin ? (
                      <td>
                        {st === "active" ? (
                          <Button size="sm" variant="danger" aria-label={c.consents.revokeLabel(name)} loading={revoke.isPending && revoke.variables === x.id} onClick={() => revoke.mutate(x.id)}>
                            {c.consents.revoke}
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </QueryState>
      {isAdmin ? <GrantForm /> : <p className={s.muted}>{c.consents.adminOnly}</p>}
    </div>
  );
}
