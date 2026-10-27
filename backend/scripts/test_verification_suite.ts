import mongoose from 'mongoose';
import {
  detectUserIntent,
  retrieveRelevantClauses,
  generateChatbotResponse,
  resolveUserPortalContext,
  resolveContextualQuery
} from '../src/services/chatbotService.js';

interface TestCase {
  id: number;
  name: string;
  query: string;
  history?: Array<{ role: string; content: string }>;
  clientContext?: any;
  userRole?: string;
  userId?: string;
}

const testCases: TestCase[] = [
  {
    id: 1,
    name: "Scenario 1: 'hi' -> Natural greeting; no retrieval",
    query: "hi",
  },
  {
    id: 2,
    name: "Scenario 2: 'I have one doubt' -> Conversational reply; no irrelevant citations",
    query: "I have one doubt",
  },
  {
    id: 3,
    name: "Scenario 3: FDR maturity question -> Useful, evidence-grounded release/withholding explanation",
    query: "when the maturity fund would not back to the institution",
  },
  {
    id: 4,
    name: "Scenario 4: EoD versus EoA -> Verified explanation or targeted clarification",
    query: "what if I get EoD instead of EoA",
  },
  {
    id: 5,
    name: "Scenario 5: Follow-up to the EoD question -> Preserves context",
    query: "what I am suppose do if I am get EoD instead of EoA",
    history: [
      { role: "user", content: "what if I get EoD instead of EoA" },
      { role: "assistant", content: "In the AICTE Portal under Receive -> LoD / EoD, an EoD notice is issued..." },
    ],
  },
  {
    id: 6,
    name: "Scenario 6: 'What happens after receiving LoA?' -> Practical procedure & relevant citations",
    query: "What happens after receiving LoA?",
  },
  {
    id: 7,
    name: "Scenario 7: 'Where do I upload documents?' -> Actual portal instructions",
    query: "Where do I upload documents?",
  },
  {
    id: 8,
    name: "Scenario 8: 'Why is my FDR release blocked?' -> Applicable clearance/document statuses using authorized records",
    query: "Why is my FDR release blocked?",
    userRole: "INSTITUTION",
    userId: "CLG-2026-000015", // Balaji College
  },
  {
    id: 9,
    name: "Scenario 9: Unrelated question -> Exact required refusal: 'It is not under my coverage'",
    query: "What is the weather in Delhi today?",
  },
  {
    id: 10,
    name: "Scenario 10: Unsupported regulatory claim -> No fabricated answer or citation",
    query: "What is the mandatory landing strip length required for flying cars on campus under Clause 99.4?",
  },
  {
    id: 11,
    name: "Scenario 11: Long answer with multiple citations -> Formatted content & citations structure",
    query: "Explain the complete AICTE FDR security deposit release procedure, clearances, and conditions under Clause 6.46",
  },
];

