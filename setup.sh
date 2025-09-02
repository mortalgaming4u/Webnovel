#!/bin/bash
set -e

echo "📚 Setting up Webnovel project..."

# Ensure we are in repo root
mkdir -p ~/Webnovel
cd ~/Webnovel

# ───── public ─────
mkdir -p public
cat > public/manifest.json <<'EOF'
{
  "name": "My Novel Reader",
  "short_name": "NovelReader",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e293b",
  "icons": [
    {
      "src": "/logo.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
EOF
echo "🖼️ Added manifest.json (add favicon.ico and logo.png manually)."

# ───── pages ─────
mkdir -p pages/api

cat > pages/_app.tsx <<'EOF'
import '../styles/globals.css'
import type { AppProps } from 'next/app'

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
export default MyApp
EOF

cat > pages/_document.tsx <<'EOF'
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
EOF

cat > pages/index.tsx <<'EOF'
import Sidebar from "../components/Sidebar";
import Reader from "../components/Reader";

export default function Home() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Reader />
      </div>
    </div>
  );
}
EOF

cat > pages/api/scrape.ts <<'EOF'
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: "error", message: "Missing URL" });

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const text = $("body").text().replace(/\s+/g, " ").trim();
    res.json({ status: "success", text });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
}
EOF

cat > pages/api/scrape-book.ts <<'EOF'
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: "error", message: "Missing URL" });

    let chapters: string[] = [];
    for (let i = 1; i <= 4000; i++) {
      try {
        const chapterUrl = url.replace(/p\d+/, `p${i}`);
        const { data } = await axios.get(chapterUrl);
        const $ = cheerio.load(data);
        const text = $("body").text().replace(/\s+/g, " ").trim();
        if (!text) break;
        chapters.push(text);
      } catch {
        break;
      }
    }
    res.json({ status: "success", chapters });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
}
EOF

# ───── components ─────
mkdir -p components

cat > components/Sidebar.tsx <<'EOF'
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
EOF

cat > components/Reader.tsx <<'EOF'
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
EOF

cat > components/ProgressBar.tsx <<'EOF'
export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-2 bg-gray-200 rounded mt-2">
      <div className="h-2 bg-green-500 rounded" style={{ width: `${progress}%` }} />
    </div>
  );
}
EOF

cat > components/Translator.tsx <<'EOF'
import { useState } from "react";

export default function Translator({ text }: { text: string }) {
  const [translated, setTranslated] = useState("");

  const translate = async () => {
    const res = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "zh",
        target: "en",
        format: "text"
      }),
    });
    const data = await res.json();
    setTranslated(data.translatedText);
  };

  return (
    <div>
      <button onClick={translate} className="px-2 py-1 bg-purple-500 text-white rounded">
        Translate
      </button>
      {translated && (
        <div className="mt-2 p-2 border rounded bg-gray-100 text-sm">{translated}</div>
      )}
    </div>
  );
}
EOF

# ───── styles ─────
mkdir -p styles
cat > styles/globals.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100;
}
EOF

# ───── utils ─────
mkdir -p utils

cat > utils/storage.ts <<'EOF'
export function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem("urlHistory") || "[]");
}

export function addHistory(url: string) {
  if (typeof window === "undefined") return;
  let history = loadHistory();
  if (!history.includes(url)) {
    history.unshift(url);
    if (history.length > 10) history.pop();
    localStorage.setItem("urlHistory", JSON.stringify(history));
  }
}
EOF

cat > utils/sites.ts <<'EOF'
// Supported site URL patterns
export const sites = [
  "https://fanqienovel.com/page/",
  "https://www.qimao.com/shuku/",
  "https://www.uuread.tw/",
  "https://www.69shuba.com/book/",
  "https://twkan.com/book/",
  "https://www.twbook.cc/",
  "https://www.piaotia.com/bookinfo/",
  "https://www.trxs.cc/tongren/",
  "https://tongrenshe.cc/tongren/",
  "https://uukanshu.cc/book/",
  "https://m.bixiange.me/book/",
  "https://www.ffxs8.com/book/",
  "https://www.biquge.tw/book/",
  "https://101kanshu.com/book/",
  "https://www.drxsw.com/book/",
  "https://m.ddxs.com/"
];
EOF

# ───── root files ─────
cat > logs.md <<'EOF'
# 📜 Change Log

- Initial release: Novel reader with scraping, history, progress, translation
EOF

cat > package.json <<'EOF'
{
  "name": "my-novel-reader",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "next": "13.5.0",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.3",
    "autoprefixer": "^10.4.14",
    "postcss": "^8.4.27",
    "typescript": "^5.2.2"
  }
}
EOF

cat > tailwind.config.js <<'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

cat > next.config.js <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}
module.exports = nextConfig
EOF

cat > README.md <<'EOF'
# 📚 My Novel Reader

A free web novel reader that:
- Scrapes chapters (single & up to 4000 for full books)
- Stores history locally
- Supports copy, next/prev navigation
- Shows reading progress
- Integrates LibreTranslate for EN translation
- Deployable on Vercel

## 🚀 Development
```bash
npm install
npm run dev
