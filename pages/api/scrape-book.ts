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
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, base).toString();
      if (abs.startsWith("javascript:") || abs.includes("mailto:")) return;
      const txt = ($(el).text() || "").trim();
      if (
        /(第\s*\d+\s*章)|章节|章節|Chapter\s*\d+/i.test(txt) ||
        /\/txt\/\d+\/\d+|\/read\/\d+|chapter|\/\d+\.html$/i.test(href)
      ) {
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
    const selectors = [
      "#content", ".content", ".read-content", ".chapter-content", "#BookText",
      ".Readarea", ".main-text", ".txt", ".text", "article", "div"
    ];
    let node = null;
    for (const s of selectors) {
      const el = $(s).first();
      if (el && el.length && (el.text() || "").trim().length > 40) {
        node = el;
        break;
      }
    }
    if (!node) {
      let best = null;
      let bestLen = 0;
      $("div, section, article, main").each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > bestLen) {
          bestLen = t.length;
          best = $(el);
        }
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

type Chapter = {
  idx: number;
  url: string;
  title: string;
  content: string;
};

type ScrapeBookResponse =
  | { status: "success"; chapters_scraped: number; chapters: Chapter[] }
  | { status: "error"; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScrapeBookResponse>
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ status: "error", message: "POST only" });
    }

    const { url, maxChapters = DEFAULT_MAX } = req.body;
    if (!url) {
      return res.status(400).json({ status: "error", message: "Missing url" });
    }

    const cap = Math.min(Number(maxChapters || DEFAULT_MAX), DEFAULT_MAX);
    const entryHtml = await fetchHtml(url);
    const $ = cheerio.load(entryHtml);
    const linkCount = $("a").length;
    const bodyText = ($("body").text() || "").slice(0, 800);
    const looksIndex =
      /章节|章節|目录|目錄|章节目录|章節目錄/i.test(bodyText) ||
      linkCount > 40 ||
      /index|mulu|catalog|list|chapterlist/i.test(url);

    let chapterUrls: string[] = [];

    if (looksIndex) {
      chapterUrls = extractChapterLinksFromHtml(entryHtml, url);
    } else {
      const seq = url.match(/(.*?\/)(\d+)(\/?)/);
      if (seq) {
        const prefix = seq[1];
        const start = Number(seq[2]);
        for (let i = start; i < start + Math.min(500, cap); i++) {
          chapterUrls.push(`${prefix}${i}`);
        }
      } else {
        chapterUrls = extractChapterLinksFromHtml(entryHtml, url);
      }
    }

    chapterUrls = dedupeUrls(chapterUrls).slice(0, cap);

    if (!chapterUrls.length) {
      const page = await extractTextFromPage(url);
      return res.status(200).json({
        status: "success",
        chapters_scraped: 1,
        chapters: [{ idx: 1, url, title: page.title, content: page.content }]
      });
    }

    const chapters: Chapter[] = [];
    for (let i = 0; i < chapterUrls.length; i++) {
      const u = chapterUrls[i];
      const page = await extractTextFromPage(u);
      chapters.push({
        idx: i + 1,
        url: u,
        title: page.title || `Chapter ${i + 1}`,
        content: page.content || ""
      });
      await new Promise(r => setTimeout(r, 120));
    }

    return res.status(200).json({
      status: "success",
      chapters_scraped: chapters.length,
      chapters
    });
  } catch (e: any) {
    console.error("scrape-book error", e);
    return res.status(500).json({ status: "error", message: e?.message || String(e) });
  }
}