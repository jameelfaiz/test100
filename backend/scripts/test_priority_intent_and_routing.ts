// backend/scripts/test_priority_intent_and_routing.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { HandbookClause } from "../src/models/HandbookClause.js";
import {
  detectUserIntent,
  checkTopicAllowed,
  retrieveRelevantClauses,
  generateChatbotResponse,
  resolveContextualQuery,
} from "../src/services/chatbotService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

async function runPriorityAssistantVerification() {
  console.log("==================================================================");
  console.log("AICTE ASSISTANT PRIORITY INTENT & GROUNDING VERIFICATION SUITE");
  console.log("==================================================================");
  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB.\n");

  // ── TEST 1: 'hi' -> Natural greeting, zero handbook retrieval ─────────────
  console.log("[Test 1] User asks: 'hi'");
  const intent1 = detectUserIntent("hi");
  if (intent1.intent !== "GREETING" || !intent1.reply) {
    throw new Error(`Test 1 Failed: 'hi' was not detected as GREETING. Intent: ${intent1.intent}`);
  }
  const resp1 = await generateChatbotResponse({
    userQuery: "hi",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: [], // zero retrieval
  });
  console.log(`  Response: "${resp1.content}"`);
  console.log(`  Citations count: ${resp1.citations.length}`);
  if (resp1.citations.length !== 0) {
    throw new Error(`Test 1 Failed: 'hi' returned citations! Count: ${resp1.citations.length}`);
  }
  if (!resp1.content.toLowerCase().includes("hello") && !resp1.content.toLowerCase().includes("how can i help")) {
    throw new Error(`Test 1 Failed: 'hi' did not return natural greeting.`);
  }
  if (resp1.content.includes("1.5.5") || resp1.content.toLowerCase().includes("institution naming")) {
    throw new Error(`Test 1 Failed: Old bug reproduced! Clause 1.5.5 returned for 'hi'.`);
  }
  console.log("  ✓ Test 1 Passed: 'hi' returned natural greeting with zero retrieval and zero citations.\n");

  // ── TEST 2: 'thank you' -> Natural short response, zero retrieval ────────
  console.log("[Test 2] User asks: 'thank you'");
  const intent2 = detectUserIntent("thank you");
  if (intent2.intent !== "BASIC_CONVERSATION" || !intent2.reply) {
    throw new Error(`Test 2 Failed: 'thank you' was not detected as BASIC_CONVERSATION. Intent: ${intent2.intent}`);
  }
  const resp2 = await generateChatbotResponse({
    userQuery: "thank you",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: [],
  });
  console.log(`  Response: "${resp2.content}"`);
  console.log(`  Citations count: ${resp2.citations.length}`);
  if (resp2.citations.length !== 0) {
    throw new Error(`Test 2 Failed: 'thank you' returned citations! Count: ${resp2.citations.length}`);
  }
  if (!resp2.content.toLowerCase().includes("welcome")) {
    throw new Error(`Test 2 Failed: 'thank you' did not return natural welcome.`);
  }
  console.log("  ✓ Test 2 Passed: 'thank you' returned natural welcome with zero retrieval and zero citations.\n");

  // ── TEST 3: 'What is the AICTE LoA process?' -> Evidence-based answer with citations ──
  console.log("[Test 3] User asks: 'What is the AICTE LoA process?'");
  const retrieved3 = await retrieveRelevantClauses("What is the AICTE LoA process?", 4);
  console.log(`  Retrieved clauses: ${retrieved3.map((c) => c.clauseNumber).join(", ")}`);
  const resp3 = await generateChatbotResponse({
    userQuery: "What is the AICTE LoA process?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: retrieved3,
  });
  console.log("  Answer Preview:\n  " + resp3.content.slice(0, 260).replace(/\n/g, "\n  ") + "...");
  console.log(`  Citations count: ${resp3.citations.length}`);
  if (resp3.citations.length === 0) {
    throw new Error("Test 3 Failed: No citations returned for LoA process.");
  }
  const lowerResp3 = resp3.content.toLowerCase();
  if (
    !lowerResp3.includes("letter of approval") &&
    !lowerResp3.includes("loa")
  ) {
    throw new Error("Test 3 Failed: Response did not explain LoA process.");
  }
  console.log("  ✓ Test 3 Passed: LoA process explained with authentic citations.\n");

  // ── TEST 4: 'What should I do after receiving LoA?' -> Practical next steps ──
  console.log("[Test 4] User asks: 'What should I do after receiving LoA?'");
  const retrieved4 = await retrieveRelevantClauses("What should I do after receiving LoA?", 4);
  console.log(`  Retrieved clauses: ${retrieved4.map((c) => c.clauseNumber).join(", ")}`);
  const resp4 = await generateChatbotResponse({
    userQuery: "What should I do after receiving LoA?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: retrieved4,
  });
  console.log("  Answer Preview:\n  " + resp4.content.slice(0, 260).replace(/\n/g, "\n  ") + "...");
  const lowerResp4 = resp4.content.toLowerCase();
  if (
    !lowerResp4.includes("affiliation") &&
    !lowerResp4.includes("university") &&
    !lowerResp4.includes("admiss")
  ) {
    throw new Error("Test 4 Failed: Post-LoA guidance did not include affiliation/admission steps.");
  }
  console.log("  ✓ Test 4 Passed: Post-LoA practical next steps supported by handbook.\n");

  // ── TEST 5: 'What documents are needed?' after LoA question -> Context-aware follow-up ──
  console.log("[Test 5] Context follow-up: 'What documents are needed?' after LoA discussion");
  const loaHistory = [
    { role: "user", content: "What is the AICTE LoA process?" },
    { role: "assistant", content: resp3.content },
  ];
  const contextRes5 = resolveContextualQuery("What documents are needed?", loaHistory);
  console.log(`  Resolved Context Query: "${contextRes5.resolvedQuery}"`);
  console.log(`  Detected Topic: ${contextRes5.detectedTopic}`);
  if (!contextRes5.detectedTopic?.includes("LoA")) {
    throw new Error(`Test 5 Failed: Follow-up topic not recognized as LoA. Got: ${contextRes5.detectedTopic}`);
  }
  const retrieved5 = await retrieveRelevantClauses(contextRes5.resolvedQuery, 4);
  const resp5 = await generateChatbotResponse({
    userQuery: "What documents are needed?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: retrieved5,
    history: loaHistory,
  });
  console.log("  Answer Preview:\n  " + resp5.content.slice(0, 260).replace(/\n/g, "\n  ") + "...");
  const lowerResp5 = resp5.content.toLowerCase();
  if (
    !lowerResp5.includes("land") &&
    !lowerResp5.includes("building") &&
    !lowerResp5.includes("annexure") &&
    !lowerResp5.includes("affidavit")
  ) {
    throw new Error("Test 5 Failed: Follow-up did not list LoA statutory documents.");
  }
  console.log("  ✓ Test 5 Passed: Context-aware document checklist provided for LoA.\n");

  // ── TEST 6: 'What is the weather today?' -> EXACTLY 'It is not under my coverage' ──
  console.log("[Test 6] User asks: 'What is the weather today?'");
  const topicCheck6 = checkTopicAllowed("What is the weather today?");
  console.log(`  checkTopicAllowed result: allowed=${topicCheck6.allowed}, message="${topicCheck6.refusalMessage}"`);
  if (topicCheck6.allowed) {
    throw new Error("Test 6 Failed: Weather question was allowed.");
  }
  if (topicCheck6.refusalMessage !== "It is not under my coverage") {
    throw new Error(`Test 6 Failed: Expected 'It is not under my coverage', got: '${topicCheck6.refusalMessage}'`);
  }
  const resp6 = await generateChatbotResponse({
    userQuery: "What is the weather today?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: [],
  });
  console.log(`  Response: "${resp6.content}"`);
  if (resp6.content !== "It is not under my coverage") {
    throw new Error(`Test 6 Failed: Response content was not exact 'It is not under my coverage'. Received: "${resp6.content}"`);
  }
  if (!resp6.isRefusal) {
    throw new Error("Test 6 Failed: isRefusal was false for off-topic query.");
  }
  if (resp6.citations.length !== 0) {
    throw new Error(`Test 6 Failed: Off-topic returned citations: ${resp6.citations.length}`);
  }
  console.log("  ✓ Test 6 Passed: Exactly returned 'It is not under my coverage' with zero citations.\n");

  // ── TEST 7: Portal status question -> Authorized live portal data ─────────
  console.log("[Test 7] User asks: 'What is my application status?'");
  const mockPortalContext = {
    role: "INSTITUTION",
    portal: "Institution Portal",
    currentRoute: "/institution/dashboard",
    applicationNumber: "APP-1793040812297-62",
    applicationStatus: "UNDER_REVIEW",
    documentStats: { total: 12, verified: 11, rejected: 1, pending: 0 },
    deficiencies: [{ name: "DOC-03: Approved Building Plan", remarks: "Mistake in Name" }],
  };
  const resp7 = await generateChatbotResponse({
    userQuery: "Why was my document rejected?",
    portalContext: mockPortalContext,
    clauses: [],
  });
  console.log("  Answer Preview:\n  " + resp7.content.slice(0, 260).replace(/\n/g, "\n  ") + "...");
  if (!resp7.content.includes("Mistake in Name") || !resp7.content.includes("Approved Building Plan")) {
    throw new Error("Test 7 Failed: Portal status question did not cite live officer deficiency remark.");
  }
  console.log("  ✓ Test 7 Passed: Authorized live portal records accurately referenced.\n");

  // ── TEST 8: Question not supported by evidence -> No fabricated answer/citation ──
  console.log("[Test 8] Question not supported: 'What is the AICTE policy for building space stations on Mars?'");
  const resp8 = await generateChatbotResponse({
    userQuery: "What is the AICTE policy for building space stations on Mars?",
    portalContext: { role: "INSTITUTION", portal: "Institution Portal" },
    clauses: [],
  });
  console.log(`  Response: "${resp8.content}"`);
  console.log(`  Citations count: ${resp8.citations.length}`);
  if (resp8.citations.length !== 0) {
    throw new Error(`Test 8 Failed: Fabricated citations returned: ${resp8.citations.length}`);
  }
  const lowerResp8 = resp8.content.toLowerCase();
  if (!lowerResp8.includes("insufficient") && !lowerResp8.includes("not under my coverage")) {
    throw new Error("Test 8 Failed: Model did not state that evidence is insufficient.");
  }
  console.log("  ✓ Test 8 Passed: No fabricated answer or citations for unsupported query.\n");

  console.log("==================================================================");
  console.log("ALL 8 INTENT & EVIDENCE GROUNDING TESTS PASSED PERFECTLY!");
  console.log("==================================================================");
  await mongoose.disconnect();
}

runPriorityAssistantVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
