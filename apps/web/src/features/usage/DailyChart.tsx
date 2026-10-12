"use client";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { BarChart3, Table2 } from "lucide-react";
import type { UsageReport } from "@atlas/contracts";
import { money } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Button, Card, Table, numCell } from "@/components/ui";
import { nanoToUsdNumber } from "./nano";
import s from "./usage.module.css";

type Day = UsageReport["daily"][number];

const H = 232;
const PAD = { top: 26, right: 8, bottom: 40, left: 56 };
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));

function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 0.5, 1] };
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= rough) ?? 10 * mag;
  const top = step * Math.ceil(max / step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { top, ticks };
}

const tickLabel = (v: number) =>
  v >= 1000 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" }).format(v) : `$${v < 10 && v % 1 ? v.toFixed(2) : v.toFixed(0)}`;

/** Column with a 4px rounded data end, square at the baseline. */
function barPath(x: number, y: number, w: number, base: number) {
  const h = base - y;
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w] as const;
}

/** Daily calculated cost — single series, accessible SVG with a table fallback. */
export function DailyChart({ daily, rangeLabel }: { daily: Day[]; rangeLabel: string }) {
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, width] = useWidth();
  const uid = useId();
  const unknownDays = daily.filter((d) => d.unknownCostEntries > 0).length;
  const values = daily.map((d) => nanoToUsdNumber(d.calculatedNanoUsd));
  const { top, ticks } = niceScale(Math.max(0, ...values));
  const plotW = width - PAD.left - PAD.right;
  const base = H - PAD.bottom;
  const band = plotW / Math.max(1, daily.length);
  const barW = Math.max(2, Math.min(24, band - 4));
  const y = (v: number) => base - (v / top) * (base - PAD.top);
  const maxIdx = values.indexOf(Math.max(...values));
  const labelEvery = Math.ceil(daily.length / Math.max(2, Math.floor(plotW / 56)));
  const activeDay = active !== null ? daily[active] : undefined;

  const onKey = (e: KeyboardEvent) => {
    if (!daily.length) return;
    const cur = active ?? -1;
    const next = e.key === "ArrowRight" ? Math.min(daily.length - 1, cur + 1) : e.key === "ArrowLeft" ? Math.max(0, cur < 0 ? daily.length - 1 : cur - 1) : e.key === "Home" ? 0 : e.key === "End" ? daily.length - 1 : null;
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === "Escape") setActive(null);
  };

  return (
    <Card>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle} id={`${uid}-t`}>
          {c.chart.title}
        </h2>
        <Button size="sm" variant="ghost" icon={asTable ? <BarChart3 size={14} aria-hidden /> : <Table2 size={14} aria-hidden />} onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? c.chart.asChart : c.chart.asTable}
        </Button>
      </div>
      {asTable ? (
        <Table caption={c.chart.title}>
          <thead>
            <tr>
              <th scope="col">{c.chart.day}</th>
              <th scope="col" className={numCell}>{c.chart.cost}</th>
              <th scope="col" className={numCell}>{c.chart.unknown}</th>
              <th scope="col" className={numCell}>{c.chart.local}</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day}>
                <th scope="row" style={{ fontWeight: 500 }}>{dayLabel(d.day)}</th>
                <td className={numCell}>{money(d.calculatedNanoUsd)}</td>
                <td className={numCell}>{d.unknownCostEntries}</td>
                <td className={numCell}>{d.localEntries}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div ref={wrapRef} className={s.chartWrap}>
          <svg
            width={width}
            height={H}
            role="img"
            aria-labelledby={`${uid}-st ${uid}-sd`}
            tabIndex={0}
            className={s.chart}
            onKeyDown={onKey}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
          >
            <title id={`${uid}-st`}>{c.chart.title}</title>
            <desc id={`${uid}-sd`}>{c.chart.desc(rangeLabel, daily.length, unknownDays)} Use the left and right arrow keys to read each day.</desc>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={s.grid} />
                <text x={PAD.left - 8} y={y(t)} className={s.axisText} textAnchor="end" dominantBaseline="middle">
                  {tickLabel(t)}
                </text>
              </g>
            ))}
            {daily.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const v = values[i] ?? 0;
              return (
                <g key={d.day}>
                  <path d={barPath(cx - barW / 2, y(v), barW, base)} className={i === active ? s.barActive : s.bar} />
                  {d.unknownCostEntries > 0 ? <path d={`M${cx},${base + 5}l5,8h-10z`} className={s.unknownMark} /> : null}
                  {i % labelEvery === 0 ? (
                    <text x={cx} y={H - 8} className={s.axisText} textAnchor="middle">
                      {dayLabel(d.day)}
                    </text>
                  ) : null}
                  {i === maxIdx && v > 0 ? (
                    <text x={cx > width - 48 ? cx + barW / 2 : cx < PAD.left + 32 ? cx - barW / 2 : cx} y={y(v) - 8} className={s.valueText} textAnchor={cx > width - 48 ? "end" : cx < PAD.left + 32 ? "start" : "middle"}>
                      {money(d.calculatedNanoUsd)}
                    </text>
                  ) : null}
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={H - PAD.top} fill="transparent" onPointerEnter={() => setActive(i)} />
                </g>
              );
            })}
          </svg>
          {activeDay ? (
            <div className={s.tooltip} style={{ left: Math.min(width - 90, Math.max(90, PAD.left + band * (active ?? 0) + band / 2)), top: y(values[active ?? 0] ?? 0) - 8 }} aria-hidden>
              <strong>{money(activeDay.calculatedNanoUsd)}</strong>
              <span>{dayLabel(activeDay.day)}</span>
              {activeDay.unknownCostEntries ? <span>{activeDay.unknownCostEntries} unknown-cost (not included)</span> : null}
              {activeDay.localEntries ? <span>{activeDay.localEntries} local · no charge</span> : null}
            </div>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {activeDay ? `${dayLabel(activeDay.day)}: ${money(activeDay.calculatedNanoUsd)} calculated, ${activeDay.unknownCostEntries} unknown-cost entries, ${activeDay.localEntries} local entries.` : ""}
          </p>
          <p className={s.legend}>
            <svg width="12" height="10" aria-hidden>
              <path d="M6,1l5,8h-10z" className={s.unknownMark} />
            </svg>
            {c.chart.unknownMarker}
          </p>
        </div>
      )}
    </Card>
  );
}
