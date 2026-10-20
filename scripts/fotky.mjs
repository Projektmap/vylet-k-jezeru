// Projde všechny fotky z index.html, ověří je na Wikipedii / Wikimedia Commons a uloží do fotky.json
import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");
const specs = [...new Set([...html.matchAll(/wiki:"([a-z]{2}:[^"]+)"/g), ...html.matchAll(/D\("[^"]*","[^"]*","([a-z]{2}:[^"]+)"/g)].map(m => m[1]))];
const galleries = [...new Set([...html.matchAll(/gallery:\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1])))];
const UA = { "User-Agent": "vylet-k-jezeru/1.0 (https://vylet-k-jezeru.vercel.app)" };
const BAD = /map|karte|carta|wappen|coat|logo|plan|stemma|flag|diagram|svg|sign|schild|locator|location/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function j(u) { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch (e) {} await sleep(800); } return null; }
async function commons(q, n) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1200&format=json`;
  const d = await j(u); const out = [];
  for (const p of Object.values(d?.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== "image/jpeg" || BAD.test(p.title) || ii.width < ii.height || ii.width < 900) continue;
    const m = ii.extmetadata || {};
    const artist = (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 60);
    out.push({ src: ii.thumburl, page: ii.descriptionurl, credit: `${artist || "Wikimedia Commons"}${m.LicenseShortName?.value ? " · " + m.LicenseShortName.value : ""}`, alt: q });
    if (out.length >= n) break;
  }
  return out;
}
const res = { places: {}, galleries: {}, report: [] };
for (const s of specs) {
  const [lang, title] = s.split(":");
  const d = await j(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  let src = d?.originalimage?.width <= 2400 ? d.originalimage.source : d?.thumbnail?.source?.replace(/\/\d+px-/, "/1200px-");
  if (src) { res.places[s] = { src, page: d.content_urls?.desktop?.page || "", credit: "Wikipedie", alt: d.title }; continue; }
  const c = await commons(title.replace(/_/g, " ").replace(/\(.*?\)/g, ""), 1);
  if (c[0]) { res.places[s] = c[0]; res.report.push(`${s}: bez fotky na Wikipedii, náhrada z Commons`); }
  else res.report.push(`${s}: ŽÁDNÁ FOTKA`);
  await sleep(150);
}
for (const q of galleries) { res.galleries[q] = await commons(q, 3); if (!res.galleries[q].length) res.report.push(`galerie "${q}": prázdná`); await sleep(150); }
fs.writeFileSync("fotky.json", JSON.stringify(res, null, 1));
console.log(`Míst: ${specs.length}, s fotkou: ${Object.keys(res.places).length}; galerií: ${galleries.length}`);
console.log(res.report.join("\n") || "Vše v pořádku.");
