import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Reader from "../components/Reader";
import Extractor from "../components/Extractor";
import History from "../components/History";

export default function Home() {
  const [url, setUrl] = useState("");
  const [chapters, setChapters] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  // Save last read
  useEffect(() => {
    if (chapters.length && currentIdx >= 0) {
      localStorage.setItem("lastChapter", JSON.stringify({
        url,
        idx: currentIdx,
      }));
    }
  }, [chapters, currentIdx, url]);

  const scrapeBook = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxChapters: 4000 }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setChapters(data.chapters);
        setCurrentIdx(0);
      } else {
        alert(data.message || "Failed to scrape");
      }
    } catch (e) {
      alert("Error: " + e);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar setUrl={setUrl} scrapeBook={scrapeBook} loading={loading} />
      <main className="flex-1 overflow-y-auto p-4">
        {chapters.length > 0 ? (
          <Reader
            chapters={chapters}
            currentIdx={currentIdx}
            setCurrentIdx={setCurrentIdx}
          />
        ) : (
          <div className="text-gray-500 text-center mt-20">
            <p className="text-xl">📖 Enter a book URL in sidebar</p>
          </div>
        )}
      </main>
      <aside className="w-80 border-l p-4 bg-white overflow-y-auto">
        <Extractor />
        <History setUrl={setUrl} scrapeBook={scrapeBook} />
      </aside>
    </div>
  );
}