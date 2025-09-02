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
