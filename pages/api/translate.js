import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ status: "error", message: "Only POST" });
    const { q, source = "auto", target = "en" } = req.body;
    if (!q) return res.status(400).json({ status: "error", message: "Missing q" });

    // Public LibreTranslate endpoint - may rate-limit
    const apiUrl = "https://libretranslate.com/translate";

    const r = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, source, target, format: "text" })
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ status: "error", message: `Translate API error: ${r.status} ${txt}` });
    }

    const body = await r.json();
    return res.status(200).json({ status: "success", translatedText: body.translatedText });
  } catch (e: any) {
    console.error("translate error", e);
    return res.status(500).json({ status: "error", message: e.message || String(e) });
  }
}