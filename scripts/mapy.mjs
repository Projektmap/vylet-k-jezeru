// Náhledy turistické mapy Mapy.cz pro každou pěší trasu -> mapy/*.jpg + mapy.json {dotaz:{f,lat,lon}}
import fs from "node:fs";
import { chromium } from "playwright";
const html = fs.readFileSync("index.html", "utf8");
const H = JSON.parse(html.match(/const HIKEQ=(\{.*?\});/)[1]);
const qs = [...new Set(Object.values(H).flat())];
const slug = q => q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const old = fs.existsSync("mapy.json") ? JSON.parse(fs.readFileSync("mapy.json", "utf8")) : {};
const force = process.env.FORCE === "1";
fs.mkdirSync("mapy", { recursive: true });
async function geo(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, { headers: { "User-Agent": "vylet-k-jezeru/1.0 (https://vylet-k-jezeru.vercel.app)" } });
  const j = r.ok ? await r.json() : []; await sleep(1100);
  return j[0] ? { lat: +(+j[0].lat).toFixed(5), lon: +(+j[0].lon).toFixed(5) } : null;
}
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: "cs-CZ" });
const pg = await ctx.newPage();
const out = {}; let n = 0, first = true;
for (const q of qs) {
  const f = `mapy/${slug(q)}.jpg`;
  const o = old[q] && typeof old[q] === "object" ? old[q] : null;
  if (!force && o && fs.existsSync(f)) { out[q] = o; continue; }
  const c = (o && o.lat) ? o : await geo(q);
  if (!c) { console.log(`Bez souřadnic: ${q}`); continue; }
  try {
    await pg.goto(`https://mapy.com/cs/turisticka?x=${c.lon}&y=${c.lat}&z=14`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await pg.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
    await pg.waitForTimeout(3000);
    // Skrýt cookie lištu (nic se neodsouhlasuje) a ovládací prvky pro čistý snímek
    await pg.evaluate(() => {
      for (const e of document.querySelectorAll("body *")) {
        const t = (e.tagName || "").toLowerCase(), cl = String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || "") + " " + (e.id || "");
        if (t.startsWith("szn-") || /cmp|consent|cookie|cwl/i.test(cl)) e.remove();
      }
    });
    await pg.waitForTimeout(700);
    if (first) { await pg.screenshot({ path: "mapy/_debug.png" }); first = false; }
    await pg.screenshot({ path: f, type: "jpeg", quality: 74, clip: { x: 560, y: 150, width: 640, height: 400 } });
    out[q] = { f, lat: c.lat, lon: c.lon }; n++;
  } catch (e) { console.log(`Chyba u "${q}": ${e.message}`); }
}
await b.close();
fs.writeFileSync("mapy.json", JSON.stringify(out, null, 1));
console.log(`Map: ${qs.length}, nově nafoceno: ${n}`);
