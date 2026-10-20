// Náhledy turistických map z Mapy.cz pro každou pěší trasu -> mapy/*.jpg + mapy.json
import fs from "node:fs";
import { chromium } from "playwright";
const html = fs.readFileSync("index.html", "utf8");
const H = JSON.parse(html.match(/const HIKEQ=(\{.*?\});/)[1]);
const qs = [...new Set(Object.values(H).flat())];
const slug = q => q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const old = fs.existsSync("mapy.json") ? JSON.parse(fs.readFileSync("mapy.json", "utf8")) : {};
const force = process.env.FORCE === "1";
fs.mkdirSync("mapy", { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 760 }, locale: "cs-CZ" });
const pg = await ctx.newPage();
const out = {};
let n = 0;
for (const q of qs) {
  const f = `mapy/${slug(q)}.jpg`;
  if (!force && old[q] && fs.existsSync(f)) { out[q] = f; continue; }
  try {
    await pg.goto(`https://mapy.com/cs/turisticka?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await pg.waitForTimeout(7000);
    // Skrýt cookie lištu a postranní panel (nic se neodsouhlasuje, jen se skryje pro snímek)
    await pg.evaluate(() => {
      for (const e of document.querySelectorAll("body *")) {
        const t = (e.tagName || "").toLowerCase(), c = String(e.className || "") + " " + (e.id || "");
        if (t.startsWith("szn-") || /cmp|consent|cookie|cwl/i.test(c)) e.remove();
      }
    });
    await pg.waitForTimeout(800);
    await pg.screenshot({ path: f, type: "jpeg", quality: 72, clip: { x: 480, y: 70, width: 800, height: 500 } });
    out[q] = f; n++;
  } catch (e) { console.log(`Chyba u "${q}": ${e.message}`); }
}
await b.close();
fs.writeFileSync("mapy.json", JSON.stringify(out, null, 1));
console.log(`Map: ${qs.length}, nově nafoceno: ${n}`);
