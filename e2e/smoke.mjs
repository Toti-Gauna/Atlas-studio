// Core orientation smoke test. Fails (exit 1) when an assertion breaks.
// Usage: node e2e/smoke.mjs <baseUrl> [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:4311/Atlas-studio";
const out = process.argv[3];
if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${msg}`);
  if (!ok) failures.push(msg);
};
const shot = async (page, name) => out && (await page.screenshot({ path: `${out}/${name}.png` }));

// 1. Landing → one click → Home with a session (no second door).
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Try the demo" }).first().click();
await page.getByRole("heading", { level: 1, name: "What do you need to get done?" }).waitFor({ timeout: 8000 });
check((await page.getByRole("button", { name: "Start demo workspace" }).count()) === 0, "landing → Home in one click, no second door");
const navLinks = await page.getByRole("navigation", { name: "Primary" }).getByRole("link").count();
check(navLinks <= 10, `primary navigation shows ${navLinks} links (≤ 10 incl. brand; Admin folded)`);
check((await page.getByText("DEMO", { exact: true }).count()) === 1, "exactly one DEMO marker on Home");
await shot(page, "home");

// 2. One more click → cited answer.
await page.getByRole("button", { name: "How long do approved refunds take?" }).click();
const chip = page.getByRole("button", { name: /Open source S1/ }).first();
await chip.waitFor({ timeout: 8000 }).catch(() => {});
check((await chip.count()) > 0, "example question → cited answer (2 clicks from landing)");
await shot(page, "chat");
if (await chip.count()) {
  await chip.click();
  await page.waitForTimeout(500);
  check((await page.getByRole("complementary", { name: "Evidence" }).count()) > 0, "evidence panel opens");
  await shot(page, "evidence");
}

// 3. Role switching from the demo bar.
await page.goto(`${base}/app/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Admin/ }).first().click();
await page.getByRole("button", { name: /^Viewer/ }).click();
await page.getByRole("heading", { level: 1, name: "Browse your team’s work" }).waitFor({ timeout: 8000 }).catch(() => {});
check((await page.getByRole("heading", { level: 1, name: "Browse your team’s work" }).count()) === 1, "viewer gets a read-only Home");
check((await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Chat" }).count()) === 0, "viewer has no Chat entry");
await shot(page, "viewer");
check(errors.length === 0, `no console errors (${errors.join(" | ")})`);
await page.close();

// 4. Mobile navigation is not empty.
const m = await browser.newPage({ viewport: { width: 375, height: 780 } });
await m.goto(`${base}/app/`, { waitUntil: "networkidle" });
await m.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 8000 });
await m.getByRole("button", { name: "Open navigation" }).click();
await m.waitForTimeout(400);
const visible = await m.getByRole("navigation", { name: "Primary" }).getByRole("link").filter({ visible: true }).count();
check(visible >= 5, `mobile navigation shows ${visible} links`);
await shot(m, "mobile-nav");
await m.close();

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
