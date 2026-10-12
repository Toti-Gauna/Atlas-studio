// Prints the outermost elements wider than the viewport. Usage: node e2e/overflow.mjs <url> <width>
import { chromium } from "@playwright/test";
const [url, w = "768"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: Number(w), height: 900 } });
await p.goto(url, { waitUntil: "networkidle" });
const s = p.getByRole("button", { name: "Start demo workspace" });
if (await s.count()) await s.first().click();
await p.waitForTimeout(800);
console.log(await p.evaluate(() => {
  const vw = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1) continue;
    let clipped = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== "visible" || cs.overflow === "hidden") { clipped = true; break; }
    }
    if (!clipped) out.push(`${el.tagName}.${String(el.className).slice(0, 60)} pos=${getComputedStyle(el).position} right=${Math.round(r.right)}`);
  }
  return out.slice(0, 12).join("\n");
}));
await b.close();
