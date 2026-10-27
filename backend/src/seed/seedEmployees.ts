// src/seed/seedEmployees.ts

/**
 * Development‑only seed script for employee accounts.
 * It reads DEV_EMP_PASSWORDS from the project .env file, hashes the passwords
 * with bcrypt and upserts three employee records (FD, PGRC, VIGILANCE).
 * Existing employee records are preserved – passwords are only reset when
 * RESET_DEV_PASSWORDS=true.
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { connectDB, closeDB } from "../db";
import { User, Role } from "../models/User";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two levels up from this file).
const envPath = path.resolve(__dirname, "../../..", ".env");
dotenv.config({ path: envPath });

/**
 * Mapping between userId and their role.
 */
const roleMap: Record<string, Role> = {
  fd_emp: "AICTE_FD_EMPLOYEE",
  pgrc_emp: "PGRC_EMPLOYEE",
  vig_emp: "VIGILANCE_EMPLOYEE",
};

// Helper to parse DEV_EMP_PASSWORDS like "fd_emp:fd_emp_pass,pgrc_emp:pgrc_emp_pass,vig_emp:vig_emp_pass"
function parseCredentials(envVar?: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!envVar) return map;
  const pairs = envVar.split(",");
  for (const pair of pairs) {
    const [userId, password] = pair.split(":");
    if (userId && password) {
      map[userId.trim()] = password.trim();
    }
  }
  return map;
}

async function seed() {
  try {
    await connectDB();
    const creds = parseCredentials(process.env.DEV_EMP_PASSWORDS);
    const reset = process.env.RESET_DEV_PASSWORDS === "true";

    for (const [userId, plainPwd] of Object.entries(creds)) {
      const role = roleMap[userId];
      if (!role) {
        console.warn(`⚠️  No role defined for userId ${userId}, skipping.`);
        continue;
      }

      const passwordHash = await bcrypt.hash(plainPwd, 10);
      const existing = await User.findOne({ userId }).exec();

      if (!existing) {
        // Create new employee record
        await User.create({
          userId,
          passwordHash,
          role,
          accountStatus: "ACTIVE",
        });
        console.log(`🟢 Created employee ${userId} (${role})`);
      } else {
        if (reset) {
          existing.passwordHash = passwordHash;
          existing.role = role;
          existing.accountStatus = "ACTIVE";
          await existing.save();
          console.log(`🔄 Updated password for employee ${userId}`);
        } else {
          console.log(`✅ Employee ${userId} already exists – unchanged`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Seed script failed:", err);
    process.exitCode = 1;
  } finally {
    // Close the mongoose connection gracefully.
    await closeDB();
    process.exit();
  }
}

seed();
