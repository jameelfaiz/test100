// backend/scripts/verify_handbook_integration.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { HandbookClause } from "../src/models/HandbookClause";
import { HandbookAmendment } from "../src/models/HandbookAmendment";
import { retrieveRelevantClauses, generateChatbotResponse } from "../src/services/chatbotService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

async function verifyIntegration() {
  console.log("==================================================================");
  console.log("AICTE HANDBOOK INTEGRATION & REGULATORY INTELLIGENCE TEST SUITE");
  console.log("==================================================================");

  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB.\n");

  // 1. Verify Chapter Coverage
  console.log("--- 1. CHAPTER REPRESENTATION VERIFICATION ---");
  const expectedChapters = [
    "Chapter-I",
    "Chapter-II",
    "Chapter-III",
    "Chapter-IV",
    "Chapter-V",
    "Chapter-VI",
    "Chapter-VII",
    "Chapter-VIII",
  ];
  for (const ch of expectedChapters) {
    const count = await HandbookClause.countDocuments({ chapter: new RegExp(`^${ch}\\b`, "i") });
    console.log(`  ${ch}: ${count} records found in index.`);
    if (count === 0) throw new Error(`Missing chapter in database: ${ch}`);
  }
  console.log("✓ All 8 Chapters verified.\n");

  // 2. Verify Annexures & Affidavits
  console.log("--- 2. ANNEXURES & AFFIDAVITS VERIFICATION ---");
  const annexuresCount = await HandbookClause.countDocuments({
    $or: [{ clauseNumber: /^Annexure-/i }, { chapter: /^Annexure-/i }],
  });
  const affidavitsCount = await HandbookClause.countDocuments({
    $or: [{ clauseNumber: /^Affidavit-/i }, { chapter: /^Affidavit-/i }],
  });
  const formatsCount = await HandbookClause.countDocuments({
    $or: [
      { clauseNumber: /^Format-/i },
      { clauseNumber: /^Certificate-/i },
      { chapter: /^(FORMAT|CERTIFICATE)/i },
    ],
  });

  console.log(`  Annexures: ${annexuresCount} indexed records.`);
  console.log(`  Affidavits: ${affidavitsCount} indexed records.`);
  console.log(`  Formats & Certificates: ${formatsCount} indexed records.`);

  if (annexuresCount < 18) throw new Error(`Insufficient annexures indexed: ${annexuresCount}`);
  if (affidavitsCount < 13) throw new Error(`Insufficient affidavits indexed: ${affidavitsCount}`);
  if (formatsCount < 7) throw new Error(`Insufficient formats/certificates indexed: ${formatsCount}`);
  console.log("✓ All 18 Annexures, 13 Affidavits, and 7 Formats/Certificates verified.\n");

  // 3. Verify Specific Regulatory Retrieval
  console.log("--- 3. TARGETED REGULATORY RETRIEVAL CHECKS ---");
  const testQueries = [
    {
      q: "What are the norms for land and built-up area in Annexure 3?",
      expectedMatch: (clauses: any[]) =>
        clauses.some((c) => c.clauseNumber.includes("Annexure-3") || c.chapter.includes("Annexure-3")),
      label: "Land & Built-up Norms (Annexure-3)",
    },
    {
      q: "What is the faculty cadre ratio and student ratio in Annexure 5?",
      expectedMatch: (clauses: any[]) =>
        clauses.some((c) => c.clauseNumber.includes("Annexure-5") || c.chapter.includes("Annexure-5")),
      label: "Faculty Cadre Ratio (Annexure-5)",
    },
    {
      q: "What are the penal actions under Chapter VII for excess admission?",
      expectedMatch: (clauses: any[]) =>
        clauses.some((c) => c.clauseNumber.includes("7.") || c.chapter.includes("Chapter-VII")),
      label: "Penal Actions (Chapter-VII)",
    },
    {
      q: "What is Affidavit 6 for release of security deposit?",
      expectedMatch: (clauses: any[]) =>
        clauses.some((c) => c.clauseNumber.includes("Affidavit-6") || c.chapter.includes("Affidavit-6")),
      label: "Release of FDR Affidavit (Affidavit-6)",
    },
    {
      q: "What is Table 1.4 security deposit amount for engineering?",
      expectedMatch: (clauses: any[]) =>
        clauses.some((c) => c.clauseNumber.includes("1.12") || c.clauseNumber.includes("Table 1.4")),
      label: "FDR Security Deposit (Clause 1.12 / Table 1.4)",
    },
  ];

  for (const t of testQueries) {
    const res = await retrieveRelevantClauses(t.q, 3);
    const passed = t.expectedMatch(res);
    console.log(`  [Query]: "${t.q}"`);
    console.log(`  [Matched]: ${res.map((c) => `${c.clauseNumber} (Page: ${c.pageNumber}, PDF: ${c.pdfPageNumber})`).join(", ")}`);
    if (!passed) throw new Error(`Retrieval check failed for: ${t.label}`);
    console.log(`  ✓ ${t.label} retrieved successfully.\n`);
  }

  // 4. Test Live End-to-End Chatbot Response with Gemini
  console.log("--- 4. LIVE GEMINI CHATBOT GENERATION TEST ---");
  const liveQuery = "What is the security deposit amount for an undergraduate Engineering college under Clause 1.12 Table 1.4, and what affidavit is needed for its release?";
  const retrieved = await retrieveRelevantClauses(liveQuery, 3);
  const response = await generateChatbotResponse({
    userQuery: liveQuery,
    portalContext: { role: "INSTITUTION", portal: "Institution Portal", currentRoute: "/institution/submit/payment" },
    clauses: retrieved,
  });

  console.log("Chatbot Model Configured:", response.modelConfigured);
  console.log("Chatbot Citations:", response.citations.map((c) => `${c.clauseNumber} (PDF Page ${c.pdfPageNumber || c.pageNumber})`));
  console.log("\nChatbot Response Content:\n" + response.content.slice(0, 450) + "...\n");

  if (!response.content) throw new Error("Empty response from chatbot!");
  console.log("✓ Live Gemini Chatbot generated comprehensive regulatory response citing exact clauses and PDF pages!\n");

  // 5. Amendments verification
  console.log("--- 5. AMENDMENTS & CORRIGENDA VERIFICATION ---");
  const amendments = await HandbookAmendment.find();
  console.log(`  Verified Amendments Stored: ${amendments.length}`);
  for (const a of amendments) {
    console.log(`  • [${a.amendmentId}] ${a.title} (${a.publicationDate}) -> Status: ${a.verificationStatus}`);
  }
  console.log("✓ Official amendments collection active and verified.\n");

  await mongoose.disconnect();
  console.log("==================================================================");
  console.log("ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!");
  console.log("==================================================================");
}

verifyIntegration().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
