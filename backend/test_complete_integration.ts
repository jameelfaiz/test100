import { connectDB } from "./src/db";
import { Institution } from "./src/models/Institution";
import { Complaint } from "./src/models/Complaint";
import { ComplaintLetter } from "./src/models/ComplaintLetter";
import { EmailVerificationToken } from "./src/models/EmailVerificationToken";
import { User } from "./src/models/User";

const BASE_URL = "http://localhost:5000/api";

class TestClient {
  public cookies: string[] = [];
  public csrfToken = "";

  async getCsrf() {
    const res = await fetch(`${BASE_URL}/auth/csrf-token`, {
      headers: { Cookie: this.cookies.join("; ") },
    });
    this.extractCookies(res);
    try {
      const data = await res.json();
      this.csrfToken = data.csrfToken;
    } catch {}
    return this.csrfToken;
  }

  public extractCookies(res: Response) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (raw && raw.length > 0) {
      for (const c of raw) {
        const part = c.split(";")[0];
        const name = part.split("=")[0];
        this.cookies = this.cookies.filter((existing) => !existing.startsWith(`${name}=`));
        this.cookies.push(part);
      }
    }
  }

  async login(userId: string, pass: string) {
    await this.getCsrf();
    const res = await this.post("/auth/login", { userId, password: pass });
    await this.getCsrf();
    return res;
  }

  async post(path: string, body: any) {
    if (!this.csrfToken) await this.getCsrf();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": this.csrfToken,
        Cookie: this.cookies.join("; "),
      },
      body: JSON.stringify(body),
    });
    this.extractCookies(res);
    return res;
  }

  async get(path: string) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Cookie: this.cookies.join("; ") },
    });
    this.extractCookies(res);
    return res;
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("AICTE COMPREHENSIVE E2E INTEGRATION SUITE (MODULES 1 TO 11)");
  console.log("================================================================================\n");

  await connectDB();

  // Find genuine institution to test with
  const testInst = await Institution.findOne({ collegeId: "CLG-2026-000001" });
  if (!testInst) {
    throw new Error("Test institution CLG-2026-000001 not found");
  }
  const instId = testInst._id.toString();
  console.log(`Using Test Institution: ${testInst.name} (${testInst.collegeId})`);

  const createdComplaintIds: string[] = [];
  const createdLetterRefs: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1 — PGRC COMPLETE LIFECYCLE
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 1: PGRC Complaint Submission -> Decision -> FD Sync -> Letter Dispatch");

    const pgrcClient = new TestClient();
    const publicClient = new TestClient();

    // 1.1 Public PGRC Submission
    const submitPgrcRes = await publicClient.post("/public/complaints/pgrc", {
      complainantName: "Integration Test Complainant",
      complainantEmail: "test.complainant@example.com",
      institutionId: instId,
      description: "Severe laboratory equipment deficiency reported during annual audit.",
    });

    if (!submitPgrcRes.ok) {
      const err = await submitPgrcRes.json();
      throw new Error(`Public PGRC submission failed: ${err.message}`);
    }
    const pgrcData = await submitPgrcRes.json();
    console.log(`  ✔ 1.1 Submitted Public PGRC Complaint: ${pgrcData.complaintId} (Status: ${pgrcData.status})`);
    createdComplaintIds.push(pgrcData.complaintId);

    // 1.2 Verify in MongoDB
    const pgrcDoc = await Complaint.findOne({ complaintReference: pgrcData.complaintId });
    if (!pgrcDoc || pgrcDoc.status !== "NEW") {
      throw new Error("PGRC MongoDB persistence check failed");
    }
    console.log(`  ✔ 1.2 Verified in MongoDB: ID=${pgrcDoc._id}, Category=${pgrcDoc.category}, Status=${pgrcDoc.status}`);

    // 1.3 Test Tracking & OTP
    const otpRes = await publicClient.post("/public/complaints/track/send-otp", {
      complaintId: pgrcData.complaintId,
      email: "test.complainant@example.com",
    });
    if (!otpRes.ok) {
      const err = await otpRes.json();
      throw new Error(`Send OTP failed: ${err.message}`);
    }
    const otpData = await otpRes.json();
    const otp = otpData.otp || otpData.verificationCode;
    console.log(`  ✔ 1.3 OTP generated for email verification: ${otp}`);

    const trackRes = await publicClient.post("/public/complaints/track", {
      complaintId: pgrcData.complaintId,
      email: "test.complainant@example.com",
      otp,
    });
    const trackData = await trackRes.json();
    if (!trackRes.ok || (trackData.rawStatus !== "NEW" && trackData.status !== "Received")) {
      throw new Error(`Tracking status verification failed: status=${trackData.status}, rawStatus=${trackData.rawStatus}`);
    }
    console.log(`  ✔ 1.4 Tracked status safely: ${trackData.status} (raw: ${trackData.rawStatus}) - "${trackData.publicStatusMessage || trackData.statusExplanation}"`);

    // 1.5 PGRC Employee Login
    const pgrcLoginRes = await pgrcClient.login("pgrc_emp", "pgrc_emp_pass");
    if (!pgrcLoginRes.ok) throw new Error("PGRC employee login failed");
    console.log("  ✔ 1.5 Logged in as PGRC Officer (pgrc_emp)");

    // 1.6 Mark INVESTIGATION
    const investRes = await pgrcClient.post(`/pgrc/complaint/${pgrcData.complaintId}/decision`, {
      decision: "INVESTIGATION",
      reason: "Formal fact-finding committee constituted under AICTE regulations.",
    });
    if (!investRes.ok) throw new Error("PGRC decision INVESTIGATION failed");
    console.log("  ✔ 1.6 PGRC Officer marked complaint as INVESTIGATION");

    // 1.7 Check FD Synchronization: Expects ON PROCESS
    const fdClient = new TestClient();
    await fdClient.login("fd_emp", "fd_emp_pass");
    const fdSync1 = await (await fdClient.get("/fd/compliance-status")).json();
    const instFd1 = fdSync1.find((item: any) => item.institutionId === instId);
    if (!instFd1 || instFd1.pgrcStatus !== "ON PROCESS") {
      throw new Error(`FD Sync failed: Expected ON PROCESS, got ${instFd1?.pgrcStatus}`);
    }
    console.log(`  ✔ 1.7 FD Portal synchronized: PGRC Verification Status = "${instFd1.pgrcStatus}"`);

    // 1.8 Mark PROVEN
    const provenRes = await pgrcClient.post(`/pgrc/complaint/${pgrcData.complaintId}/decision`, {
      decision: "PROVEN",
      reason: "Inspection confirmed complete absence of mandatory safety equipment.",
    });
    if (!provenRes.ok) throw new Error("PGRC decision PROVEN failed");
    console.log("  ✔ 1.8 PGRC Officer marked complaint as PROVEN");

    // 1.9 Check FD Synchronization: Expects REJECTED
    const fdSync2 = await (await fdClient.get("/fd/compliance-status")).json();
    const instFd2 = fdSync2.find((item: any) => item.institutionId === instId);
    if (!instFd2 || instFd2.pgrcStatus !== "REJECTED") {
      throw new Error(`FD Sync failed: Expected REJECTED, got ${instFd2?.pgrcStatus}`);
    }
    console.log(`  ✔ 1.9 FD Portal synchronized: PGRC Verification Status = "${instFd2.pgrcStatus}"`);

    // 1.10 FD Letter Generation
    const genLetterRes = await fdClient.post("/fd/compliance-letter/generate", {
      institutionId: instId,
      department: "PGRC",
    });
    if (!genLetterRes.ok) throw new Error("Letter generation failed");
    const letterDraft = await genLetterRes.json();
    console.log(`  ✔ 1.10 Generated Official Letter Draft: Ref=${letterDraft.letterReference}`);

    // 1.11 FD Letter Dispatch
    const sendLetterRes = await fdClient.post("/fd/compliance-letter/send", {
      letterReference: letterDraft.letterReference,
      institutionId: instId,
      department: "PGRC",
      status: letterDraft.status,
      content: letterDraft.content,
      reason: letterDraft.reason,
      complaintReferences: letterDraft.complaintReferences,
    });
    if (!sendLetterRes.ok) {
      const err = await sendLetterRes.json();
      throw new Error(`Letter dispatch failed: ${err.message}`);
    }
    createdLetterRefs.push(letterDraft.letterReference);
    console.log(`  ✔ 1.11 Dispatched Letter to Institution: ${letterDraft.letterReference}`);

    // 1.12 Institution Receive Verification
    const instClient = new TestClient();
    // CLG-2026-000001 user
    const instLoginRes = await instClient.login("CLG-2026-000001", "password123");
    if (!instLoginRes.ok) {
      console.log("  (Institution login credentials differ, checking DB directly)");
      const instLetterDoc = await ComplaintLetter.findOne({ letterReference: letterDraft.letterReference });
      if (!instLetterDoc || !instLetterDoc.isSent) throw new Error("Institution letter not found in MongoDB");
      console.log(`  ✔ 1.12 Verified in DB: Letter marked isSent=true for institution ${instLetterDoc.institutionName}`);
    } else {
      const recLettersRes = await instClient.get("/institution/receive/complaint-letters");
      const recLettersData = await recLettersRes.json();
      const found = (recLettersData.letters || []).find((l: any) => l.letterReference === letterDraft.letterReference);
      if (!found) throw new Error("Letter not found in institution Receive section");
      console.log(`  ✔ 1.12 Institution Receive section verified: Letter ${found.letterReference} present.`);
    }

    // -------------------------------------------------------------------------
    // TEST 2 — VIGILANCE COMPLETE LIFECYCLE
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 2: Vigilance Complaint Submission -> Decision -> FD Sync -> Letter Dispatch");

    const vigClient = new TestClient();

    // 2.1 Public Vigilance Submission
    const submitVigRes = await publicClient.post("/public/complaints/vigilance", {
      complainantName: "Anti Corruption Whistleblower",
      complainantEmail: "whistleblower@example.com",
      institutionId: instId,
      description: "Allegation of unauthorized capitation fee collection.",
    });
    if (!submitVigRes.ok) throw new Error("Public Vigilance submission failed");
    const vigData = await submitVigRes.json();
    console.log(`  ✔ 2.1 Submitted Public Vigilance Complaint: ${vigData.complaintId}`);
    createdComplaintIds.push(vigData.complaintId);

    // 2.2 Vigilance Officer Login
    const vigLoginRes = await vigClient.login("vig_emp", "vig_emp_pass");
    if (!vigLoginRes.ok) throw new Error("Vigilance officer login failed");
    console.log("  ✔ 2.2 Logged in as Vigilance Officer (vig_emp)");

    // 2.3 Vigilance Mark INVESTIGATION
    const vigInvestRes = await vigClient.post(`/vigilance/complaint/${vigData.complaintId}/decision`, {
      decision: "INVESTIGATION",
      reason: "Special vigilance audit panel assigned to examine fee accounts.",
    });
    if (!vigInvestRes.ok) throw new Error("Vigilance INVESTIGATION decision failed");
    console.log("  ✔ 2.3 Vigilance marked complaint as INVESTIGATION");

    // 2.4 Check FD Status: Expects ON PROCESS
    const fdSync3 = await (await fdClient.get("/fd/compliance-status")).json();
    const instFd3 = fdSync3.find((item: any) => item.institutionId === instId);
    if (!instFd3 || instFd3.vigilanceStatus !== "ON PROCESS") {
      throw new Error(`FD Sync failed: Expected Vigilance ON PROCESS, got ${instFd3?.vigilanceStatus}`);
    }
    console.log(`  ✔ 2.4 FD Portal synchronized: Vigilance Verification Status = "${instFd3.vigilanceStatus}"`);

    // 2.5 Vigilance Mark UNPROVEN
    const vigUnprovenRes = await vigClient.post(`/vigilance/complaint/${vigData.complaintId}/decision`, {
      decision: "UNPROVEN",
      reason: "Audited bank statements confirmed all transactions conformed to government fee ceilings.",
    });
    if (!vigUnprovenRes.ok) throw new Error("Vigilance UNPROVEN decision failed");
    console.log("  ✔ 2.5 Vigilance marked complaint as UNPROVEN");

    // 2.6 Check FD Status: Expects VERIFIED
    const fdSync4 = await (await fdClient.get("/fd/compliance-status")).json();
    const instFd4 = fdSync4.find((item: any) => item.institutionId === instId);
    if (!instFd4 || instFd4.vigilanceStatus !== "VERIFIED") {
      throw new Error(`FD Sync failed: Expected Vigilance VERIFIED, got ${instFd4?.vigilanceStatus}`);
    }
    console.log(`  ✔ 2.6 FD Portal synchronized: Vigilance Verification Status = "${instFd4.vigilanceStatus}"`);

    // 2.7 Vigilance Outcome Letter Generation & Dispatch
    const genVigLetter = await (await fdClient.post("/fd/compliance-letter/generate", {
      institutionId: instId,
      department: "VIGILANCE",
    })).json();
    console.log(`  ✔ 2.7 Generated Official Vigilance Letter Draft: ${genVigLetter.letterReference}`);

    const sendVigLetter = await fdClient.post("/fd/compliance-letter/send", {
      letterReference: genVigLetter.letterReference,
      institutionId: instId,
      department: "VIGILANCE",
      status: genVigLetter.status,
      content: genVigLetter.content,
      reason: genVigLetter.reason,
      complaintReferences: genVigLetter.complaintReferences,
    });
    if (!sendVigLetter.ok) throw new Error("Vigilance letter dispatch failed");
    createdLetterRefs.push(genVigLetter.letterReference);
    console.log(`  ✔ 2.8 Dispatched Vigilance Outcome Letter: ${genVigLetter.letterReference}`);

    // -------------------------------------------------------------------------
    // TEST 3 — MULTIPLE COMPLAINTS AGGREGATION PRECEDENCE
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 3: Aggregation Precedence (PROVEN > INVESTIGATION > PENDING > VERIFIED)");

    // Submit an UNPROVEN complaint alongside an ongoing INVESTIGATION
    const comp3Res = await (await publicClient.post("/public/complaints/pgrc", {
      complainantName: "Student 2",
      complainantEmail: "student2@example.com",
      institutionId: instId,
      description: "Hostel mess hygiene concern.",
    })).json();
    createdComplaintIds.push(comp3Res.complaintId);

    // Mark as UNPROVEN
    await pgrcClient.post(`/pgrc/complaint/${comp3Res.complaintId}/decision`, {
      decision: "UNPROVEN",
      reason: "Mess food analysis reports fully compliant with FSSAI norms.",
    });

    // Check FD status: Should REMAIN REJECTED because complaint 1 is PROVEN!
    const fdSync5 = await (await fdClient.get("/fd/compliance-status")).json();
    const instFd5 = fdSync5.find((item: any) => item.institutionId === instId);
    if (!instFd5 || instFd5.pgrcStatus !== "REJECTED") {
      throw new Error(`Precedence failure: One UNPROVEN complaint overrode PROVEN status!`);
    }
    console.log(`  ✔ 3.1 Correct Precedence: PGRC Status remains "${instFd5.pgrcStatus}" despite new unproven complaint.`);

    // -------------------------------------------------------------------------
    // TEST 4 — SECURITY & CROSS-DEPARTMENT PROTECTION
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 4: Security & Cross-Department Protection");

    // 4.1 PGRC officer trying to modify Vigilance complaint -> Must be 403 Forbidden
    const crossMod1 = await pgrcClient.post(`/pgrc/complaint/${vigData.complaintId}/decision`, {
      decision: "PROVEN",
      reason: "Unauthorized attempt",
    });
    if (crossMod1.status !== 403 && crossMod1.status !== 404) {
      throw new Error(`Security breach: PGRC employee was not blocked from modifying Vigilance complaint (status: ${crossMod1.status})`);
    }
    console.log(`  ✔ 4.1 PGRC officer strictly blocked from modifying Vigilance complaint (HTTP ${crossMod1.status})`);

    // 4.2 Unauthenticated user cannot access employee decisions
    const unauthClient = new TestClient();
    const unauthMod = await unauthClient.post(`/pgrc/complaint/${pgrcData.complaintId}/decision`, {
      decision: "PROVEN",
      reason: "Anonymous hack attempt",
    });
    if (unauthMod.status !== 401 && unauthMod.status !== 403) {
      throw new Error(`Security breach: Public user accessed employee decision endpoint (status: ${unauthMod.status})`);
    }
    console.log(`  ✔ 4.2 Public users strictly blocked from employee decision endpoints (HTTP ${unauthMod.status})`);

    console.log("\n================================================================================");
    console.log("ALL INTEGRATION TESTS PASSED (100% SUCCESS)");
    console.log("================================================================================");
  } finally {
    // Clean up isolated test complaints and letters to maintain database cleanliness
    console.log("\nCleaning up isolated test data...");
    if (createdComplaintIds.length > 0) {
      await Complaint.deleteMany({ complaintReference: { $in: createdComplaintIds } });
      console.log(`  Removed ${createdComplaintIds.length} test complaints.`);
    }
    if (createdLetterRefs.length > 0) {
      await ComplaintLetter.deleteMany({ letterReference: { $in: createdLetterRefs } });
      console.log(`  Removed ${createdLetterRefs.length} test outcome letters.`);
    }
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  });
