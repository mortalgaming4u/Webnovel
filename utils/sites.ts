/**
 * site rules mapping - add more patterns/selectors as you discover per-site structure.
 * The scraper API uses heuristics; this file can be referenced by future server-side improvements.
 */
export type SiteRule = {
  hostPattern: RegExp;
  indexSelectors?: string[]; // selectors to find chapter links on index pages
  chapterSelectors?: string[]; // selectors to extract chapter content
};

const rules: SiteRule[] = [
  {
    hostPattern: /twkan\.com/i,
    indexSelectors: [".mulu", ".chapter-list", ".list", ".chapter-list a"],
    chapterSelectors: ["#BookText", "#content", ".readarea", ".chapter"]
  },
  {
    hostPattern: /ixdzs\.tw/i,
    indexSelectors: [".catalog", ".chapters", ".chapter-list"],
    chapterSelectors: ["#chapterContent", ".main-text", ".read-content"]
  },
  {
    hostPattern: /biquge\.tw/i,
    indexSelectors: [".booklist", ".chapter-list"],
    chapterSelectors: ["#content", ".content"]
  }
];

export default rules;