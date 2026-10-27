import mongoose from "mongoose";
import { HandbookClause } from "../src/models/HandbookClause.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const clauses = await HandbookClause.find({
    clauseNumber: { $regex: /^Clause 1\./ }
  }).select("clauseNumber title chapter pageNumber pdfPageNumber requirementType").sort({ clauseNumber: 1 });

  console.log("Chapter 1 clauses count:", clauses.length);
  for (const c of clauses) {
    console.log(`- [${c.clauseNumber}] "${c.title}" (Page ${c.pageNumber}, PDF ${c.pdfPageNumber})`);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
