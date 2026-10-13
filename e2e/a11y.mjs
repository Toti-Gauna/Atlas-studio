// Accessibility audit with axe-core on every route (light + dark).
// Reports serious/critical violations; exits 1 when any remain.
// Usage: node e2e/a11y.mjs <baseUrl>
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const base = process.argv[2] ?? "http://localhost:4311/Atlas-studio";
const routes = [
  "/", "/login/", "/app/", "/app/chat/?new=1", "/app/projects/", "/app/project/?id=prj_compliance", "/app/library/",
  "/app/document/?id=doc_retention", "/app/agents/", "/app/agent/?id=agt_compliance_advisor", "/app/workflows/",
  "/app/workflow/?id=wfl_csv_analysis&run=wfr_seed_csv", "/app/artifacts/", "/app/inbox/", "/app/runs/", "/app/usage/",
  "/app/privacy/", "/app/evaluations/", "/app/showcase/", "/app/settings/",
];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let serious = 0;
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" });
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const res = await axe.run(document, { resultTypes: ["violations"] });
      return res.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target?.join(" ") ?? "", html: (v.nodes[0]?.html ?? "").slice(0, 120) }));
    });
    serious += result.length;
    for (const v of result) console.log(`${scheme}\t${r}\t${v.impact}\t${v.id} ×${v.n}\t${v.target}\t${v.html}`);
  }
  await page.close();
}
await browser.close();
console.log(serious ? `\n${serious} serious/critical violation group(s)` : "\nno serious or critical violations");
process.exit(serious ? 1 : 0);
