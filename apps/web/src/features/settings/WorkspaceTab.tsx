"use client";
import { RotateCcw } from "lucide-react";
import { useSession } from "@/lib/state/session";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Callout, Card, DemoTag, DescList, ErrorState, LoadingBlock, SectionHead } from "@/components/ui";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

export function WorkspaceTab() {
  const session = useSession();
  if (session.isPending) return <LoadingBlock rows={3} />;
  if (session.isError) return <ErrorState error={session.error} onRetry={() => void session.refetch()} />;
  const w = session.data.workspace;
  const c2 = c.workspace;
  return (
    <div className={s.stack}>
      <section aria-labelledby="ws-h">
        <SectionHead id="ws-h" title={c2.heading} aside={w.label === "DEMO" ? <DemoTag /> : null} />
        <Card>
          <DescList
            items={[
              [c2.name, w.name],
              [c2.kind, w.kind === "demo_visitor" ? c2.kindDemo : c2.kindStandard],
              [
                c2.timeZone,
                <span key="tz">
                  <span className="mono">{w.timeZone}</span>
                  <span className={s.subtle}> · {c2.timeZoneHint}</span>
                </span>,
              ],
              [c2.currency, w.currency],
              [c2.brand, w.brandName || "—"],
              [c2.expiry, w.expiresAt ? `${formatDateTime(w.expiresAt)} (${relativeTime(w.expiresAt)})` : c2.noExpiry],
            ]}
          />
          <p className={s.subtle} style={{ marginTop: 12 }}>
            {c2.readOnly}
          </p>
        </Card>
      </section>
      <section aria-labelledby="ws-reset-h">
        <SectionHead id="ws-reset-h" title={c2.resetTitle} />
        <Callout icon={<RotateCcw size={16} aria-hidden />}>{c2.resetBody}</Callout>
      </section>
    </div>
  );
}
