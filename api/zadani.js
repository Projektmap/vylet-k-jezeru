// Zadání Kláry: ukládá se jako GitHub issue se štítkem "klara" (token v proměnné GITHUB_TOKEN na Vercelu)
const REPO = "Projektmap/vylet-k-jezeru";
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = process.env.GITHUB_TOKEN, code = process.env.KLARA_KOD || "";
  if (!token) return res.status(503).json({ error: "not_configured", requiresCode: !!code });
  const gh = (p, o = {}) => fetch(`https://api.github.com/repos/${REPO}${p}`, { ...o, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "vylet-k-jezeru", "Content-Type": "application/json" } });
  try {
    if (req.method === "GET") {
      const r = await gh("/issues?labels=klara&state=all&per_page=20&sort=created&direction=desc");
      if (!r.ok) return res.status(502).json({ error: "github", requiresCode: !!code });
      const issues = await r.json();
      const items = await Promise.all(issues.map(async i => {
        let reply = "";
        if (i.comments) { const c = await (await gh(`/issues/${i.number}/comments?per_page=100`)).json(); const last = c.filter(x => x.user && x.user.type === "User" || /\[Claude\]/.test(x.body)).pop(); reply = last ? last.body.replace(/\[Claude\]\s*/, "").slice(0, 1500) : ""; }
        const m = (i.body || "").match(/^Od: (.*)\n\n([\s\S]*?)\n\n---/);
        return { number: i.number, jmeno: m ? m[1] : "Klára", text: m ? m[2] : i.body || "", created: i.created_at, done: i.state === "closed", reply };
      }));
      return res.status(200).json({ items, requiresCode: !!code });
    }
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      if (b.web) return res.status(200).json({ ok: true });
      if (code && b.kod !== code) return res.status(403).json({ error: "bad_code" });
      const text = String(b.text || "").trim().slice(0, 5000), jmeno = String(b.jmeno || "Klára").trim().slice(0, 60) || "Klára";
      if (text.length < 5) return res.status(400).json({ error: "empty" });
      const r = await gh("/issues", { method: "POST", body: JSON.stringify({ title: `Zadání: ${text.replace(/\s+/g, " ").slice(0, 70)}`, body: `Od: ${jmeno}\n\n${text}\n\n---\nOdesláno z webu vylet-k-jezeru.vercel.app`, labels: ["klara"] }) });
      if (!r.ok) return res.status(502).json({ error: "github" });
      const j = await r.json();
      return res.status(200).json({ ok: true, number: j.number });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method" });
  } catch (e) { return res.status(500).json({ error: "server" }); }
};
