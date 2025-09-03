import cheerio, { CheerioAPI, Cheerio } from 'cheerio';
import type { NextApiRequest, NextApiResponse } from 'next';

type Chapter = {
  idx: number;
  url: string;
  title: string;
  content: string;
};

type ScrapeResponse =
  | { status: 'success'; chapters_scraped: number; chapters: Chapter[] }
  | { status: 'error'; message: string };

const DEFAULT_MAX = 4000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScrapeResponse>
) {
  try {
    if (req.method !== 'POST') {
      return res
        .status(405)
        .json({ status: 'error', message: 'Only POST allowed' });
    }

    const body = await readJson(req);
    const url = body?.url ? String(body.url) : null;
    if (!url) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Missing url' });
    }

    const maxChapters = Math.min(
      Number(body.maxChapters || DEFAULT_MAX),
      DEFAULT_MAX
    );

    // Fetch the entry page once
    const entryHtml = await fetchHtml(url);
    if (!entryHtml) {
      return res
        .status(502)
        .json({ status: 'error', message: 'Failed to fetch URL' });
    }

    // Heuristics: index page?
    const maybeIndex = looksLikeIndex(url) || pageLooksLikeIndex(entryHtml);

    let chapterUrls: string[] = [];

    if (maybeIndex) {
      chapterUrls = extractChapterLinks(entryHtml, url);
    } else {
      const pattern = detectIncrementPattern(url);
      if (pattern) {
        chapterUrls = generateFromPattern(pattern, maxChapters);
      } else {
        const possibleIndexUrl = tryGetSiteIndexUrl(url);
        if (possibleIndexUrl) {
          const idxHtml = await fetchHtml(possibleIndexUrl);
          if (idxHtml) {
            chapterUrls = extractChapterLinks(idxHtml, possibleIndexUrl);
          }
        }
        if (!chapterUrls.length) {
          chapterUrls = extractChapterLinks(entryHtml, url);
        }
      }
    }

    if (!chapterUrls.length) {
      // single-page extraction
      const single = await fetchChapterPage(url);
      const chap: Chapter = {
        idx: 1,
        url,
        title: single.title || '',
        content: single.content || ''
      };
      return res
        .status(200)
        .json({ status: 'success', chapters_scraped: 1, chapters: [chap] });
    }

    // Dedupe + cap
    chapterUrls = dedupeUrls(chapterUrls).slice(0, maxChapters);

    const chapters: Chapter[] = [];
    for (let i = 0; i < chapterUrls.length; i++) {
      const u = chapterUrls[i];
      try {
        const page = await fetchChapterPage(u);
        chapters.push({
          idx: i + 1,
          url: u,
          title: page.title || `Chapter ${i + 1}`,
          content: page.content || ''
        });
      } catch (err) {
        chapters.push({
          idx: i + 1,
          url: u,
          title: '',
          content: `⚠️ Failed to fetch chapter: ${String(err).slice(0, 150)}`
        });
      }
      // polite delay
      await sleep(120);
    }

    return res
      .status(200)
      .json({ status: 'success', chapters_scraped: chapters.length, chapters });
  } catch (err) {
    console.error('scrape error', err);
    return res
      .status(500)
      .json({ status: 'error', message: String(err) });
  }
}

/* ---------------- helpers ---------------- */

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow'
    });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    console.warn('fetchHtml failed', (e as Error).message || e);
    return null;
  }
}

async function fetchChapterPage(url: string): Promise<{
  title: string;
  content: string;
}> {
  const html = await fetchHtml(url);
  if (!html) throw new Error('Failed to fetch chapter page');

  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, noscript, iframe, form, button, .ads, .advert, .share, .paywall').remove();

  const selectors = [
    '#content', '.content', '.entry-content', '.read-content', '.chapter-content',
    '#chaptercontent', '.chapter-content', '#BookText', '.Readarea', '.novel_content',
    '.main-text', '.txt', '.text', '.article-content', '.readarea', '.chapter'
  ];

  let node = null;
  for (const s of selectors) {
    const el = $(s).first();
    if (el.length && el.text().trim().length > 40) {
      node = el;
      break;
    }
  }
  if (!node) node = pickLargestTextBlock($) || $('body');

  const title = ($('h1').first().text() || $('title').text() || '').trim();
  const text = node.text() || '';

  return { title, content: normalizeWhitespace(text) };
}

function extractChapterLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const anchors: string[] = [];
  const seen = new Set<string>();

  const linkPatterns = [
    /\/txt\/\d+\/\d+/i,
    /\/read\/\d+/i,
    /\/read\/\d+\/p\d+/i,
    /chapter[-_]?(\d+)/i,
    /\/book\/\d+\/\d+/i,
    /\/\d+\.html$/i,
    /\/bookinfo\/\d+\/\d+\.html/i,
    /\?chapter=\d+/i,
    /\/tongren\/\d+\.html/i
  ];

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    if (abs.startsWith('javascript:') || abs.includes('mailto:')) return;
    if (seen.has(abs)) return;
    seen.add(abs);

    for (const rx of linkPatterns) {
      if (rx.test(href) || rx.test(abs)) {
        anchors.push(abs);
        return;
      }
    }

    const text = ($(el).text() || '').trim();
    if (/(第\s*\d+\s*章)|Chapter\s*\d+/i.test(text) && abs.length > 10) {
      anchors.push(abs);
    }
  });

  if (!anchors.length) {
    const containerSelectors = ['.catalog', '.chapter-list', '.chapter-list a', '.mulu', '.list', '.index'];
    for (const s of containerSelectors) {
      $(s).find('a').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const abs = new URL(href, baseUrl).toString();
          if (!anchors.includes(abs)) anchors.push(abs);
        } catch {}
      });
      if (anchors.length) break;
    }
  }

  return anchors;
}

function dedupeUrls(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of arr) {
    try {
      const nu = new URL(u);
      nu.hash = '';
      const key = nu.toString();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(u);
      }
    } catch {
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

function tryGetSiteIndexUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (/twkan\.com/.test(u.host)) {
      const m = u.pathname.match(/\/txt\/(\d+)\/\d+/) || u.pathname.match(/\/book\/(\d+)/);
      if (m) return `${u.protocol}//${u.host}/book/${m[1]}/index.html`;
    }
    if (/biquge\.tw/.test(u.host)) {
      const m = u.pathname.match(/\/book\/(\d+)\.html/);
      if (m) return `${u.protocol}//${u.host}/book/${m[1]}.html`;
    }
    if (/ixdzs\.tw/.test(u.host)) {
      const m = u.pathname.match(/\/read\/(\d+)/);
      if (m) return `${u.protocol}//${u.host}/read/${m[1]}/`;
    }
  } catch {}
  return null;
}

function detectIncrementPattern(url: string): {
  prefix: string;
  current: number;
  suffix: string;
  rawMatch: string;
} | null {
  const patterns = [
    { rx: /(\/txt\/\d+\/)(\d+)(\/?)/i, prefixGroup: 1, numGroup: 2, suffixGroup: 3 },
    { rx: /(\/read\/\d+\/p)(\d+)(\.html?)/i, prefixGroup: 1, numGroup: 2, suffixGroup: 3 },
    { rx: /(\/chapter-)(\d+)([^\/]*)$/i, prefixGroup: 1, numGroup: 2, suffixGroup: 3 },
    { rx: /(\/p)(\d+)([^\/]*)$/i, prefixGroup: 1, numGroup: 2, suffixGroup: 3 },
    { rx: /(\/)(\d+)\.html?$/i, prefixGroup: 1, numGroup: 2, suffixGroup: 0 },
    { rx: /(\/)(\d+)\/?$/i, prefixGroup: 1, numGroup: 2, suffixGroup: 0 }
  ];

  for (const p of patterns) {
    const m = url.match(p.rx);
    if (m) {
      const num = parseInt(m[p.numGroup], 10);
      const prefix = url.slice(0, url.indexOf(m[0])) + (m[p.prefixGroup] || '');
      const suffix = p.suffixGroup && m[p.suffixGroup] ? m[p.suffixGroup] : '';
      return { prefix, current: num, suffix, rawMatch: m[0] };
    }
  }
  return null;
}

function generateFromPattern(
  pattern: { prefix: string; current: number; suffix: string },
  maxChapters: number
): string[] {
  const out: string[] = [];
  for (let i = pattern.current; i < pattern.current + maxChapters; i++) {
    out.push(`${pattern.prefix}${i}${pattern.suffix || ''}`);
  }
  return out;
}

function looksLikeIndex(url: string): boolean {
  try {
    const u = new URL(url);
    if (/index|bookinfo|catalog|mulu|chapterlist|toc|list/i.test(u.pathname))
      return true;
    if (/\/book\/\d+(\/|\.html)?$/i.test(u.pathname)) return true;
  } catch {}
  return false;
}

function pageLooksLikeIndex(html: string): boolean {
  const $ = cheerio.load(html);
  const text = $('body').text().slice(0, 1000);
  if (/章節|章节|目錄|目录|章節目錄/i.test(text)) return true;
  if ($('a').length > 40) return true;
  return false;
}

function pickLargestTextBlock($: CheerioAPI): Cheerio {
  let best: Cheerio | null = null;
  let bestScore = 0;
  $('div, section, article, main').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > bestScore) {
      bestScore = txt.length;
      best = $(el);
    }
  });
  return best as Cheerio;
}

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function readJson(req: NextApiRequest): Promise<any> {
  const chunks: Uint8Array[] = [];
  for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}
