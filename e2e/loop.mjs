// Value loop: question → cited answer → deliverable → export → review request.
// Counts clicks from Home and fails (exit 1) when a step breaks.
// Usage: node e2e/loop.mjs <baseUrl> [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:4311/Atlas-studio";
const out = process.argv[3];
if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const failures = [];
let clicks = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) failures.push(msg); };
const click = async (locator) => { clicks += 1; await locator.click(); };
const shot = async (name) => out && (await page.screenshot({ path: `${out}/${name}.png` }));

await page.goto(`${base}/app/`, { waitUntil: "networkidle" });
await page.getByRole("heading", { level: 1 }).first().waitFor();
await click(page.getByRole("button", { name: "How long do approved refunds take?" }));
await page.getByRole("button", { name: /Open source S1/ }).first().waitFor({ timeout: 10000 });
const askClicks = clicks;
await click(page.getByRole("button", { name: /Create deliverable/ }).first());
await click(page.getByRole("menuitem", { name: /Deck/ }).first());
const open = page.getByRole("button", { name: /Open deliverable/ }).first();
await open.waitFor({ timeout: 10000 }).catch(() => {});
check((await open.count()) > 0, "answer → deck created without retyping");
await shot("loop-created");
const deliverableClicks = clicks;
await click(open);
await page.getByRole("complementary", { name: "Deliverable" }).waitFor({ timeout: 8000 }).catch(() => {});
const full = page.getByRole("link", { name: /Open full page|Full view|Open full/ }).first();
if (await full.count()) await click(full);
await page.waitForURL(/\/app\/artifact\//, { timeout: 8000 }).catch(() => {});
check(/\/app\/artifact\//.test(page.url()), "deliverable page opens");
const dl = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
await click(page.getByRole("button", { name: /^Export PPTX/ }).first());
const download = await dl;
check(Boolean(download && /\.pptx$/i.test(download.suggestedFilename())), `primary export downloads a PPTX (${download?.suggestedFilename() ?? "none"})`);
await click(page.getByRole("button", { name: /^Request review/ }).first());
const reviewer = page.getByLabel(/Reviewer/).first();
await reviewer.waitFor({ timeout: 5000 });
const options = await reviewer.locator("option").allTextContents();
const pick = options.find((o) => /Priya/.test(o)) ?? options.find((o) => o.trim() && !/Choose|Select/.test(o));
await reviewer.selectOption({ label: pick });
await click(page.getByRole("button", { name: /^Send/ }).first());
await page.waitForTimeout(600);
await shot("loop-review");
const reviewClicks = clicks - deliverableClicks;
await page.getByRole("link", { name: /^Inbox/ }).first().click();
await page.getByRole("tab", { name: /Reviews/ }).first().click().catch(() => {});
await page.getByRole("radio", { name: /Requested by me/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
check((await page.getByText(/Q?.*How long do approved refunds take|refunds/i).count()) > 0, "Inbox › Reviews lists the requested deck");
await shot("loop-inbox");
console.log(`\nclicks: ask ${askClicks} · answer→deliverable ${deliverableClicks - askClicks} · open+export+review ${reviewClicks}`);
check(deliverableClicks <= 3, `question → deliverable in ${deliverableClicks} clicks (≤ 3)`);
check(errors.length === 0, `no console errors (${errors.join(" | ")})`);
await browser.close();
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log("\nall checks passed");
