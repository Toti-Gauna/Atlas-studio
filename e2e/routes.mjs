// Visits every route at 360/768/1440, starts a demo session, records console errors,
// horizontal overflow and a screenshot. Usage: node e2e/routes.mjs <baseUrl> <outDir>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:4311/Atlas-studio";
const out = process.argv[3] ?? "./shots";
mkdirSync(out, { recursive: true });
const routes = [
  "/", "/login/", "/app/", "/app/chat/?new=1", "/app/projects/", "/app/project/?id=prj_compliance", "/app/library/",
  "/app/document/?id=doc_retention", "/app/document/?id=doc_shipments", "/app/agents/", "/app/agent/?id=agt_compliance_advisor",
  "/app/workflows/", "/app/workflow/?id=wfl_csv_analysis&run=wfr_seed_csv", "/app/artifacts/", "/app/reviews/", "/app/runs/",
  "/app/usage/", "/app/privacy/", "/app/inbox/", "/app/evaluations/", "/app/showcase/", "/app/settings/?tab=models",
];
const widths = (process.argv[4] ?? "1440,768,360").split(",").map(Number);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const report = [];
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 500 ? 780 : 900 } });
  for (const r of routes) {
    const errors = [];
    const onConsole = (m) => { if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text().slice(0, 200)); };
    const onErr = (e) => errors.push(String(e).slice(0, 200));
    page.on("console", onConsole);
    page.on("pageerror", onErr);
    await page.goto(base + r, { waitUntil: "networkidle" });
    const start = page.getByRole("button", { name: "Start demo workspace" });
    if (r.startsWith("/app") && (await start.count())) await start.first().click();
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const h1 = await page.locator("h1").first().textContent().catch(() => null);
    const name = `${w}-${r.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}.png`;
    await page.screenshot({ path: `${out}/${name}` });
    report.push({ w, r, h1: h1?.trim().slice(0, 50), overflow, errors });
    page.off("console", onConsole);
    page.off("pageerror", onErr);
  }
  await page.close();
}
await browser.close();
for (const x of report) console.log(`${x.w}\t${x.overflow > 1 ? "OVERFLOW " + x.overflow : "ok"}\t${x.errors.length ? "ERR " + x.errors.join(" | ") : "-"}\t${x.r}\t${x.h1}`);
