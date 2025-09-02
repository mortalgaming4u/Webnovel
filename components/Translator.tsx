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
