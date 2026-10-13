"use client";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { CloudOff, FileQuestion, Lock, PlugZap, RefreshCw, ServerCrash } from "lucide-react";
import { copy } from "@/copy/en";
import { isApiError } from "@/lib/api";
import { Button } from "./controls";
import s from "./states.module.css";

/** Static placeholders that mirror the final layout while a real request is pending (no fake progress). */
export function Skeleton({ lines = 3, height = 14, block }: { lines?: number; height?: number; block?: number }) {
  if (block) return <div className={s.skel} style={{ height: block }} aria-hidden />;
  return (
    <div className={s.skelStack} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={s.skel} style={{ height, width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

/** Loading placeholder shaped like what is coming: list rows, a card grid or a table. */
export function LoadingBlock({ label = copy.states.loadingLabel, rows = 3, variant = "rows" }: { label?: string; rows?: number; variant?: "rows" | "cards" | "table" }) {
  return (
    <div role="status" aria-live="polite" className={variant === "cards" ? s.loadingCards : s.loading}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) =>
        variant === "cards" ? (
          <div key={i} className={s.loadingCard}>
            <Skeleton lines={3} />
          </div>
        ) : variant === "table" ? (
          <div key={i} className={s.loadingTableRow}>
            <Skeleton block={12} />
            <Skeleton block={12} />
            <Skeleton block={12} />
          </div>
        ) : (
          <div key={i} className={s.loadingRow}>
            <Skeleton block={44} />
          </div>
        ),
      )}
    </div>
  );
}

export function StatePanel({ icon, title, body, action, tone = "neutral", compact }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode; tone?: "neutral" | "danger" | "warn"; compact?: boolean }) {
  return (
    <div className={`${s.panel} ${compact ? s.compact : ""} ${tone === "danger" ? s.danger : tone === "warn" ? s.warn : ""}`} role={tone === "danger" ? "alert" : undefined}>
      <div className={s.icon} aria-hidden>
        {icon}
      </div>
      <h3 className={s.title}>{title}</h3>
      {body ? <div className={s.body}>{body}</div> : null}
      {action ? <div className={s.action}>{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title = copy.states.emptyTitle, body, action, icon }: { title?: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return <StatePanel icon={icon ?? <FileQuestion size={22} />} title={title} body={body} action={action} />;
}

export function ErrorState({ error, onRetry, compact, title }: { error: unknown; onRetry?: () => void; compact?: boolean; title?: string }) {
  const e = isApiError(error) ? error : null;
  if (e?.code === "FORBIDDEN" || e?.code === "TOOL_NOT_ALLOWED") return <StatePanel compact={compact} tone="warn" icon={<Lock size={22} />} title={copy.states.forbiddenTitle} body={e.message || copy.states.forbiddenBody} />;
  if (e?.code === "NETWORK") return <StatePanel compact={compact} tone="warn" icon={<CloudOff size={22} />} title={copy.states.offlineTitle} body={copy.states.offlineBody} action={onRetry ? <Button icon={<RefreshCw size={14} />} onClick={onRetry}>{copy.states.retry}</Button> : null} />;
  if (e?.code === "PROVIDER_DISCONNECTED") return <StatePanel compact={compact} tone="warn" icon={<PlugZap size={22} />} title={copy.states.providerTitle} body={e.message || copy.states.providerBody} />;
  return (
    <StatePanel
      compact={compact}
      tone="danger"
      icon={<ServerCrash size={22} />}
      title={title ?? copy.states.errorTitle}
      body={
        <>
          {copy.states.errorBody}
          {e?.requestId || e?.message ? (
            <details className={s.details}>
              <summary>Details for support</summary>
              {e?.message ? <div>{e.message}</div> : null}
              {e?.requestId ? <div className="mono">Request {e.requestId}</div> : null}
            </details>
          ) : null}
        </>
      }
      action={onRetry ? <Button icon={<RefreshCw size={14} />} onClick={onRetry}>{copy.states.retry}</Button> : null}
    />
  );
}

/**
 * Renders loading / error (incl. forbidden, offline, provider) / empty / success
 * for a query. Every screen uses this so states are consistent.
 */
export function QueryState<T>({ query, isEmpty, empty, loading, children }: { query: UseQueryResult<T>; isEmpty?: (d: T) => boolean; empty?: ReactNode; loading?: ReactNode; children: (data: T) => ReactNode }) {
  if (query.isPending) return <>{loading ?? <LoadingBlock />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data as T;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState />}</>;
  return <>{children(data)}</>;
}
