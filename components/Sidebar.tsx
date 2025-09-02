import { useState } from "react";
import { saveHistory, loadHistory } from "../utils/storage";

export default function Sidebar() {
  const [history, setHistory] = useState(loadHistory());

  const clearHistory = () => {
    localStorage.removeItem("urlHistory");
    setHistory([]);
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-2">History</h2>
        <ul>
          {history.map((url, i) => (
            <li key={i} className="text-sm truncate">{url}</li>
          ))}
        </ul>
        <button onClick={clearHistory} className="mt-2 px-2 py-1 text-xs bg-red-500 text-white rounded">
          Clear
        </button>
      </div>
    </div>
  );
}
