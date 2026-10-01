// Soker – söker varan på willys.se, och om den inte finns där på ica.se (Maxi ICA Stormarknad Linköping).
// Miljövariabler i Vercel: ANTHROPIC_API_KEY (krävs), SOKER_KOD (valfri kod så ingen annan kan använda din nyckel)
export const config = { maxDuration: 60 };

const MODEL = "claude-haiku-4-5-20251001";

async function fraga(vara, domain, butik, extra) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system:
        "Du är Soker, en inköpsassistent för ett svenskt par. Du hjälper till att hitta livsmedel i butik. " +
        "Hitta aldrig på produkter, priser eller länkar. Om du inte hittar något säkert svarar du hittad=false.",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3, allowed_domains: [domain] }],
      messages: [{
        role: "user",
        content:
          `Punkt på inköpslistan: "${vara}".\n` +
          `1) Avgör om det är ett livsmedel eller dagligvara som säljs i matbutik.\n` +
          `2) Om ja: sök på ${domain} (${butik}) efter en passande produkt. ${extra}\n` +
          `Svara ENBART med JSON, utan förklaring: ` +
          `{"livsmedel":true|false,"hittad":true|false,"namn":"produktnamn","pris":"t.ex. 17,90 kr","url":"länk till produkten"}`,
      }],
    }),
  });
  if (!r.ok) throw new Error("API " + r.status);
  const d = await r.json();
  const text = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < 0) return { livsmedel: true, hittad: false };
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return { livsmedel: true, hittad: false }; }
}

const okUrl = (u, dom) => typeof u === "string" && u.startsWith("https://") && u.includes(dom);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ fel: "POST" });
  const kod = process.env.SOKER_KOD;
  if (kod && req.headers["x-kod"] !== kod) return res.status(401).json({ fel: "kod" });
  const vara = String((req.body && req.body.vara) || "").slice(0, 80).trim();
  if (!vara) return res.status(400).json({ fel: "tom" });

  try {
    const w = await fraga(vara, "willys.se", "Willys", "Välj en rimlig vanlig variant.");
    if (w.livsmedel === false) return res.json({ st: "ej" });
    if (w.hittad && w.namn) {
      return res.json({ st: "ok", butik: "Willys", namn: w.namn, pris: w.pris || "", url: okUrl(w.url, "willys.se") ? w.url : "" });
    }
    const i = await fraga(vara, "ica.se", "Maxi ICA Stormarknad Linköping",
      "Butiken är https://www.ica.se/butiker/maxi/linkoping/maxi-ica-stormarknad-linkoping-1003823/ – hitta produkten hos ICA. Ange bara pris om det tydligt framgår.");
    if (i.hittad && i.namn) {
      return res.json({ st: "ok", butik: "ICA Maxi Linköping", namn: i.namn, pris: i.pris || "", url: okUrl(i.url, "ica.se") ? i.url : "" });
    }
    return res.json({ st: "nej" });
  } catch (e) {
    return res.status(500).json({ fel: "sok" });
  }
}