async function runSuite() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified');
  console.log("=== AICTE CHATBOT FULL VERIFICATION SUITE ===\n");

  const results: any[] = [];

  for (const tc of testCases) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[TEST ${tc.id}] ${tc.name}`);
    console.log(`Query: "${tc.query}"`);
    if (tc.history && tc.history.length > 0) {
      console.log(`History count: ${tc.history.length}`);
    }

    // 1. Intent Detection
    const intentResult = detectUserIntent(tc.query, tc.history);
    console.log(`Intent Result: ${intentResult.intent} (Allowed: ${intentResult.allowed})`);

    // 2. Retrieval (only if allowed & not pure greeting/basic conversation)
    let clauses: any[] = [];
    if (intentResult.allowed && intentResult.intent !== "GREETING" && intentResult.intent !== "BASIC_CONVERSATION") {
      const { resolvedQuery } = resolveContextualQuery(tc.query, tc.history || []);
      clauses = await retrieveRelevantClauses(resolvedQuery || tc.query, 4);
    }
    console.log(`Retrieved Clauses Count: ${clauses.length}`);
    if (clauses.length > 0) {
      console.log(`Retrieved Clauses: ${clauses.map(c => `[${c.clauseNumber}]`).join(', ')}`);
    }

    // 3. Portal Context
    const portalContext = await resolveUserPortalContext(
      { role: tc.userRole || "INSTITUTION", userId: tc.userId || "CLG-2026-000010" },
      tc.clientContext || {}
    );

    // 4. Response Generation
    const resp = await generateChatbotResponse({
      userQuery: tc.query,
      history: tc.history,
      clauses,
      portalContext,
    });

    console.log(`\nOutput Content:\n${resp.content}\n`);
    console.log(`Citations (${resp.citations.length}):`);
    for (const cit of resp.citations) {
      console.log(`  - [${cit.clauseNumber}] ${cit.title} (Page ${cit.pageNumber || 'N/A'}, PDF ${cit.pdfPageNumber || 'N/A'})`);
    }
    console.log(`isRefusal: ${resp.isRefusal}`);

    // Evaluation checks
    let passed = false;
    let evalNote = "";

    switch (tc.id) {
      case 1: // hi
        passed = intentResult.intent === "GREETING" && clauses.length === 0 && resp.citations.length === 0 && resp.content.includes("Hello!");
        evalNote = passed ? "PASS: Pure greeting returned, zero retrieval, zero citations." : "FAIL";
        break;
      case 2: // I have one doubt
        passed = intentResult.intent === "BASIC_CONVERSATION" && clauses.length === 0 && resp.citations.length === 0 && (resp.content.includes("doubt") || resp.content.includes("question"));
        evalNote = passed ? "PASS: Conversational prompt handled without handbook citations." : "FAIL";
        break;
      case 3: // FDR maturity
        passed = resp.content.includes("Maturity vs.") && resp.content.includes("Eligibility for Release") && resp.content.includes("PGRC") && resp.content.includes("Vigilance") && resp.content.includes("Statutory Forfeiture");
        evalNote = passed ? "PASS: Evidence-grounded 5-tier FDR release/withholding explanation returned." : "FAIL";
        break;
      case 4: // EoD vs EoA
        passed = resp.content.includes("Extension of Approval") && resp.content.includes("Extension of Deficiency") && resp.content.includes("Receive → LoD / EoD") && resp.content.toLowerCase().includes("what does eod refer to");
        evalNote = passed ? "PASS: EoA vs EoD distinguished with portal route and clarification prompt." : "FAIL";
        break;
      case 5: // Follow-up to EoD
        passed = resp.content.includes("Receive → LoD / EoD") && resp.content.includes("Submit → Approval Seeking") && resp.content.includes("Specific Deficiency");
        evalNote = passed ? "PASS: Follow-up preserved EoD context and gave step-by-step rectification." : "FAIL";
        break;
      case 6: // After LoA
        passed = resp.content.includes("University Affiliation") && resp.content.includes("Faculty & Principal Recruitment") && resp.content.includes("10-Year Joint FDR") && resp.citations.length > 0;
        evalNote = passed ? "PASS: Post-LoA practical steps returned with verified citations." : "FAIL";
        break;
      case 7: // Upload documents
        passed = resp.content.includes("Submit → Approval Seeking") && resp.content.includes("/institution/submit/approval");
        evalNote = passed ? "PASS: Actual portal upload route provided." : "FAIL";
        break;
      case 8: // Why FDR blocked
        passed = resp.content.includes("DOCUMENT_DEFICIENCY") && resp.content.includes("PGRC") && resp.content.includes("Vigilance");
        evalNote = passed ? "PASS: Blocked release explained using real clearance/document statuses." : "FAIL";
        break;
      case 9: // Weather
        passed = resp.content === "It is not under my coverage" && resp.isRefusal === true && resp.citations.length === 0;
        evalNote = passed ? "PASS: Exact required refusal string returned." : "FAIL";
        break;
      case 10: // Unsupported regulatory claim
        passed = resp.content.includes("insufficient") && resp.citations.length === 0;
        evalNote = passed ? "PASS: Correctly stated insufficient evidence, zero fabricated citations." : "FAIL";
        break;
      case 11: // Long answer with citations
        passed = resp.content.length > 200 && resp.citations.length > 0;
        evalNote = passed ? "PASS: Comprehensive structured answer with citations returned." : "FAIL";
        break;
    }

    console.log(`Result: ${evalNote}\n`);
    results.push({ id: tc.id, name: tc.name, passed, evalNote });
  }

  console.log("================================================================================");
  console.log("FINAL SUITE SUMMARY:");
  const allPassed = results.every(r => r.passed);
  for (const r of results) {
    console.log(`[TEST ${r.id}] ${r.passed ? '✅ PASS' : '❌ FAIL'}: ${r.name}`);
  }
  console.log(`\nOVERALL STATUS: ${allPassed ? 'ALL 11 TESTS PASSED SUCCESSFULLY!' : 'SOME TESTS FAILED'}`);
  console.log("================================================================================");

  await mongoose.disconnect();
}

runSuite().catch(console.error);
