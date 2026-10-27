// scratch/test_short_clauses.ts
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

async function check() {
  const buf = fs.readFileSync("resources/handbooks/AICTE_APH_2024_2027.pdf");
  const parser = new PDFParse({ data: buf });
  await parser.load();
  const textResult = await parser.getText();
  const text = typeof textResult === "string" ? textResult : (textResult as any).text;
  const rawPages = text.split(/--\s*(\d+)\s*of\s*231\s*--/);

  for (let i = 1; i < rawPages.length; i += 2) {
    const pageNum = parseInt(rawPages[i]);
    const pt = rawPages[i + 1] || "";
    if (pageNum >= 54 && pageNum <= 59) {
      console.log(`\n=== PAGE ${pageNum} ===`);
      for (const line of pt.split("\n")) {
        const tr = line.trim();
        if (tr.startsWith("4.") || tr.includes("Grant of Approval")) {
          console.log("  LINE:", tr);
        }
      }
    }
  }
}

check();
