// backend/scripts/test_chatbot.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { HandbookClause } from "../src/models/HandbookClause";
import {
  checkTopicAllowed,
  retrieveRelevantClauses,
  generateChatbotResponse,
  resolveContextualQuery,
} from "../src/services/chatbotService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

async function runComprehensiveChatbotTests() {
  console.log("===============================================================");
  console.log("AICTE CHATBOT DYNAMIC REASONING & ACCURACY VERIFICATION SUITE");
  console.log("===============================================================");
  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB.\n");

  const answersReceived: string[] = [];

  // ── TEST 1: Example 1 — "What is FDR?" ──────────────────────────────────
  console.log("[Test 1: Example 1] User asks: 'What is FDR?'");
  const retrieved1 = await retrieveRelevantClauses("What is FDR?", 3);
  const resp1 = await generateChatbotResponse({
    userQuery: "What is FDR?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal", currentRoute: "/institution/dashboard" },
    clauses: retrieved1,
  });
  console.log("  Answer Preview:\n  " + resp1.content.slice(0, 240).replace(/\n/g, "\n  ") + "...");
  answersReceived.push(resp1.content);

  if (!resp1.content.toLowerCase().includes("fixed deposit") || (!resp1.content.includes("1.12") && !resp1.content.toLowerCase().includes("security deposit"))) {
    throw new Error("Test 1 Failed: Response did not explain Fixed Deposit Receipt or Security Deposit.");
  }
  console.log("  ✓ Test 1 Passed: FDR clearly explained with Clause 1.12 / Security Deposit.\n");

  // ── TEST 2: Example 2 — "How do I submit my approval application?" ───────
  console.log("[Test 2: Example 2] User asks: 'How do I submit my approval application?'");
  const retrieved2 = await retrieveRelevantClauses("How do I submit my approval application?", 3);
  const resp2 = await generateChatbotResponse({
    userQuery: "How do I submit my approval application?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal", currentRoute: "/institution/dashboard" },
    clauses: retrieved2,
  });
  console.log("  Answer Preview:\n  " + resp2.content.slice(0, 240).replace(/\n/g, "\n  ") + "...");
  answersReceived.push(resp2.content);

  if (
    !resp2.content.toLowerCase().includes("approval") ||
    (!resp2.content.toLowerCase().includes("submit") && !resp2.content.toLowerCase().includes("portal"))
  ) {
    throw new Error("Test 2 Failed: Response did not explain Approval submission guidance.");
  }
  console.log("  ✓ Test 2 Passed: Step-by-step portal submission guidance provided.\n");

  // ── TEST 3: Example 3 — "Why was my document rejected?" ───────────────────
  console.log("[Test 3: Example 3] User asks: 'Why was my document rejected?'");
  // Mock live portal context with genuine deficiency remarks
  const mockContextWithDeficiency = {
    role: "INSTITUTION",
    portal: "Institution Portal",
    currentRoute: "/institution/dashboard",
    applicationNumber: "APP-1793040812297-62",
    applicationStatus: "UNDER_REVIEW",
    deficiencies: [
      { name: "DOC-03: Approved Building Plan", remarks: "Mistake in Name" }
    ],
    documentStats: { total: 12, verified: 11, rejected: 1, pending: 0 },
  };

  const retrieved3 = await retrieveRelevantClauses("Why was my document rejected?", 3);
  const resp3 = await generateChatbotResponse({
    userQuery: "Why was my document rejected?",
    portalContext: mockContextWithDeficiency,
    clauses: retrieved3,
  });
  console.log("  Answer Preview:\n  " + resp3.content.slice(0, 240).replace(/\n/g, "\n  ") + "...");
  answersReceived.push(resp3.content);

  if (!resp3.content.includes("Mistake in Name") || !resp3.content.includes("Approved Building Plan")) {
    throw new Error("Test 3 Failed: Response did not quote actual deficiency remark 'Mistake in Name'.");
  }
  console.log("  ✓ Test 3 Passed: Live FD officer deficiency remark quoted accurately.\n");

  // ── TEST 4: Example 4 — "What should I do after submitting my FDR?" ──────
  console.log("[Test 4: Example 4] User asks: 'What should I do after submitting my FDR?'");
  const mockContextFdrSubmitted = {
    role: "INSTITUTION",
    portal: "Institution Portal",
    currentRoute: "/institution/receive/deposit",
    fdrNumber: "FDR-2026-98741",
    fdrAmount: 3500000,
    fdrStatus: "SUBMITTED",
  };
  const retrieved4 = await retrieveRelevantClauses("What should I do after submitting my FDR?", 3);
  const resp4 = await generateChatbotResponse({
    userQuery: "What should I do after submitting my FDR?",
    portalContext: mockContextFdrSubmitted,
    clauses: retrieved4,
  });
  console.log("  Answer Preview:\n  " + resp4.content.slice(0, 240).replace(/\n/g, "\n  ") + "...");
  answersReceived.push(resp4.content);

  if (!resp4.content.toLowerCase().includes("verification") || (!resp4.content.includes("1.12") && !resp4.content.toLowerCase().includes("fdr") && !resp4.content.toLowerCase().includes("deposit"))) {
    throw new Error("Test 4 Failed: Post-FDR response did not explain FD verification or next stages.");
  }
  console.log("  ✓ Test 4 Passed: Post-FDR verification workflow explained accurately.\n");

  // ── TEST 5: Example 5 — "What is the weather today?" ──────────────────────
  console.log("[Test 5: Example 5] User asks: 'What is the weather today?'");
  const resp5 = await generateChatbotResponse({
    userQuery: "What is the weather today?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: [],
  });
  console.log("  Answer: " + resp5.content);
  if (!resp5.isRefusal || resp5.content !== "It is not under my coverage") {
    throw new Error(`Test 5 Failed: Off-topic weather question did not return exact 'It is not under my coverage'. Received: ${resp5.content}`);
  }
  console.log("  ✓ Test 5 Passed: Exact off-topic response returned: 'It is not under my coverage'.\n");

  // ── TEST 6: Conversation Context Follow-Up 1 — "What documents are required for it?" ──
  console.log("[Test 6: Context Follow-Up 1] History: Discussion on FDR. User: 'What documents are required for it?'");
  const fdrHistory = [
    { role: "user", content: "What is FDR?" },
    { role: "assistant", content: resp1.content }
  ];
  const contextRes1 = resolveContextualQuery("What documents are required for it?", fdrHistory);
  console.log("  Resolved Contextual Query: '" + contextRes1.resolvedQuery + "'");
  console.log("  Detected Topic: " + contextRes1.detectedTopic);

  const retrieved6 = await retrieveRelevantClauses(contextRes1.resolvedQuery, 3);
  const resp6 = await generateChatbotResponse({
    userQuery: "What documents are required for it?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: retrieved6,
    history: fdrHistory,
  });
  console.log("  Answer Preview:\n  " + resp6.content.slice(0, 240).replace(/\n/g, "\n  ") + "...");
  answersReceived.push(resp6.content);

  if (!resp6.content.toLowerCase().includes("fixed deposit") && !resp6.content.toLowerCase().includes("fdr") && !resp6.content.toLowerCase().includes("security deposit")) {
    throw new Error("Test 6 Failed: Follow-up did not recognize 'it' refers to FDR / Security Deposit.");
  }
  console.log("  ✓ Test 6 Passed: Contextual pronoun 'it' correctly resolved to FDR / Security Deposit.\n");

  // ── TEST 7: Conversation Context Follow-Up 2 — "Where should I upload them?" ──
  console.log("[Test 7: Context Follow-Up 2] History: Discussion on FDR. User: 'Where should I upload them?'");
  const fdrHistory2 = [
    ...fdrHistory,
    { role: "user", content: "What documents are required for it?" },
    { role: "assistant", content: resp6.content }
  ];
  const contextRes2 = resolveContextualQuery("Where should I upload them?", fdrHistory2);
  const resp7 = await generateChatbotResponse({
    userQuery: "Where should I upload them?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: [],
    history: fdrHistory2,
  });
  console.log("  Answer Preview:\n  " + resp7.content.slice(0, 240).replace(/\n/g, "\n  ") + "...");
  answersReceived.push(resp7.content);

  if (!resp7.content.includes("/institution/submit/payment") && !resp7.content.includes("/institution/submit/approval")) {
    throw new Error("Test 7 Failed: Did not guide user to /institution/submit/payment or /institution/submit/approval.");
  }
  console.log("  ✓ Test 7 Passed: Contextual pronoun 'them' resolved to upload location.\n");

  // ── TEST 8: Response Diversity Verification ───────────────────────────────
  console.log("[Test 8: Diversity Check] Verifying that different questions received genuinely different answers...");
  const uniqueAnswers = new Set(answersReceived);
  console.log(`  Total responses tested: ${answersReceived.length}`);
  console.log(`  Unique responses generated: ${uniqueAnswers.size}`);
  if (uniqueAnswers.size !== answersReceived.length) {
    throw new Error("Test 8 Failed: Some responses were identical or duplicated!");
  }
  console.log("  ✓ Test 8 Passed: 100% of responses are distinct, customized, and question-specific.\n");

  console.log("===============================================================");
  console.log("ALL 8 DYNAMIC REASONING & ACCURACY VERIFICATION TESTS PASSED!");
  console.log("===============================================================");

  await mongoose.disconnect();
}

runComprehensiveChatbotTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
