"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Copy, Lock, MessageSquarePlus, ShieldCheck } from "lucide-react";
import type { AgentDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { modelName } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { AgentGlyph, Badge, Button, Callout, Card, ErrorState, LinkButton, PageHeader, Skeleton, TabPanel, Tabs, TechDetails } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import { PlanPreview } from "@/features/workflows/PlanPreview";
import { VersionsPanel } from "./VersionsPanel";
import s from "./agents.module.css";

type Tab = "overview" | "versions";

/** Example plan for the saved version, computed by the server (nothing runs). */
function ExamplePlan({ agent }: { agent: AgentDetail }) {
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const pid = projects.data?.[0]?.id ?? null;
  const objective = agent.current.config.objective || c.summary.exampleObjective;
  const plan = useQuery({
    queryKey: ["agent-plan", agent.id, agent.currentVersion, pid, objective],
    queryFn: () => api.agents.plan(agent.id, { objective, projectId: pid!, pinnedModelKey: null }),
    enabled: Boolean(pid),
  });
  return (
    <Card className={s.section} aria-labelledby="sum-plan-h">
      <h2 id="sum-plan-h" className={s.sectionTitle}>
        {c.summary.examplePlan}
      </h2>
      {projects.isSuccess && !pid ? (
        <p className={s.hint}>{c.summary.noProjects}</p>
      ) : (
        <>
          <p className={s.hint}>{c.summary.exampleFor(objective)}</p>
          {plan.isError ? <ErrorState compact error={plan.error} onRetry={() => void plan.refetch()} /> : plan.data ? <PlanPreview plan={plan.data} /> : <Skeleton lines={5} />}
        </>
      )}
    </Card>
  );
}

function Overview({ agent }: { agent: AgentDetail }) {
  const cfg = agent.current.config;
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const model = models.data?.find((m) => m.key === cfg.modelKey);
  const allowed = (tools.data ?? []).filter((t) => cfg.allowedTools.includes(t.id));
  return (
    <div className={s.summaryGrid}>
      <div className={s.mainCol}>
        <Card className={s.section} aria-labelledby="sum-what-h">
          <h2 id="sum-what-h" className={s.sectionTitle}>
            {c.summary.whatItDoes}
          </h2>
          {cfg.description ? <p className={s.prose}>{cfg.description}</p> : null}
          <dl className={s.summaryList}>
            {cfg.objective ? (
              <div>
                <dt>{c.summary.objective}</dt>
                <dd>{cfg.objective}</dd>
              </div>
            ) : null}
            <div>
              <dt>{c.summary.output}</dt>
              <dd>{c.outputFormat[cfg.outputFormat]}</dd>
            </div>
          </dl>
          <details className={s.inlineDetails}>
            <summary>{c.summary.instructions}</summary>
            <p className={s.prose}>{cfg.instructions}</p>
          </details>
        </Card>

        <Card className={s.section} aria-labelledby="sum-src-h">
          <h2 id="sum-src-h" className={s.sectionTitle}>
            {c.summary.sources}
          </h2>
          <p className={s.prose}>{cfg.sourceScope.mode === "selected_documents" ? c.summary.sourcesSelected(cfg.sourceScope.documentIds.length) : c.summary.sourcesAll}</p>
        </Card>

        <Card className={s.section} aria-labelledby="sum-tools-h">
          <h2 id="sum-tools-h" className={s.sectionTitle}>
            {c.summary.tools}
          </h2>
          {tools.isPending ? (
            <Skeleton lines={3} />
          ) : tools.isError ? (
            <ErrorState compact error={tools.error} onRetry={() => void tools.refetch()} />
          ) : allowed.length === 0 ? (
            <p className={s.hint}>{c.summary.noTools}</p>
          ) : (
            <ul className={s.toolList}>
              {allowed.map((t) => (
                <li key={t.id}>
                  <span className={s.checkTitle}>
                    {t.name}
                    {t.effect === "requires_confirmation" ? (
                      <>
                        {" "}
                        <Badge tone="warn">{c.fields.needsConfirmation}</Badge>
                      </>
                    ) : null}
                  </span>
                  <span className={s.checkMeta}>{t.description}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={s.section} aria-labelledby="sum-model-h">
          <h2 id="sum-model-h" className={s.sectionTitle}>
            {c.summary.model}
          </h2>
          <p className={s.prose}>
            {model?.displayName ?? modelName(cfg.modelKey)}
            {model?.availability.mode === "pending" ? (
              <>
                {" "}
                <Badge tone="warn">{c.fields.pendingModel}</Badge>
              </>
            ) : null}
          </p>
          {model?.availability.reason ? <p className={s.hint}>{model.availability.reason}</p> : null}
        </Card>

        <Card className={s.section} aria-labelledby="sum-guard-h">
          <h2 id="sum-guard-h" className={s.sectionTitle}>
            {c.summary.guardrails}
          </h2>
          <ul className={s.guardList}>
            <li>
              <ShieldCheck size={14} aria-hidden />
              <span>{c.gallery.whatIs}</span>
            </li>
            {agent.guardrails.map((g) => (
              <li key={g}>
                <ShieldCheck size={14} aria-hidden />
                <span>{g}</span>
              </li>
            ))}
          </ul>
          <TechDetails>
            <p>
              Agent <span className="mono">{agent.id}</span> · version {agent.currentVersion} · model key <span className="mono">{cfg.modelKey}</span>
              {model?.modelId ? (
                <>
                  {" "}· model ID <span className="mono">{model.modelId}</span>
                </>
              ) : null}
            </p>
            <p>
              Tools: <span className="mono">{cfg.allowedTools.join(", ") || "none"}</span>
            </p>
          </TechDetails>
        </Card>
      </div>
      <aside className={s.sideCol}>
        <ExamplePlan agent={agent} />
      </aside>
    </div>
  );
}

/**
 * Read-only agent page (built-in agents, or roles that can't edit): what it does,
 * which sources and tools it uses in plain words, and an example plan —
 * with "Use in chat" and "Duplicate" instead of a disabled form.
 */
export function AgentSummaryView({ agent }: { agent: AgentDetail }) {
  const router = useRouter();
  const canWrite = useCan("agent.write");
  const canChat = useCan("conversation.use");
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <Page wide>
      <PageHeader
        back={{ href: "/app/agents/", label: c.editor.back }}
        title={
          <span className={s.titleRow}>
            <AgentGlyph profile={agent.profile} size={36} teal={!agent.builtIn} />
            {agent.name}
          </span>
        }
        description={agent.description || undefined}
        actions={
          <>
            {canWrite ? (
              <Button icon={<Copy size={14} aria-hidden />} onClick={() => router.push(`/app/agent/?new=1&from=${agent.id}`)}>
                {c.editor.duplicate}
              </Button>
            ) : null}
            {canChat ? (
              <LinkButton variant="primary" href={`/app/chat/?new=1&agent=${agent.id}`} icon={<MessageSquarePlus size={14} aria-hidden />}>
                {c.gallery.useInChat}
              </LinkButton>
            ) : null}
          </>
        }
      />
      <div className={s.calloutGap}>
        <Callout icon={<Lock size={16} aria-hidden />}>{agent.builtIn ? c.summary.builtIn : c.editor.readOnlyRole}</Callout>
      </div>
      <Tabs
        idPrefix="agent"
        label={agent.name}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: c.editor.tabOverview },
          { id: "versions", label: c.editor.tabVersions, count: agent.versions.length },
        ]}
      />
      <TabPanel idPrefix="agent" id={tab}>
        <div className={s.tabBody}>{tab === "overview" ? <Overview agent={agent} /> : <VersionsPanel agent={agent} />}</div>
      </TabPanel>
    </Page>
  );
}
