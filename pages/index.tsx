import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Reader from "../components/Reader";

export default function Home() {
  const [chapterText, setChapterText] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200">
        <Sidebar setChapterText={setChapterText} setProgress={setProgress} />
      </div>

      {/* Reader */}
      <div className="flex-1 p-4 overflow-y-auto">
        <Reader
          chapterText={chapterText}
          progress={progress}
          setChapterText={setChapterText}
          setProgress={setProgress}
        />
      </div>
    </div>
  );
}