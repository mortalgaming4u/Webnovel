import { useState } from "react";
import ProgressBar from "./ProgressBar";
import Translator from "./Translator";
import { addHistory } from "../utils/storage";

export default function Reader() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(0);

  const fetchChapter = async () => {
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.status === "success") {
      setText(data.text);
      addHistory(url);
      setProgress((prev) => Math.min(prev + 1, 100));
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4">
      <div className="flex gap-2 mb-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter chapter URL"
          className="flex-1 p-2 border rounded"
        />
        <button onClick={fetchChapter} className="px-3 py-2 bg-blue-500 text-white rounded">
          Fetch
        </button>
      </div>
      <textarea
        value={text}
        readOnly
        className="flex-1 border rounded p-2 text-sm resize-none overflow-y-scroll"
      />
      <div className="flex justify-between items-center mt-2">
        <button
          onClick={() => navigator.clipboard.writeText(text)}
          className="px-3 py-1 bg-gray-700 text-white rounded"
        >
          Copy
        </button>
        <Translator text={text} />
      </div>
      <ProgressBar progress={progress} />
    </div>
  );
}
