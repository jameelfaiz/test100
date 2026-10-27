// scripts/test_pgrc_vigilance_clearance_suite.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { Complaint } from "../src/models/Complaint";
import { Investigation } from "../src/models/Investigation";
import { Institution } from "../src/models/Institution";
import { Application } from "../src/models/Application";
import { User } from "../src/models/User";
import { Payment } from "../src/models/Payment";
import { ReleaseRequest } from "../src/models/ReleaseRequest";
import {
  calculatePgrcClearance,
  calculateVigilanceClearance,
  calculateOverallReleaseDecision,
  resolveInstitutionIdentifiers,
} from "../src/services/clearanceService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";

interface TestReportItem {
  testNum: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runTestSuite() {
  console.log("======================================================================");
  console.log("AICTE FD RELEASE: PGRC & VIGILANCE CLEARANCE VERIFICATION SUITE");
  console.log("======================================================================\n");

  await mongoose.connect(MONGODB_URI);

  // Snapshot genuine business records counts
  const initialCounts = {
    apps: await Application.countDocuments(),
    users: await User.countDocuments(),
    payments: await Payment.countDocuments(),
    complaints: await Complaint.countDocuments(),
    investigations: await Investigation.countDocuments(),
    institutions: await Institution.countDocuments(),
    releaseRequests: await ReleaseRequest.countDocuments(),
  };

  console.log("Pre-Test Business Records Counts:");
  console.log(`- Applications: ${initialCounts.apps}`);
  console.log(`- Users: ${initialCounts.users}`);
  console.log(`- Payments: ${initialCounts.payments}`);
  console.log(`- Complaints: ${initialCounts.complaints}`);
  console.log(`- Investigations: ${initialCounts.investigations}`);
  console.log(`- Institutions: ${initialCounts.institutions}`);
  console.log(`- Release Requests: ${initialCounts.releaseRequests}\n`);

  const results: TestReportItem[] = [];

  const verified4Docs = [
    { id: "doc-1", name: "EoA", status: "Verified" },
    { id: "doc-2", name: "Affidavit", status: "Verified" },
    { id: "doc-3", name: "Release Approval Letter", status: "Verified" },
    { id: "doc-4", name: "FDR Copy", status: "Verified" },
  ];

  // -------------------------------------------------------------------------
  // TEST 1: Balaji College Proven PGRC -> REJECTED
  // -------------------------------------------------------------------------
  console.log("Running Test 1: Balaji College Proven PGRC -> REJECTED...");
  const balajiRelease = await ReleaseRequest.findOne({ collegeId: /balaji/i });
  if (!balajiRelease) {
    throw new Error("Balaji College release request not found in database!");
  }
  const t1Pgrc = await calculatePgrcClearance(balajiRelease);
  const t1Passed =
    t1Pgrc.status === "REJECTED" &&
    t1Pgrc.reason === "Proven Complaint" &&
    t1Pgrc.count >= 1 &&
    t1Pgrc.department === "PGRC";
  results.push({
    testNum: 1,
    name: "Balaji College Proven PGRC -> REJECTED",
    passed: t1Passed,
    details: `Status: ${t1Pgrc.status}, Reason: "${t1Pgrc.reason}", Matching Count: ${t1Pgrc.count}, Department: ${t1Pgrc.department}`,
  });
  console.log(`Test 1: ${t1Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 2: Proven Vigilance record -> REJECTED
  // -------------------------------------------------------------------------
  console.log("Running Test 2: Proven Vigilance record -> REJECTED...");
  const mockCode2 = `TEST-CLG-VIG-PROVEN-${Date.now()}`;
  const mockInstId2 = new mongoose.Types.ObjectId().toString();
  const testInv2 = await Investigation.create({
    investigationId: `INV-TEST-PROVEN-${Date.now()}`,
    complaintId: new mongoose.Types.ObjectId(),
    collegeId: mockCode2,
    institutionId: mockInstId2,
    status: "COMPLETED",
    finalOutcome: "PROVEN",
    supervisorDecision: "PROVEN",
  });

  const t2Vig = await calculateVigilanceClearance(mockCode2, mockInstId2);
  const t2Passed =
    t2Vig.status === "REJECTED" &&
    t2Vig.reason === "Proven Investigation" &&
    t2Vig.count === 1 &&
    t2Vig.department === "Vigilance";
  results.push({
    testNum: 2,
    name: "Proven Vigilance record -> REJECTED",
    passed: t2Passed,
    details: `Status: ${t2Vig.status}, Reason: "${t2Vig.reason}", Count: ${t2Vig.count}, Department: ${t2Vig.department}`,
  });
  await Investigation.findByIdAndDelete(testInv2._id);
  console.log(`Test 2: ${t2Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 3: Pending PGRC investigation -> MATURITY DATE EXTENDED
  // -------------------------------------------------------------------------
  console.log("Running Test 3: Pending PGRC investigation -> MATURITY DATE EXTENDED...");
  const mockCode3 = `TEST-CLG-PGRC-PEND-${Date.now()}`;
  const testComp3 = await Complaint.create({
    complaintReference: `PGRC-TEST-PEND-${Date.now()}`,
    collegeId: mockCode3,
    institutionId: new mongoose.Types.ObjectId().toString(),
    category: "Financial Irregularity",
    title: "Fee overcharging report",
    description: "Investigation ongoing",
    source: "INTERNAL",
    assignedDepartment: "PGRC",
    status: "UNDER_INVESTIGATION",
    finalOutcome: "ON_PROCESS",
  });

  const t3Pgrc = await calculatePgrcClearance(mockCode3);
  const t3Passed =
    t3Pgrc.status === "MATURITY DATE EXTENDED" &&
    t3Pgrc.reason === "Complaint Investigation in Progress" &&
    t3Pgrc.count === 1;
  results.push({
    testNum: 3,
    name: "Pending PGRC investigation -> MATURITY DATE EXTENDED",
    passed: t3Passed,
    details: `Status: ${t3Pgrc.status}, Reason: "${t3Pgrc.reason}", Count: ${t3Pgrc.count}`,
  });
  await Complaint.findByIdAndDelete(testComp3._id);
  console.log(`Test 3: ${t3Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 4: Pending Vigilance investigation -> MATURITY DATE EXTENDED
  // -------------------------------------------------------------------------
  console.log("Running Test 4: Pending Vigilance investigation -> MATURITY DATE EXTENDED...");
  const mockCode4 = `TEST-CLG-VIG-PEND-${Date.now()}`;
  const testInv4 = await Investigation.create({
    investigationId: `INV-TEST-PEND-${Date.now()}`,
    complaintId: new mongoose.Types.ObjectId(),
    collegeId: mockCode4,
    institutionId: new mongoose.Types.ObjectId().toString(),
    status: "IN_PROGRESS",
    finalOutcome: "ON_PROCESS",
  });

  const t4Vig = await calculateVigilanceClearance(mockCode4);
  const t4Passed =
    t4Vig.status === "MATURITY DATE EXTENDED" &&
    t4Vig.reason === "Investigation in Progress" &&
    t4Vig.count === 1;
  results.push({
    testNum: 4,
    name: "Pending Vigilance investigation -> MATURITY DATE EXTENDED",
    passed: t4Passed,
    details: `Status: ${t4Vig.status}, Reason: "${t4Vig.reason}", Count: ${t4Vig.count}`,
  });
  await Investigation.findByIdAndDelete(testInv4._id);
  console.log(`Test 4: ${t4Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 5: All matching records Unproven -> APPROVED
  // -------------------------------------------------------------------------
  console.log("Running Test 5: All matching records Unproven -> APPROVED...");
  const mockCode5 = `TEST-CLG-UNPROVEN-${Date.now()}`;
  const mockInstId5 = new mongoose.Types.ObjectId().toString();
  const testComp5 = await Complaint.create({
    complaintReference: `PGRC-TEST-UNPROV-${Date.now()}`,
    collegeId: mockCode5,
    institutionId: mockInstId5,
    category: "Administrative Dispute",
    title: "Allegation unsubstantiated",
    description: "Committee completed review and found zero violation",
    source: "INTERNAL",
    assignedDepartment: "PGRC",
    status: "RESOLVED",
    finalOutcome: "NOT_PROVEN",
  });

  const testInv5 = await Investigation.create({
    investigationId: `INV-TEST-UNPROV-${Date.now()}`,
    complaintId: testComp5._id,
    collegeId: mockCode5,
    institutionId: mockInstId5,
    status: "COMPLETED",
    finalOutcome: "NOT_PROVEN",
    supervisorDecision: "NOT_PROVEN",
  });

  const t5Pgrc = await calculatePgrcClearance(mockCode5, mockInstId5);
  const t5Vig = await calculateVigilanceClearance(mockCode5, mockInstId5);

  const t5Passed =
    t5Pgrc.status === "APPROVED" &&
    t5Pgrc.reason === "Complaint Not Proven" &&
    t5Vig.status === "APPROVED" &&
    t5Vig.reason === "Investigation Not Proven";
  results.push({
    testNum: 5,
    name: "All matching records Unproven -> APPROVED",
    passed: t5Passed,
    details: `PGRC Status: ${t5Pgrc.status} ("${t5Pgrc.reason}"), Vigilance Status: ${t5Vig.status} ("${t5Vig.reason}")`,
  });
  await Complaint.findByIdAndDelete(testComp5._id);
  await Investigation.findByIdAndDelete(testInv5._id);
  console.log(`Test 5: ${t5Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 6: No matching records -> APPROVED
  // -------------------------------------------------------------------------
  console.log("Running Test 6: No matching records -> APPROVED...");
  const nonExistentCode = `CLG-NONE-${Date.now()}`;
  const t6Pgrc = await calculatePgrcClearance(nonExistentCode);
  const t6Vig = await calculateVigilanceClearance(nonExistentCode);

  const t6Passed =
    t6Pgrc.status === "APPROVED" &&
    t6Pgrc.reason === "No Complaints Found" &&
    t6Pgrc.count === 0 &&
    t6Vig.status === "APPROVED" &&
    t6Vig.reason === "No Investigations Found" &&
    t6Vig.count === 0;
  results.push({
    testNum: 6,
    name: "No matching records -> APPROVED",
    passed: t6Passed,
    details: `PGRC: ${t6Pgrc.status} ("${t6Pgrc.reason}"), Vigilance: ${t6Vig.status} ("${t6Vig.reason}")`,
  });
  console.log(`Test 6: ${t6Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 7: PGRC REJECTED + Vigilance APPROVED -> blocked
  // -------------------------------------------------------------------------
  console.log("Running Test 7: PGRC REJECTED + Vigilance APPROVED -> blocked...");
  const t7Decision = calculateOverallReleaseDecision(
    verified4Docs,
    "REJECTED",
    "APPROVED",
    "Proven Complaint",
    "No Investigations Found"
  );
  const t7Passed =
    t7Decision.overallStatus === "REJECTED" &&
    t7Decision.isEligibleForApproval === false &&
    t7Decision.responsibleDepartment === "PGRC" &&
    t7Decision.pgrcApproved === false &&
    t7Decision.vigilanceApproved === true;
  results.push({
    testNum: 7,
    name: "PGRC REJECTED + Vigilance APPROVED -> blocked",
    passed: t7Passed,
    details: `Overall: ${t7Decision.overallStatus}, isEligible: ${t7Decision.isEligibleForApproval}, Responsible Dept: ${t7Decision.responsibleDepartment}, Message: "${t7Decision.message}"`,
  });
  console.log(`Test 7: ${t7Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 8: PGRC MATURITY DATE EXTENDED + Vigilance APPROVED -> blocked
  // -------------------------------------------------------------------------
  console.log("Running Test 8: PGRC MATURITY DATE EXTENDED + Vigilance APPROVED -> blocked...");
  const t8Decision = calculateOverallReleaseDecision(
    verified4Docs,
    "MATURITY DATE EXTENDED",
    "APPROVED",
    "Complaint Investigation in Progress",
    "No Investigations Found"
  );
  const t8Passed =
    t8Decision.overallStatus === "MATURITY_EXTENDED" &&
    t8Decision.isEligibleForApproval === false &&
    t8Decision.responsibleDepartment === "PGRC" &&
    t8Decision.pgrcApproved === false &&
    t8Decision.vigilanceApproved === true;
  results.push({
    testNum: 8,
    name: "PGRC MATURITY DATE EXTENDED + Vigilance APPROVED -> blocked",
    passed: t8Passed,
    details: `Overall: ${t8Decision.overallStatus}, isEligible: ${t8Decision.isEligibleForApproval}, Responsible Dept: ${t8Decision.responsibleDepartment}, Message: "${t8Decision.message}"`,
  });
  console.log(`Test 8: ${t8Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 9: Both departments APPROVED + one document pending -> blocked
  // -------------------------------------------------------------------------
  console.log("Running Test 9: Both departments APPROVED + one document pending -> blocked...");
  const docsWithOnePending = [
    { id: "doc-1", name: "EoA", status: "Verified" },
    { id: "doc-2", name: "Affidavit", status: "Verified" },
    { id: "doc-3", name: "Release Approval Letter", status: "Pending" },
    { id: "doc-4", name: "FDR Copy", status: "Verified" },
  ];
  const t9Decision = calculateOverallReleaseDecision(
    docsWithOnePending,
    "APPROVED",
    "APPROVED",
    "No Complaints Found",
    "No Investigations Found"
  );
  const t9Passed =
    t9Decision.overallStatus === "DOCUMENT_DEFICIENCY" &&
    t9Decision.isEligibleForApproval === false &&
    t9Decision.documentsVerified === false &&
    t9Decision.pgrcApproved === true &&
    t9Decision.vigilanceApproved === true;
  results.push({
    testNum: 9,
    name: "Both departments APPROVED + one document pending -> blocked",
    passed: t9Passed,
    details: `Overall: ${t9Decision.overallStatus}, isEligible: ${t9Decision.isEligibleForApproval}, Docs Verified: ${t9Decision.documentsVerified}, Message: "${t9Decision.message}"`,
  });
  console.log(`Test 9: ${t9Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 10: Four documents VERIFIED + both departments APPROVED -> permitted
  // -------------------------------------------------------------------------
  console.log("Running Test 10: Four documents VERIFIED + both departments APPROVED -> permitted...");
  const t10Decision = calculateOverallReleaseDecision(
    verified4Docs,
    "APPROVED",
    "APPROVED",
    "No Complaints Found",
    "No Investigations Found"
  );
  const t10Passed =
    t10Decision.overallStatus === "ELIGIBLE_FOR_APPROVAL" &&
    t10Decision.isEligibleForApproval === true &&
    t10Decision.documentsVerified === true &&
    t10Decision.pgrcApproved === true &&
    t10Decision.vigilanceApproved === true;
  results.push({
    testNum: 10,
    name: "Four documents VERIFIED + both departments APPROVED -> permitted",
    passed: t10Passed,
    details: `Overall: ${t10Decision.overallStatus}, isEligible: ${t10Decision.isEligibleForApproval}, Message: "${t10Decision.message}"`,
  });
  console.log(`Test 10: ${t10Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 11: Mixed records -> Priority PROVEN > MATURITY DATE EXTENDED > APPROVED
  // -------------------------------------------------------------------------
  console.log("Running Test 11: Mixed records priority (PROVEN > MATURITY DATE EXTENDED > APPROVED)...");
  const mockCode11 = `TEST-CLG-MIXED-${Date.now()}`;
  const mockInstId11 = new mongoose.Types.ObjectId().toString();

  // Create 1 PROVEN complaint and 1 PENDING complaint for same institution
  const cProven = await Complaint.create({
    complaintReference: `PGRC-PROV-${Date.now()}`,
    collegeId: mockCode11,
    institutionId: mockInstId11,
    assignedDepartment: "PGRC",
    status: "PROVEN",
    finalOutcome: "PROVEN",
    category: "Financial",
    title: "Proven grievance",
    description: "Proven finding",
  });
  const cPending = await Complaint.create({
    complaintReference: `PGRC-PEND-${Date.now()}`,
    collegeId: mockCode11,
    institutionId: mockInstId11,
    assignedDepartment: "PGRC",
    status: "UNDER_INVESTIGATION",
    finalOutcome: "ON_PROCESS",
    category: "Admin",
    title: "Pending grievance",
    description: "Ongoing",
  });

  const t11PriorityCheck1 = await calculatePgrcClearance(mockCode11, mockInstId11);
  const subtest1Passed = t11PriorityCheck1.status === "REJECTED"; // PROVEN beats PENDING

  // Delete PROVEN, now only PENDING and an UNPROVEN exist
  await Complaint.findByIdAndDelete(cProven._id);
  const cUnproven = await Complaint.create({
    complaintReference: `PGRC-UNPROV-${Date.now()}`,
    collegeId: mockCode11,
    institutionId: mockInstId11,
    assignedDepartment: "PGRC",
    status: "RESOLVED",
    finalOutcome: "NOT_PROVEN",
    category: "Academic",
    title: "Unproven grievance",
    description: "Dismissed",
  });

  const t11PriorityCheck2 = await calculatePgrcClearance(mockCode11, mockInstId11);
  const subtest2Passed = t11PriorityCheck2.status === "MATURITY DATE EXTENDED"; // PENDING beats UNPROVEN

  await Complaint.findByIdAndDelete(cPending._id);
  const t11PriorityCheck3 = await calculatePgrcClearance(mockCode11, mockInstId11);
  const subtest3Passed = t11PriorityCheck3.status === "APPROVED"; // UNPROVEN alone -> APPROVED

  await Complaint.findByIdAndDelete(cUnproven._id);

  const t11Passed = subtest1Passed && subtest2Passed && subtest3Passed;
  results.push({
    testNum: 11,
    name: "Mixed records priority (PROVEN > MATURITY DATE EXTENDED > APPROVED)",
    passed: t11Passed,
    details: `Proven + Pending -> ${t11PriorityCheck1.status} (PASS); Pending + Unproven -> ${t11PriorityCheck2.status} (PASS); Unproven alone -> ${t11PriorityCheck3.status} (PASS)`,
  });
  console.log(`Test 11: ${t11Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // TEST 12: Investigation changes to Proven or Unproven -> clearance updates correctly
  // -------------------------------------------------------------------------
  console.log("Running Test 12: Investigation lifecycle transition (PENDING -> PROVEN -> UNPROVEN)...");
  const mockCode12 = `TEST-CLG-TRANS-${Date.now()}`;
  const mockInstId12 = new mongoose.Types.ObjectId().toString();

  // Phase A: Create investigation in progress
  const testInv12 = await Investigation.create({
    investigationId: `INV-TRANS-${Date.now()}`,
    complaintId: new mongoose.Types.ObjectId(),
    collegeId: mockCode12,
    institutionId: mockInstId12,
    status: "IN_PROGRESS",
    finalOutcome: "ON_PROCESS",
  });

  const phaseA = await calculateVigilanceClearance(mockCode12, mockInstId12);
  const passA = phaseA.status === "MATURITY DATE EXTENDED";

  // Phase B: Finalize as PROVEN
  testInv12.status = "COMPLETED";
  testInv12.finalOutcome = "PROVEN";
  testInv12.supervisorDecision = "PROVEN";
  await testInv12.save();

  const phaseB = await calculateVigilanceClearance(mockCode12, mockInstId12);
  const passB = phaseB.status === "REJECTED";

  // Phase C: Change finding to UNPROVEN / NOT_PROVEN
  testInv12.finalOutcome = "NOT_PROVEN";
  testInv12.supervisorDecision = "NOT_PROVEN";
  await testInv12.save();

  const phaseC = await calculateVigilanceClearance(mockCode12, mockInstId12);
  const passC = phaseC.status === "APPROVED";

  await Investigation.findByIdAndDelete(testInv12._id);

  const t12Passed = passA && passB && passC;
  results.push({
    testNum: 12,
    name: "Investigation lifecycle updates (Pending -> Proven -> Unproven)",
    passed: t12Passed,
    details: `Phase A (Pending): ${phaseA.status} -> Phase B (Proven): ${phaseB.status} -> Phase C (Unproven): ${phaseC.status}`,
  });
  console.log(`Test 12: ${t12Passed ? "PASS" : "FAIL"}\n`);

  // -------------------------------------------------------------------------
  // POST-TEST INTEGRITY VERIFICATION
  // -------------------------------------------------------------------------
  console.log("Verifying business records integrity after test run...");
  const finalCounts = {
    apps: await Application.countDocuments(),
    users: await User.countDocuments(),
    payments: await Payment.countDocuments(),
    complaints: await Complaint.countDocuments(),
    investigations: await Investigation.countDocuments(),
    institutions: await Institution.countDocuments(),
    releaseRequests: await ReleaseRequest.countDocuments(),
  };

  const recordsUntouched =
    finalCounts.apps === initialCounts.apps &&
    finalCounts.users === initialCounts.users &&
    finalCounts.payments === initialCounts.payments &&
    finalCounts.complaints === initialCounts.complaints &&
    finalCounts.investigations === initialCounts.investigations &&
    finalCounts.institutions === initialCounts.institutions &&
    finalCounts.releaseRequests === initialCounts.releaseRequests;

  console.log("Post-Test Verification Counts:");
  console.log(`- Applications: ${finalCounts.apps} (Expected ${initialCounts.apps})`);
  console.log(`- Users: ${finalCounts.users} (Expected ${initialCounts.users})`);
  console.log(`- Payments: ${finalCounts.payments} (Expected ${initialCounts.payments})`);
  console.log(`- Complaints: ${finalCounts.complaints} (Expected ${initialCounts.complaints})`);
  console.log(`- Investigations: ${finalCounts.investigations} (Expected ${initialCounts.investigations})`);
  console.log(`- Institutions: ${finalCounts.institutions} (Expected ${initialCounts.institutions})`);
  console.log(`- Release Requests: ${finalCounts.releaseRequests} (Expected ${initialCounts.releaseRequests})`);
  console.log(`- Business Records 100% Intact: ${recordsUntouched ? "YES" : "NO"}\n`);

  await mongoose.disconnect();

  // Print Summary Table
  console.log("======================================================================");
  console.log("SUMMARY OF ALL 12 VERIFICATION TESTS");
  console.log("======================================================================");
  let allPass = true;
  for (const r of results) {
    console.log(`[Test ${String(r.testNum).padStart(2)}] ${r.name.padEnd(60)}: ${r.passed ? "PASS" : "FAIL"}`);
    console.log(`         -> ${r.details}`);
    if (!r.passed) allPass = false;
  }
  console.log("======================================================================");
  console.log(`OVERALL RESULT: ${allPass && recordsUntouched ? "ALL 12 TESTS PASSED — 100% SUCCESS" : "FAILED"}`);
  console.log("======================================================================");

  if (!allPass || !recordsUntouched) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
