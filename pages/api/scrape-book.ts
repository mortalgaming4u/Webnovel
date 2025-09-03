import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_MAX = 4000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function dedupeUrls(list: string[]) {
  const seen = new Set<string>();
  return list.filter(u => {
    try {
      const nu = new URL(u);
      nu.hash = "";
      const key = nu.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    }
  });
}

async function fetchHtml(url: string) {
  const r = await axios.get(url, { headers: { "User-Agent": USER_AGENT }, timeout: 15000 });
  return r.data;
}

function extractChapterLinksFromHtml(html: string, base: string) {
  const $ = cheerio.load(html);
  const anchors: string[] = [];
  $("a").each((i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, base).toString();
      if (abs.startsWith("javascript:") || abs.includes("mailto:")) return;
      // heuristics: link text contains chapter keywords OR path looks chapter-like
      const txt = ($(el).text() || "").trim();
      if (/(第\s*\d+\s*章)|章节|Chapter\s*\d+/i.test(txt) || /\/txt\/\d+\/\d+|\/read\/\d+|chapter|\/\d+\.html$/i.test(href)) {
        anchors.push(abs);
      }
    } catch {}
  });
  return dedupeUrls(anchors);
}

async function extractTextFromPage(url: string) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, noscript, iframe, form, .ads, .advert, .share, .paywall").remove();
    const selectors = ['#content', '.content', '.read-content', '.chapter-content', '#BookText', '.Readarea', '.main-text', '.txt', '.text', 'article', 'div'];
    let node = null;
    for (const s of selectors) {
      const el = $(s).first();
      if (el && el.length && (el.text() || "").trim().length > 40) { node = el; break; }
    }
    if (!node) {
      // pick largest block
      let best = null;
      let bestLen = 0;
      $('div, section, article, main').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > bestLen) { bestLen = t.length; best = $(el); }
      });
      node = best || $("body");
    }
    const title = ($("h1").first().text() || $("title").text() || "").trim();
    const content = (node.text() || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return { title, content };
  } catch (e: any) {
    return { title: "", content: `⚠️ Failed to fetch: ${e?.message || e}` };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ status: "error", message: "POST only" });
    const { url, maxChapters = DEFAULT_MAX } = req.body;
    if (!url) return res.status(400).json({ status: "error", message: "Missing url" });

    const cap = Math.min(Number(maxChapters || DEFAULT_MAX), DEFAULT_MAX);

    // Step 1: fetch index or entry
    const entryHtml = await fetchHtml(url);
    // Decide whether this is an index/catalog page
    const $ = cheerio.load(entryHtml);
    const linkCount = $("a").length;
    const bodyText = ($("body").text() || "").slice(0, 800);
    const looksIndex = /章节|章節|目录|目錄|章节目录|章節目錄/i.test(bodyText) || linkCount > 40 || /index|mulu|catalog|list|chapterlist/i.test(url);

    let chapterUrls: string[] = [];

    if (looksIndex) {
      chapterUrls = extractChapterLinksFromHtml(entryHtml, url);
    } else {
      // try to detect sequential pattern in url e.g. /txt/86324/50170236
      const seq = url.match(/(.*?\/)(\d+)(\/?)/);
      if (seq) {
        const prefix = seq[1];
        const start = Number(seq[2]);
        // generate a reasonable range, but cap
        for (let i = start; i < start + Math.min(500, cap); i++) {
          chapterUrls.push(`${prefix}${i}`);
        }
      } else {
        // fallback: find link list on the page
        chapterUrls = extractChapterLinksFromHtml(entryHtml, url);
      }
    }

    chapterUrls = dedupeUrls(chapterUrls).slice(0, cap);

    if (!chapterUrls.length) {
      // single page
      const page = await extractTextFromPage(url);
      return res.status(200).json({ status: "success", chapters_scraped: 1, chapters: [{ idx: 1, url, title: page.title, content: page.content }] });
    }

    const chapters = [];
    for (let i = 0; i < chapterUrls.length; i++) {
      const u = chapterUrls[i];
      const page = await extractTextFromPage(u);
      chapters.push({ idx: i + 1, url: u, title: page.title || `Chapter ${i + 1}`, content: page.content || "" });
      // polite delay
      await new Promise(r => setTimeout(r, 120));
    }

    return res.status(200).json({ status: "success", chapters_scraped: chapters.length, chapters });
  } catch (e: any) {
    console.error("scrape-book error", e);
    return res.status(500).json({ status: "error", message: e?.message || String(e) });
  }
}