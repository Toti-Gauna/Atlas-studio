"use client";
import { RotateCcw } from "lucide-react";
import { useSession } from "@/lib/state/session";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Callout, Card, DescList, ErrorState, LoadingBlock, SectionHead } from "@/components/ui";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

/** "America/Argentina/Buenos_Aires" → "Buenos Aires" + "Argentina Standard Time" (plain words, no IANA id). */
function timeZoneLabel(zone: string): { city: string; name: string | null } {
  const city = (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? null;
    return { city, name };
  } catch {
    return { city, name: null };
  }
}

/** Workspace: the product is Atlas Studio, the workspace is the (demo) company. */
export function WorkspaceTab() {
  const session = useSession();
  if (session.isPending) return <LoadingBlock rows={3} />;
  if (session.isError) return <ErrorState error={session.error} onRetry={() => void session.refetch()} />;
  const w = session.data.workspace;
  const c2 = c.workspace;
  const tz = timeZoneLabel(w.timeZone);
  return (
    <div className={s.stack}>
      <section aria-labelledby="ws-h">
        <SectionHead id="ws-h" title={c2.heading} />
        <Card>
          <DescList
            items={[
              [c2.name, w.name],
              [c2.kind, w.kind === "demo_visitor" ? c2.kindDemo : c2.kindStandard],
              [c2.product, w.brandName || c2.productName],
              [
                c2.timeZone,
                <span key="tz">
                  {tz.city}
                  {tz.name ? <span className={s.tzZone}> · {tz.name}</span> : null}
                  <span className={s.subtle}> · {c2.timeZoneHint}</span>
                </span>,
              ],
              [c2.currency, w.currency],
              [c2.expiry, w.expiresAt ? `${formatDateTime(w.expiresAt)} (${relativeTime(w.expiresAt)})` : c2.noExpiry],
            ]}
          />
          <p className={`${s.subtle} ${s.noteTop}`}>{c2.readOnly}</p>
        </Card>
      </section>
      {w.kind === "demo_visitor" ? (
        <section aria-labelledby="ws-reset-h">
          <SectionHead id="ws-reset-h" title={c2.resetTitle} />
          <Callout icon={<RotateCcw size={16} aria-hidden />}>{c2.resetBody}</Callout>
        </section>
      ) : null}
    </div>
  );
}
