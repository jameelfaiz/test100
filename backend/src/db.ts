// src/db.ts
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate and load existing .env file containing MONGODB_URI
const possibleEnvPaths = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), ".env"),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

export const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return { ok: true } as const;
    }
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
    return { ok: true } as const;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    return { ok: false, error: err } as const;
  }
};

export const closeDB = async () => {
  await mongoose.disconnect();
  console.log('MongoDB connection closed');
};

export const getDBStatus = () => {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
};
