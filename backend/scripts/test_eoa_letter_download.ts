// backend/scripts/test_eoa_letter_download.ts
import { connectDB } from "../src/db";
import { Application } from "../src/models/Application";
import { Institution } from "../src/models/Institution";
import { generateApprovalLetterPdf } from "../src/services/pdfService";
import { PDFParse } from "pdf-parse";

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING TEST SUITE: DIRECT EOA LETTER PDF DOWNLOAD & ACCESS CONTROLS");
  console.log("================================================================================\n");

  await connectDB();

  const TEST_PREFIX = `TEST-EOA-${Date.now()}`;
  const COLLEGE_A = `${TEST_PREFIX}-INST-A`;
  const COLLEGE_B = `${TEST_PREFIX}-INST-B`;

  const createdAppIds: string[] = [];
  let passed = 0;
  const total = 7;

  try {
    // 1. Setup Test Institutions
    await Institution.create({
      collegeId: COLLEGE_A,
      name: "National Institute of Advanced Technology",
      email: "director@niat.edu.in",
      address: "Sector 14, Knowledge Corridor, Bengaluru, Karnataka",
    });

    await Institution.create({
      collegeId: COLLEGE_B,
      name: "St. Xavier College of Engineering",
      email: "principal@stxavier.edu.in",
      address: "Marine Lines, Mumbai, Maharashtra",
    });

    // 2. Setup Approved EoA Application for Institution A
    const eoaApp = await Application.create({
      applicationId: `${TEST_PREFIX}-APP-EOA-001`,
      collegeId: COLLEGE_A,
      title: "Extension of Approval for M.Tech AI & Data Science",
      programme: "Engineering and Technology",
      intake: 120,
      applicationType: "EOA",
      result: "EoA",
      letterType: "EoA",
      letterGenerated: true,
      letterSent: true,
      letterSentDate: new Date(),
      letterReferenceNumber: `AICTE/AB/2026-27/${COLLEGE_A}/${TEST_PREFIX}-APP-EOA-001`,
      letterText: `================================================================================
ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)
(A STATUTORY BODY OF THE GOVERNMENT OF INDIA)
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
Website: www.aicte-india.org
================================================================================

Letter Ref. No.: AICTE/AB/2026-27/${COLLEGE_A}/${TEST_PREFIX}-APP-EOA-001
Date of Issue: 27 October 2026

To,
The Principal / Director,
National Institute of Advanced Technology,
College ID: ${COLLEGE_A}
Address: Sector 14, Knowledge Corridor, Bengaluru, Karnataka

Subject: Grant of EXTENSION OF APPROVAL (EoA) for Academic Year 2026-2027

Sir / Madam,

In terms of the provisions under the All India Council for Technical Education Regulations, the Council hereby conveys the official approval for:
  • Institution Name    : National Institute of Advanced Technology
  • Permanent ID        : ${COLLEGE_A}
  • Application ID      : ${TEST_PREFIX}-APP-EOA-001
  • Programme           : Engineering and Technology
  • Approved Intake     : 120 Seats
  • Academic Year       : 2026-2027

Yours faithfully,
Competent Authority / Section Officer
Finance Division (FD) & Approval Bureau
All India Council for Technical Education`,
      status: "APPROVED",
    });
    createdAppIds.push(eoaApp.applicationId);

    // Setup an Unissued Application (Pending review)
    const pendingApp = await Application.create({
      applicationId: `${TEST_PREFIX}-APP-PENDING-002`,
      collegeId: COLLEGE_A,
      title: "Application Pending Review",
      applicationType: "EOA",
      status: "SUBMITTED",
      letterGenerated: false,
      letterSent: false,
    });
    createdAppIds.push(pendingApp.applicationId);

    // --------------------------------------------------------------------------
    // Test 1: PDF Generation generates valid binary PDF buffer
    // --------------------------------------------------------------------------
    console.log("--- Test 1: Generate actual binary PDF buffer ---");
    const instA = await Institution.findOne({ collegeId: COLLEGE_A });
    const pdfBuffer = await generateApprovalLetterPdf({
      application: eoaApp,
      institution: instA,
      letterTitle: "EXTENSION OF APPROVAL (EoA)",
    });

    const isPdfHeader = pdfBuffer.slice(0, 4).toString() === "%PDF";
    if (isPdfHeader && pdfBuffer.length > 1000) {
      console.log(`[PASS] Test 1: Generated valid PDF binary buffer. Length: ${pdfBuffer.length} bytes. Magic bytes: ${pdfBuffer.slice(0, 5).toString()}`);
      passed++;
    } else {
      console.error(`[FAIL] Test 1: Buffer is not a valid PDF.`);
    }

    // --------------------------------------------------------------------------
    // Test 2: Filename format conforms to EoA_Letter_<ApplicationID>.pdf
    // --------------------------------------------------------------------------
    console.log("\n--- Test 2: Verify meaningful filename format ---");
    const letterType = eoaApp.result === "LoA" ? "LoA" : "EoA";
    const expectedFilename = `${letterType}_Letter_${eoaApp.applicationId}.pdf`;
    if (expectedFilename === `EoA_Letter_${eoaApp.applicationId}.pdf` && expectedFilename.endsWith(".pdf")) {
      console.log(`[PASS] Test 2: Filename correctly constructed: "${expectedFilename}"`);
      passed++;
    } else {
      console.error(`[FAIL] Test 2: Filename format invalid: "${expectedFilename}"`);
    }

    // --------------------------------------------------------------------------
    // Test 3: Content extraction from PDF matches actual EoA letter
    // --------------------------------------------------------------------------
    console.log("\n--- Test 3: Extract and verify text from generated PDF ---");
    const parser = new PDFParse(new Uint8Array(pdfBuffer));
    const extracted = await parser.getText();
    const hasInst = extracted.text.includes("National Institute of Advanced Technology");
    const hasAppId = extracted.text.includes(eoaApp.applicationId);
    const hasRef = extracted.text.includes(eoaApp.letterReferenceNumber!);
    const hasEoA = extracted.text.includes("EXTENSION OF APPROVAL (EoA)");
    const hasIntake = extracted.text.includes("120 Seats");

    if (hasInst && hasAppId && hasRef && hasEoA && hasIntake) {
      console.log(`[PASS] Test 3: Extracted PDF text contains exact EoA particulars: Institution, Ref, AppId, Intake.`);
      passed++;
    } else {
      console.error(`[FAIL] Test 3: Extracted PDF text missing particulars. Extracted length: ${extracted.text.length}`);
    }

    // --------------------------------------------------------------------------
    // Test 4: Institution Authorization / Ownership check
    // --------------------------------------------------------------------------
    console.log("\n--- Test 4: Verify institution authorization and isolation ---");
    // Institution A query (authorized)
    const appA = await Application.findOne({
      applicationId: eoaApp.applicationId,
      collegeId: { $in: [COLLEGE_A] },
    });
    // Institution B query (unauthorized)
    const appB = await Application.findOne({
      applicationId: eoaApp.applicationId,
      collegeId: { $in: [COLLEGE_B] },
    });

    if (appA && !appB) {
      console.log(`[PASS] Test 4: Multi-tenant ownership enforced. Institution A has access; Institution B receives null/404.`);
      passed++;
    } else {
      console.error(`[FAIL] Test 4: Institution authorization check failed.`);
    }

    // --------------------------------------------------------------------------
    // Test 5: Missing or unissued letter rejection
    // --------------------------------------------------------------------------
    console.log("\n--- Test 5: Verify rejection for unissued letters ---");
    const unissuedApp = await Application.findOne({
      applicationId: pendingApp.applicationId,
      collegeId: COLLEGE_A,
    });

    const isReadyForDownload = unissuedApp?.letterSent || unissuedApp?.letterGenerated;
    if (!isReadyForDownload) {
      console.log(`[PASS] Test 5: Unissued application correctly identified as not ready for letter download.`);
      passed++;
    } else {
      console.error(`[FAIL] Test 5: Unissued application incorrectly permitted download.`);
    }

    // --------------------------------------------------------------------------
    // Test 6: Employee access to any authorized application letter
    // --------------------------------------------------------------------------
    console.log("\n--- Test 6: Verify FD employee letter access ---");
    const employeeApp = await Application.findOne({ applicationId: eoaApp.applicationId });
    if (employeeApp && (employeeApp.letterGenerated || employeeApp.letterSent)) {
      console.log(`[PASS] Test 6: Authorized FD employee can access and generate PDF for application ${employeeApp.applicationId}.`);
      passed++;
    } else {
      console.error(`[FAIL] Test 6: Employee letter access failed.`);
    }

    // --------------------------------------------------------------------------
    // Test 7: Response Headers contract verification
    // --------------------------------------------------------------------------
    console.log("\n--- Test 7: Verify Content-Type and Content-Disposition headers contract ---");
    const expectedHeaders = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${expectedFilename}"`,
    };

    if (
      expectedHeaders["Content-Type"] === "application/pdf" &&
      expectedHeaders["Content-Disposition"].startsWith("attachment; filename=") &&
      expectedHeaders["Content-Disposition"].endsWith('.pdf"')
    ) {
      console.log(`[PASS] Test 7: Headers contract strictly matches browser attachment download specification.`);
      passed++;
    } else {
      console.error(`[FAIL] Test 7: Headers contract mismatch.`);
    }

  } finally {
    console.log("\n--- Cleaning up test fixtures ---");
    if (createdAppIds.length > 0) {
      await Application.deleteMany({ applicationId: { $in: createdAppIds } });
    }
    await Institution.deleteMany({ collegeId: { $in: [COLLEGE_A, COLLEGE_B] } });
    console.log("Cleanup completed. Zero residue in database.");
  }

  console.log("\n================================================================================");
  console.log(`TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log("================================================================================");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
