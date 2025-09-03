import { useEffect, useState } from "react";

type SidebarProps = {
  setChapterText: (t: string) => void;
  setProgress: (p: number) => void;
};

export default function Sidebar({ setChapterText, setProgress }: SidebarProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [chaptersCount, setChaptersCount] = useState<number | null>(null);

  useEffect(() => {
    const h = JSON.parse(localStorage.getItem("novel_history") || "[]");
    setHistory(Array.isArray(h) ? h : []);
  }, []);

  function addToHistory(u: string) {
    if (!u) return;
    let h = JSON.parse(localStorage.getItem("novel_history") || "[]");
    if (!Array.isArray(h)) h = [];
    if (!h.includes(u)) h.unshift(u);
    if (h.length > 50) h = h.slice(0, 50);
    localStorage.setItem("novel_history", JSON.stringify(h));
    setHistory(h);
  }

  async function extractSingle() {
    if (!url.trim()) return;
    setLoading(true);
    setChapterText("");
    setProgress(0);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const j = await res.json();
      if (j.status === "success") {
        // j.text for single
        setChapterText(j.text || j.content || "");
        setProgress(100);
        addToHistory(url);
      } else {
        setChapterText("⚠️ Extraction error: " + (j.message || "unknown"));
      }
    } catch (e: any) {
      setChapterText("⚠️ Network error: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchFullBook() {
    if (!url.trim()) return;
    setLoading(true);
    setChapterText("");
    setProgress(0);
    try {
      const res = await fetch("/api/scrape-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxChapters: 4000 })
      });
      const j = await res.json();
      if (j.status === "success") {
        // Save chapters locally and set meta
        const key = computeBookKey(url);
        localStorage.setItem(`book:${key}:chapters`, JSON.stringify(j.chapters || []));
        localStorage.setItem(`book:meta:${key}`, JSON.stringify({
          url, title: j.chapters?.[0]?.title || "Book", count: j.chapters?.length || 0
        }));
        setChaptersCount((j.chapters && j.chapters.length) || 0);
        setChapterText((j.chapters && j.chapters[0] && j.chapters[0].content) || "");
        setProgress(1);
        addToHistory(url);
      } else {
        setChapterText("⚠️ Scrape book failed: " + (j.message || "unknown"));
      }
    } catch (e: any) {
      setChapterText("⚠️ Network error: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function computeBookKey(prefix: string) {
    try {
      const u = new URL(prefix);
      return `${u.host}${u.pathname}`.replace(/[^a-z0-9]+/gi, "_");
    } catch {
      return prefix.replace(/[^a-z0-9]+/gi, "_");
    }
  }

  function loadBookLocal(u: string) {
    const key = computeBookKey(u);
    const ch = localStorage.getItem(`book:${key}:chapters`);
    if (!ch) {
      setChapterText("No local cached book found for that URL. Use Fetch Full Book.");
      return;
    }
    try {
      const arr = JSON.parse(ch);
      if (Array.isArray(arr) && arr.length) {
        // load first chapter
        setChapterText(arr[0].content || arr[0].text || "");
        setProgress(1);
      } else {
        setChapterText("Local cached book found but empty.");
      }
    } catch (e) {
      setChapterText("Failed to parse local cached book.");
    }
  }

  return (
    <div className="p-4">
      <div className="mb-3">
        <label className="block text-sm text-gray-600">Book URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://ixdzs.tw/read/38804/  or index page"
          className="w-full p-2 border rounded mt-1"
        />
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={extractSingle} disabled={loading} className="px-3 py-2 bg-brand text-white rounded">
          Extract
        </button>
        <button onClick={fetchFullBook} disabled={loading} className="px-3 py-2 border rounded">
          📚 Fetch Full Book
        </button>
      </div>

      <div className="mb-3 text-sm text-gray-500">
        <div>Chapters cached: {chaptersCount ?? "—"}</div>
        <div className="mt-2">Last operations saved locally in browser.</div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">History</div>
        <div className="h-48 overflow-y-auto border rounded p-2 bg-white">
          {history.length === 0 && <div className="text-xs text-gray-500">No history yet.</div>}
          <ul>
            {history.map((u, i) => (
              <li key={i} className="mb-1">
                <button
                  className="text-left w-full text-sm truncate"
                  onClick={() => { setUrl(u); loadBookLocal(u); }}
                >
                  {u}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-2">
          <button onClick={() => { localStorage.removeItem("novel_history"); setHistory([]); }} className="text-xs text-red-600">
            Clear History
          </button>
        </div>
      </div>
    </div>
  );
}