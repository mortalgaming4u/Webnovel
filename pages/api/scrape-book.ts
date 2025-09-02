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
