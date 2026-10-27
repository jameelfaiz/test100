// src/seed/seedHandbook.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { HandbookClause } from "../models/HandbookClause";
import { OFFICIAL_HANDBOOK_CLAUSES } from "./handbookData";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

export async function seedHandbookDatabase() {
  console.log("Connecting to MongoDB for AICTE Handbook Seeding...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB successfully.");

  let upsertedCount = 0;
  for (const clauseData of OFFICIAL_HANDBOOK_CLAUSES) {
    await HandbookClause.findOneAndUpdate(
      { clauseNumber: clauseData.clauseNumber, year: clauseData.year },
      { $set: clauseData },
      { upsert: true, new: true }
    );
    upsertedCount++;
  }

  const totalInDb = await HandbookClause.countDocuments();
  console.log(
    `AICTE Handbook Ingestion Complete. Upserted ${upsertedCount} clauses. Total in database: ${totalInDb}.`
  );

  return totalInDb;
}

if (process.argv[1] && process.argv[1].endsWith("seedHandbook.ts")) {
  seedHandbookDatabase()
    .then((count) => {
      console.log(`Seeding finished with ${count} verified handbook records.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding error:", err);
      process.exit(1);
    });
}
