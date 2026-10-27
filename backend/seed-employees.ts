/**
 * seed-employees.ts
 * Creates/verifies the three standard employee accounts for the Unified AICTE Portal.
 * Generates strong unique passwords, hashes them with bcrypt, writes a local-only
 * credentials file (excluded from Git), and never stores plaintext passwords in MongoDB.
 *
 * Usage:  npx tsx backend/seed-employees.ts
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User } from "./src/models/User";

// ESM-safe __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

// ── Employees to provision ────────────────────────────────────────────────────
const EMPLOYEES = [
  {
    userId: "fd_emp",
    role: "AICTE_FD_EMPLOYEE" as const,
    label: "AICTE FD Employee",
    dashboard: "/fd/dashboard",
  },
  {
    userId: "pgrc_emp",
    role: "PGRC_EMPLOYEE" as const,
    label: "PGRC Employee",
    dashboard: "/pgrc/dashboard",
  },
  {
    userId: "vigil_emp1",
    role: "VIGILANCE_EMPLOYEE" as const,
    label: "Vigilance Employee",
    dashboard: "/vigilance/dashboard",
  },
];

const BCRYPT_ROUNDS = 12;

/** Generate a cryptographically strong 18-char password: letters + digits + symbols */
function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$!%^&*";
  const all = upper + lower + digits + symbols;

  const pick = (charset: string, n: number) =>
    Array.from({ length: n }, () =>
      charset[crypto.randomInt(charset.length)]
    ).join("");

  // Guarantee at least one of each class, then fill the rest
  const password =
    pick(upper, 2) +
    pick(lower, 5) +
    pick(digits, 4) +
    pick(symbols, 2) +
    pick(all, 5);

  // Fisher-Yates shuffle
  const arr = password.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

async function main() {
  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log("Connected.\n");

  const results: Array<{
    userId: string;
    label: string;
    dashboard: string;
    password: string;
    action: "created" | "already_exists";
  }> = [];

  for (const emp of EMPLOYEES) {
    const existing = await User.findOne({ userId: emp.userId }).exec();

    if (existing) {
      console.log(
        `[SKIP]  ${emp.userId} already exists (role: ${existing.role}). Skipping creation.`
      );
      // Mark as already_exists with a placeholder — actual password NOT shown for existing accounts
      results.push({
        userId: emp.userId,
        label: emp.label,
        dashboard: emp.dashboard,
        password: "<existing — not changed>",
        action: "already_exists",
      });
      continue;
    }

    // Generate and hash password
    const plainPassword = generateStrongPassword();
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

    await User.create({
      userId: emp.userId,
      passwordHash,
      role: emp.role,
      accountStatus: "ACTIVE",
      employeeId: emp.userId,
    });

    console.log(`[CREATE] ${emp.userId} (${emp.role}) — account created.`);
    results.push({
      userId: emp.userId,
      label: emp.label,
      dashboard: emp.dashboard,
      password: plainPassword,
      action: "created",
    });
  }

  // ── Write credentials file (local only, gitignored) ──────────────────────
  // __dirname = backend/, so go up one level to project root
  const credentialsDir = path.resolve(__dirname, "..");
  const credentialsPath = path.join(credentialsDir, "EMPLOYEE_CREDENTIALS.local");

  const now = new Date().toISOString();
  const lines = [
    "# Unified AICTE Portal — Employee Credentials",
    "# LOCAL DEVELOPMENT FILE — DO NOT COMMIT",
    `# Generated: ${now}`,
    "",
    "Login URL: http://localhost:3000",
    "",
    ...results.map((r) => [
      `## ${r.label}`,
      `User ID   : ${r.userId}`,
      `Password  : ${r.password}`,
      `Dashboard : http://localhost:3000${r.dashboard}`,
      `Status    : ${r.action === "created" ? "NEWLY CREATED" : "ALREADY EXISTS (password unchanged)"}`,
      "",
    ].join("\n")),
  ];

  fs.writeFileSync(credentialsPath, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  console.log(`\nCredentials written to: ${credentialsPath}`);

  // ── Self-verify: re-read each account from DB ─────────────────────────────
  console.log("\n── Verification ──────────────────────────────────────────────");
  for (const emp of EMPLOYEES) {
    const u = await User.findOne({ userId: emp.userId }).exec();
    if (u) {
      console.log(`✔  ${emp.userId} | role=${u.role} | status=${u.accountStatus}`);
    } else {
      console.error(`✘  ${emp.userId} NOT FOUND in database!`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
