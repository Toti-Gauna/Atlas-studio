// Captures the real product screenshot used on the landing page.
// Usage: node e2e/capture-landing.mjs <baseUrl>  → apps/web/public/landing/product-evidence.png
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4311/Atlas-studio";
const out = new URL("../apps/web/public/landing/product-evidence.png", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await page.goto(`${base}/app/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "How long do approved refunds take?" }).click();
const chip = page.getByRole("button", { name: /Open source S1/ }).first();
await chip.waitFor({ timeout: 10000 });
await chip.click();
await page.getByRole("complementary", { name: "Evidence" }).waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
