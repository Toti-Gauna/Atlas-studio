"use client";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, Lock } from "lucide-react";
import { api, isApiError } from "@/lib/api";
import { useCan, useSession } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { EmptyState, ErrorState, LinkButton, LoadingBlock, StatePanel } from "@/components/ui";
import { copy } from "@/copy/en";
import { agentsCopy as c } from "@/copy/agents";
import { AgentForm } from "./AgentForm";
import { BackLink } from "./BackLink";
import { DEFAULT_CONFIG, makeDraft } from "./draft";

function NotFound() {
  return (
    <EmptyState
      icon={<Bot size={22} />}
      title={c.editor.notFound}
      body={c.editor.notFoundBody}
      action={
        <LinkButton href="/app/agents/" icon={<ArrowLeft size={14} aria-hidden />}>
          {c.editor.back}
        </LinkButton>
      }
    />
  );
}

function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  if (isApiError(error) && error.code === "NOT_FOUND") return <NotFound />;
  return <ErrorState error={error} onRetry={retry} />;
}

/** Routes /app/agent/?id=… (edit/view) and ?new=1[&from=…] (create or duplicate). */
export function AgentEditor() {
  const params = useSearchParams();
  const id = params.get("id");
  const isNew = params.get("new") === "1" || !id;
  const from = params.get("from");
  const canWrite = useCan("agent.write");
  const session = useSession();
  const sourceId = isNew ? from : id;
  const detail = useQuery({ queryKey: ["agent", sourceId], queryFn: () => api.agents.get(sourceId!), enabled: Boolean(sourceId) });

  if (session.isPending) return <Page><LoadingBlock rows={4} /></Page>;

  if (isNew) {
    if (!canWrite) {
      return (
        <Page>
          <StatePanel tone="warn" icon={<Lock size={22} />} title={copy.states.forbiddenTitle} body={c.editor.readOnlyRole} action={<BackLink />} />
        </Page>
      );
    }
    if (from) {
      if (detail.isPending) return <Page><LoadingBlock rows={4} /></Page>;
      if (detail.isError) return <Page><LoadError error={detail.error} retry={() => void detail.refetch()} /></Page>;
      const src = detail.data;
      return <AgentForm key={`dup:${src.id}`} agent={null} initial={makeDraft(c.editor.copyOf(src.name), src.current.config)} readOnly={null} profile="custom" duplicatedFrom={src.name} />;
    }
    return <AgentForm key="new" agent={null} initial={makeDraft("", DEFAULT_CONFIG)} readOnly={null} profile="custom" duplicatedFrom={null} />;
  }

  if (detail.isPending) return <Page><LoadingBlock rows={4} /></Page>;
  if (detail.isError) return <Page><LoadError error={detail.error} retry={() => void detail.refetch()} /></Page>;
  const a = detail.data;
  const readOnly = a.builtIn ? c.editor.readOnlyBuiltIn : !canWrite ? c.editor.readOnlyRole : null;
  return <AgentForm key={`${a.id}:${a.currentVersion}`} agent={a} initial={makeDraft(a.name, a.current.config)} readOnly={readOnly} profile={a.profile} duplicatedFrom={null} />;
}
