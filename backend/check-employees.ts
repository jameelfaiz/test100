/**
 * check-employees.ts — Quick DB inspection + password reset for dev accounts
 * Run: npx tsx backend/check-employees.ts
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User } from "./src/models/User";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";
const BCRYPT_ROUNDS = 12;

const EMPLOYEES = [
  { userId: "fd_emp",     role: "AICTE_FD_EMPLOYEE",  label: "AICTE FD Employee",  dashboard: "/fd/dashboard" },
  { userId: "pgrc_emp",   role: "PGRC_EMPLOYEE",       label: "PGRC Employee",       dashboard: "/pgrc/dashboard" },
  { userId: "vigil_emp1", role: "VIGILANCE_EMPLOYEE",  label: "Vigilance Employee",  dashboard: "/vigilance/dashboard" },
] as const;

function generateStrongPassword(): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const symbols = "@#$!%^&*";
  const all     = upper + lower + digits + symbols;
  const pick    = (c: string, n: number) =>
    Array.from({ length: n }, () => c[crypto.randomInt(c.length)]).join("");
  const raw = pick(upper,2) + pick(lower,5) + pick(digits,4) + pick(symbols,2) + pick(all,5);
  const arr = raw.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to:", MONGO_URI, "\n");

  const records: Array<{ userId: string; label: string; dashboard: string; password: string; action: string }> = [];

  for (const emp of EMPLOYEES) {
    const existing = await User.findOne({ userId: emp.userId }).exec();
    const newPass  = generateStrongPassword();
    const newHash  = await bcrypt.hash(newPass, BCRYPT_ROUNDS);

    if (existing) {
      // RESET password so we have a known dev credential
      await User.updateOne({ userId: emp.userId }, {
        $set: { passwordHash: newHash, accountStatus: "ACTIVE", role: emp.role }
      });
      console.log(`[RESET]  ${emp.userId} (${emp.role}) — password reset.`);
      records.push({ userId: emp.userId, label: emp.label, dashboard: emp.dashboard, password: newPass, action: "PASSWORD RESET" });
    } else {
      await User.create({ userId: emp.userId, passwordHash: newHash, role: emp.role, accountStatus: "ACTIVE", employeeId: emp.userId });
      console.log(`[CREATE] ${emp.userId} (${emp.role}) — account created.`);
      records.push({ userId: emp.userId, label: emp.label, dashboard: emp.dashboard, password: newPass, action: "NEWLY CREATED" });
    }
  }

  // Write local credentials file
  const credPath = path.resolve(__dirname, "..", "EMPLOYEE_CREDENTIALS.local");
  const now = new Date().toISOString();
  const lines = [
    "# ============================================================",
    "# Unified AICTE Portal — Employee Development Credentials",
    "# LOCAL FILE — GITIGNORED — DO NOT SHARE OR COMMIT",
    `# Generated: ${now}`,
    "# ============================================================",
    "",
    "Login URL: http://localhost:3000",
    "",
    ...records.map((r) =>
      [
        `## ${r.label}`,
        `User ID   : ${r.userId}`,
        `Password  : ${r.password}`,
        `Dashboard : http://localhost:3000${r.dashboard}`,
        `Action    : ${r.action}`,
        "",
      ].join("\n")
    ),
  ];
  fs.writeFileSync(credPath, lines.join("\n"), { encoding: "utf8" });
  console.log(`\nCredentials written → ${credPath}`);

  // Verify
  console.log("\n── DB Verification ────────────────────────────────────────────");
  for (const emp of EMPLOYEES) {
    const u = await User.findOne({ userId: emp.userId }).select("userId role accountStatus").exec();
    if (u) console.log(`✔  ${u.userId} | role=${u.role} | status=${u.accountStatus}`);
    else    console.error(`✘  ${emp.userId} NOT FOUND`);
  }

  // Self-test bcrypt
  console.log("\n── bcrypt Self-Test ────────────────────────────────────────────");
  for (const r of records) {
    const u = await User.findOne({ userId: r.userId }).exec();
    const ok = u ? await bcrypt.compare(r.password, u.passwordHash) : false;
    console.log(`${ok ? "✔" : "✘"}  ${r.userId} password verify: ${ok ? "PASS" : "FAIL"}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.\n");
  console.log("=== Credentials (also saved to file) ===");
  for (const r of records) {
    console.log(`${r.label}: ${r.userId} / ${r.password}  → ${r.dashboard}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
