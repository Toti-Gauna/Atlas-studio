/**
 * Deterministic synthetic datasets. A seeded PRNG guarantees the same CSV on
 * every machine so statistics shown in demos and tests are reproducible.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGIONS = ["North", "South", "East", "West", "Central"] as const;
const CARRIERS = ["Arcadia Lines", "Bluefin Cargo", "Kestrel Road"] as const;
const LEVELS = ["Express", "Standard"] as const;

/** shipments_q3.csv — 12 weeks × 5 regions × 2 service levels = 120 rows. */
export function shipmentsCsv(): string {
  const rand = mulberry32(20260701);
  const header = "week_start,region,carrier,service_level,shipments,on_time_pct,avg_transit_days,claims,revenue_usd";
  const rows: string[] = [header];
  const start = Date.UTC(2026, 6, 6); // Monday 2026-07-06
  for (let w = 0; w < 12; w++) {
    const date = new Date(start + w * 7 * 86_400_000).toISOString().slice(0, 10);
    REGIONS.forEach((region, ri) => {
      LEVELS.forEach((level, li) => {
        const carrier = CARRIERS[(ri + li + w) % CARRIERS.length]!;
        const base = level === "Express" ? 140 : 260;
        const shipments = Math.round(base * (0.8 + rand() * 0.5) * (1 + ri * 0.06));
        const target = level === "Express" ? 95 : 92;
        const onTime = Math.min(99.5, Math.max(82, target + (rand() - 0.55) * 9 - (region === "Central" ? 2.5 : 0)));
        const transit = level === "Express" ? 1.4 + rand() * 0.9 : 3.1 + rand() * 1.6;
        const claims = Math.floor(rand() * (level === "Express" ? 3 : 6));
        const price = level === "Express" ? 18.5 : 9.75;
        const revenue = Math.round(shipments * price * (0.95 + rand() * 0.1) * 100) / 100;
        // One deliberately missing value to show validation of missing data.
        const onTimeCell = w === 5 && region === "East" && level === "Standard" ? "" : onTime.toFixed(1);
        rows.push([date, region, carrier, level, shipments, onTimeCell, transit.toFixed(2), claims, revenue.toFixed(2)].join(","));
      });
    });
  }
  return rows.join("\n") + "\n";
}

export const CSV_DOCUMENT = {
  key: "shipments",
  title: "shipments_q3.csv",
  kind: "csv" as const,
  mimeType: "text/csv",
  tags: ["dataset", "operations"],
  classification: "internal" as const,
  projects: ["analysis", "deck"] as const,
};

export const IMAGE_DOCUMENT = {
  key: "dock_photo",
  title: "dock-utilization-whiteboard.png",
  kind: "image" as const,
  mimeType: "image/png",
  tags: ["image", "operations"],
  classification: "internal" as const,
  projects: ["analysis"] as const,
  /** Original synthetic image created for this demo (no third-party rights). */
  publicPath: "/demo/dock-utilization-whiteboard.png",
  altText: "Synthetic whiteboard-style bar chart of dock utilization by weekday (original demo image).",
};
