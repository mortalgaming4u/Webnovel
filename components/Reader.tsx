import { useEffect, useState } from "react";
import ProgressBar from "./ProgressBar";
import { Chap } from "../type/chap"; // ← import reusable type

type ReaderProps = {
  chapterText: string;
  progress: number;
  setChapterText: (t: string) => void;
  setProgress: (p: number) => void;
};

export default function Reader({ chapterText, setChapterText, progress, setProgress }: ReaderProps) {
  const [wordCount, setWordCount] = useState(0);
  const [localChapters, setLocalChapters] = useState<Chap[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [bookKey, setBookKey] = useState<string | null>(null);

  useEffect(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("book:meta:"));
    if (keys.length) {
      const meta = JSON.parse(localStorage.getItem(keys[0]) || "{}");
      const key = keys[0].replace("book:meta:", "");
      setBookKey(key);
      const arr = JSON.parse(localStorage.getItem(`book:${key}:chapters`) || "[]");
      setLocalChapters(Array.isArray(arr) ? arr : []);
      setCurrentIdx(meta?.lastChapterIndex ?? 0);
      if (Array.isArray(arr) && arr[0]) {
        setChapterText(arr[0].content || arr[0].text || "");
      }
    }
  }, []);

  useEffect(() => {
    const n = (chapterText || "").trim().split(/\s+/).filter(Boolean).length;
    setWordCount(n);
  }, [chapterText]);

  function copyText() {
    navigator.clipboard.writeText(chapterText || "");
    alert("Copied to clipboard");
  }

  async function translateNow() {
    if (!chapterText) return;
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: chapterText, source: "auto", target: "en" })
      });
      const j = await res.json();
      if (j.status === "success") {
        setChapterText(j.translatedText || j.translated || "");
      } else {
        alert("Translate failed: " + (j.message || "unknown"));
      }
    } catch (e: any) {
      alert("Translate error: " + (e?.message || e));
    }
  }

  function loadLocalChapter(i: number) {
    if (!localChapters || !localChapters[i]) return;
    setCurrentIdx(i);
    setChapterText(localChapters[i].content || localChapters[i].text || "");
    setProgress(Math.round(((i + 1) / localChapters.length) * 100));
    if (bookKey) {
      const meta = JSON.parse(localStorage.getItem(`book:meta:${bookKey}`) || "{}");
      meta.lastChapterIndex = i;
      localStorage.setItem(`book:meta:${bookKey}`, JSON.stringify(meta));
    }
  }

  function prev() {
    if (localChapters.length && currentIdx > 0) loadLocalChapter(currentIdx - 1);
  }

  function next() {
    if (localChapters.length && currentIdx < localChapters.length - 1) loadLocalChapter(currentIdx + 1);
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-xl font-semibold">Reader</h2>
          <div className="text-sm text-gray-500">{wordCount} words</div>
        </div>
        <div className="flex gap-2">
          <button onClick={copyText} className="px-3 py-2 border rounded">Copy</button>
          <button onClick={translateNow} className="px-3 py-2 bg-brand text-white rounded">Translate EN</button>
        </div>
      </div>

      <div className="reader-box mb-3" id="readerBox" style={{ minHeight: 320 }}>
        <pre id="chapterContent" className="whitespace-pre-wrap">
          {chapterText || "No content. Use the sidebar to extract or fetch a book."}
        </pre>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={prev} className="px-3 py-2 border rounded">◀ Prev</button>
        <button onClick={next} className="px-3 py-2 border rounded">Next ▶</button>
        <div className="flex-1">
          <ProgressBar percent={progress} />
        </div>
      </div>

      {localChapters.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Chapters</div>
          <div className="h-48 overflow-y-auto border rounded p-2 bg-white">
            <ul>
              {localChapters.map((c, i) => (
                <li
                  key={i}
                  className={`cursor-pointer text-sm py-1 ${i === currentIdx ? "font-semibold" : ""}`}
                  onClick={() => loadLocalChapter(i)}
                >
                  {c.title || `Chapter ${c.idx || i + 1}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
