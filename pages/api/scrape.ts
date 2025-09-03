import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ status: "error", message: "POST only" });
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: "error", message: "Missing url" });

    const r = await axios.get(url, { headers: { "User-Agent": USER_AGENT }, timeout: 15000 });
    const $ = cheerio.load(r.data);
    $("script, style, nav, footer, header, noscript, iframe, form, .ads, .advert, .share, .paywall").remove();

    const selectors = ['#content', '.content', '.read-content', '#BookText', '.main-text', '.chapter-content', 'article'];
    let node = null;
    for (const s of selectors) {
      const el = $(s).first();
      if (el && el.length && (el.text() || "").trim().length > 30) { node = el; break; }
    }
    if (!node) {
      let best = null, bestLen = 0;
      $('div, section, article, main').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > bestLen) { bestLen = t.length; best = $(el); }
      });
      node = best || $('body');
    }

    const text = (node.text() || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    const title = ($('h1').first().text() || $('title').text() || '').trim();

    return res.status(200).json({ status: "success", text, title });
  } catch (e: any) {
    console.error("scrape single error", e);
    return res.status(500).json({ status: "error", message: e?.message || String(e) });
  }
}