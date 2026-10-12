// Captures interaction states for UX audit. Usage: node e2e/audit-flows.mjs <base> <outDir>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const base = process.argv[2]; const out = process.argv[3]; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
async function fresh(w = 1440, h = 900, opts = {}) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, ...opts });
  // Entering /app creates the demo session (single door); ?preview=1 exposes the preview-state tooling.
  await p.goto(`${base}/login/`, { waitUntil: "networkidle" });
  await shot(p, `${w}-00-login`);
  await p.goto(`${base}/app/?preview=1`, { waitUntil: "networkidle" });
  await p.getByRole("heading", { level: 1 }).first().waitFor(); await p.waitForTimeout(700);
  return p;
}
const nav = async (p, label) => { await p.getByRole("link", { name: label, exact: true }).first().click(); await p.waitForTimeout(700); };
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log("FAIL", name, String(e).slice(0, 160)); } };

const p = await fresh();
await shot(p, "1440-01-home-first-view");
await step("home-full", async () => p.screenshot({ path: `${out}/1440-02-home-full.png`, fullPage: true }));
// chat: help desk project, cited answer
await step("chat", async () => {
  await nav(p, "Chat");
  await p.getByRole("link", { name: "Refund timing" }).first().click(); await p.waitForTimeout(800);
  await shot(p, "1440-03-chat-existing");
  await p.getByRole("button", { name: /Open source S1/ }).first().click(); await p.waitForTimeout(700);
  await shot(p, "1440-04-chat-evidence-panel");
});
await step("chat-new-send", async () => {
  await p.goto(`${base}/app/chat/?new=1`); await p.waitForTimeout(400);
  await p.getByRole("heading", { level: 1 }).first().waitFor();
  await p.getByLabel("Project", { exact: true }).selectOption({ label: "Help desk" }).catch(() => {});
  await p.locator("#composer-input").fill("What is the fee for cancelling a pickup late?");
  await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
  await shot(p, "1440-05-chat-new-answer");
  await p.locator("#composer-input").fill("Do you offer carbon offsets?"); await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
  await shot(p, "1440-06-chat-abstain");
  await p.locator("select").filter({ hasText: "Agent default" }).first().selectOption({ index: 2 }).catch(() => {});
  await p.locator("#composer-input").fill("How long do approved refunds take?"); await p.keyboard.press("Enter"); await p.waitForTimeout(1000);
  await shot(p, "1440-07-chat-blocked-model");
  await p.getByRole("button", { name: "Compare models" }).first().click(); await p.waitForTimeout(500);
  await shot(p, "1440-08-compare-modal");
  await p.keyboard.press("Escape");
});
await step("canvas", async () => {
  await nav(p, "Deliverables"); await shot(p, "1440-09-deliverables");
  await p.getByRole("link", { name: /Q3 service levels/ }).first().click(); await p.waitForTimeout(900);
  await shot(p, "1440-10-artifact-deck");
  await p.getByRole("radio", { name: "Edit" }).click().catch(() => {}); await p.waitForTimeout(400);
  await shot(p, "1440-11-artifact-edit");
});
await step("palette", async () => { await p.keyboard.press("Control+k"); await p.waitForTimeout(400); await shot(p, "1440-12-command-palette"); await p.keyboard.press("Escape"); });
await step("preview-states", async () => {
  await p.getByRole("button", { name: "Preview states" }).first().click(); await p.waitForTimeout(400); await shot(p, "1440-13-preview-controls");
  await p.getByRole("radio", { name: "Error" }).click(); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await nav(p, "Projects"); await shot(p, "1440-14-state-error");
  await p.getByRole("button", { name: "Preview states" }).first().click(); await p.getByRole("radio", { name: "Empty" }).click(); await p.keyboard.press("Escape");
  await nav(p, "Sources"); await shot(p, "1440-15-state-empty");
  await p.getByRole("button", { name: "Preview states" }).first().click(); await p.getByRole("radio", { name: "Live" }).click(); await p.keyboard.press("Escape");
});
await step("role", async () => {
  await p.getByRole("button", { name: /View as/ }).first().click(); await p.getByRole("button", { name: /^Viewer/ }).click(); await p.waitForTimeout(600);
  await nav(p, "Home"); await shot(p, "1440-16-viewer-home");
  await p.goto(`${base}/app/usage/`).catch(() => {});
});
await step("workflow-run", async () => {
  const q = await fresh();
  await nav(q, "Workflows"); await q.getByRole("link", { name: /Review a policy/ }).first().click(); await q.waitForTimeout(700);
  await shot(q, "1440-17-workflow-detail");
  await q.getByRole("button", { name: /Preview plan/ }).first().click(); await q.waitForTimeout(600);
  await q.screenshot({ path: `${out}/1440-18-workflow-preview.png`, fullPage: true });
  await q.getByRole("link", { name: "Guided tours", exact: true }).first().click(); await q.waitForTimeout(700); await q.screenshot({ path: `${out}/1440-19-showcase.png`, fullPage: true });
  await q.getByRole("button", { name: "Admin", exact: true }).click().catch(() => {}); await q.waitForTimeout(200);
  await nav(q, "Usage & costs"); await q.screenshot({ path: `${out}/1440-20-usage-full.png`, fullPage: true });
  await nav(q, "Privacy"); await shot(q, "1440-21-privacy");
  await q.getByRole("link", { name: /^Inbox/ }).first().click(); await q.waitForTimeout(700); await shot(q, "1440-22-inbox");
  await nav(q, "Settings"); await shot(q, "1440-23-settings");
  await nav(q, "Agents"); await q.screenshot({ path: `${out}/1440-24-agents-full.png`, fullPage: true });
});
await step("dark", async () => {
  const d = await fresh(1440, 900, { colorScheme: "dark" });
  await shot(d, "1440-25-dark-home"); await nav(d, "Chat"); await d.getByRole("link", { name: "Refund timing" }).first().click(); await d.waitForTimeout(700); await shot(d, "1440-26-dark-chat");
});
await step("mobile", async () => {
  const m = await fresh(375, 812);
  await shot(m, "375-27-home");
  await m.getByRole("button", { name: "Open navigation" }).click(); await m.waitForTimeout(400); await shot(m, "375-28-nav-open"); await m.keyboard.press("Escape");
  await m.goto(`${base}/app/chat/?new=1`); await m.waitForTimeout(300);
});
await step("landing-full", async () => { const l = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await l.goto(`${base}/`, { waitUntil: "networkidle" }); await l.waitForTimeout(1200); await l.screenshot({ path: `${out}/1440-29-landing-full.png`, fullPage: true }); });
await browser.close(); console.log("done");
