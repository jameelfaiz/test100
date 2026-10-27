/**
 * integration_real_flow_test.ts
 * Verifies real Institution-to-FD data flow, MongoDB persistence, and PGRC/Vigilance workflows
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = "http://localhost:5000";
const CRED_PATH = path.resolve(__dirname, "..", "EMPLOYEE_CREDENTIALS.local");

// Parse employee credentials
function getEmployeeCreds() {
  const raw = fs.readFileSync(CRED_PATH, "utf8");
  const creds: Record<string, string> = {};
  let currentUser = "";
  for (const line of raw.split("\n")) {
    const userMatch = line.match(/^User ID\s+:\s+(.+)$/);
    const passMatch = line.match(/^Password\s+:\s+(.+)$/);
    if (userMatch) currentUser = userMatch[1].trim();
    if (passMatch && currentUser) {
      creds[currentUser] = passMatch[1].trim();
      currentUser = "";
    }
  }
  return creds;
}

// Session helper
class SessionClient {
  cookie = "";
  csrfToken = "";

  async initCsrf() {
    const res = await fetch(`${BASE}/api/auth/csrf-token`, {
      headers: this.cookie ? { Cookie: this.cookie } : {},
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.appendCookie(setCookie);
    const data = await res.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  appendCookie(setCookieHeader: string) {
    const parts = setCookieHeader.split(",").map(c => c.trim().split(";")[0]);
    const map = new Map<string, string>();
    if (this.cookie) {
      this.cookie.split(";").forEach(c => {
        const [k, v] = c.trim().split("=");
        if (k) map.set(k, v);
      });
    }
    parts.forEach(p => {
      const [k, v] = p.split("=");
      if (k) map.set(k, v);
    });
    this.cookie = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async post(path: string, body: any) {
    if (!this.csrfToken) await this.initCsrf();
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": this.csrfToken,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.appendCookie(setCookie);
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch {}
    if (json?.csrfToken) {
      this.csrfToken = json.csrfToken;
    }
    return { status: res.status, ok: res.ok, json };
  }

  async get(path: string) {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.appendCookie(setCookie);
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, ok: res.ok, json };
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("REAL DATA FLOW & MONGODB INTEGRATION TEST SUITE");
  console.log("============================================================\n");

  const creds = getEmployeeCreds();
  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${msg}`);
      passCount++;
    } else {
      console.error(`  ✖ FAIL: ${msg}`);
      failCount++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. FD Employee Login & Verification of Real DB Data (Zero Mock)
  // --------------------------------------------------------------------------
  console.log("1. TESTING FD EMPLOYEE PORTAL DATA RETRIEVAL...");
  const fdClient = new SessionClient();
  await fdClient.initCsrf();
  const fdLogin = await fdClient.post("/api/auth/login", {
    userId: "fd_emp",
    password: creds["fd_emp"],
  });
  assert(fdLogin.status === 200, "FD Employee logged in successfully");

  const fdDashboard = await fdClient.get("/api/fd/dashboard");
  assert(fdDashboard.status === 200, "FD Dashboard stats fetched from MongoDB");
  assert(typeof fdDashboard.json.totalInstitutions === "number", `Total real institutions count: ${fdDashboard.json.totalInstitutions}`);
  assert(typeof fdDashboard.json.aliveFdrsCount === "number", `Real Alive FDRs count: ${fdDashboard.json.aliveFdrsCount}`);

  const initialDepositsRes = await fdClient.get("/api/fd/deposits");
  assert(initialDepositsRes.status === 200, "FD Deposits retrieved from MongoDB");
  const initialDeposits = initialDepositsRes.json;
  console.log(`  Current genuine deposits in MongoDB: ${initialDeposits.length}`);

  // --------------------------------------------------------------------------
  // 2. Institution Registration, Email Verification, Login & Profile Completion
  // --------------------------------------------------------------------------
  console.log("\n2. TESTING INSTITUTION ONBOARDING & SUBMISSION (REAL FDR RECORD)...");
  const instClient = new SessionClient();
  await instClient.initCsrf();

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const instEmail = `principal.delhi${randSuffix}@aicte-tech.ac.in`;
  const instPassword = "StrongPassword@2026!";

  // Register via /api/institution/register
  const instReg = await instClient.post("/api/institution/register", {
    name: `Delhi Institute of Technology ${randSuffix}`,
    approvalNumber: `AICTE-NORTH-${randSuffix}`,
    institutionType: "Engineering",
    email: instEmail,
    contactNumber: "9876543210",
    state: "Delhi",
    district: "South Delhi",
    address: "Institutional Area, Sector 5, Vasant Kunj",
    principalName: "Dr. Arvind Sharma",
    authorizedContactPerson: "Dr. Arvind Sharma",
    password: instPassword,
    confirmPassword: instPassword,
  });
  assert(instReg.status === 201, `Registered real institution with email: ${instEmail}`);
  const assignedCollegeId = instReg.json.collegeId;
  const verificationToken = instReg.json.verificationToken;
  assert(!!assignedCollegeId, `Assigned College ID: ${assignedCollegeId}`);
  assert(!!verificationToken, `Generated secure verification token`);

  // Verify Email
  const verifyEmailRes = await instClient.post("/api/auth/verify-email", {
    token: verificationToken,
  });
  assert(verifyEmailRes.status === 200, "Email verified successfully, institution account is ACTIVE");

  // Login as new institution
  const loginRes = await instClient.post("/api/auth/login", {
    userId: assignedCollegeId,
    password: instPassword,
  });
  assert(loginRes.status === 200, `Institution logged in with College ID: ${assignedCollegeId}`);
  assert(loginRes.json.profileCompleted === false, "First-time login correctly flags profileCompleted: false");

  // Complete mandatory institution profile
  const profileRes = await instClient.post("/api/institution/complete-profile", {
    trustName: "Delhi Technical Education Society",
    registrationYear: "2010",
    phone: "9876543210",
    address: "Institutional Area, Sector 5, Vasant Kunj",
    city: "New Delhi",
    state: "Delhi",
    pinCode: "110070",
    principalName: "Dr. Arvind Sharma",
    principalEmail: instEmail,
    principalPhone: "9876543211",
  });
  assert(profileRes.status === 200, "Institution mandatory profile completion saved in MongoDB");

  // Submit genuine Payment / FDR
  const fdrRefNum = `FDR-${Date.now().toString().slice(-6)}`;
  const fdrAmount = 3500000; // 35 Lakhs
  const fdrSubmitRes = await instClient.post("/api/institution/payment", {
    amount: fdrAmount,
    currency: "INR",
    paymentType: "FDR",
    fdrNumber: fdrRefNum,
    referenceNumber: fdrRefNum,
    bankName: "State Bank of India",
    branchName: "Vasant Kunj Branch",
    maturityDate: "2031-10-25",
    jointAccountFlag: true,
    bankEmployee: {
      name: "Suresh Mehra",
      designation: "Chief Branch Manager",
      mobile: "9811223344",
      email: "suresh.mehra@sbi.co.in",
    },
    documents: [
      {
        id: "doc-fdr-receipt",
        name: "Fixed Deposit Receipt Copy",
        type: "PDF",
        size: "1.8 MB",
        status: "Pending",
        file: "fdr_receipt_scan.pdf",
      },
      {
        id: "doc-joint-mandate",
        name: "Joint Lien AICTE Mandate Letter",
        type: "PDF",
        size: "1.1 MB",
        status: "Pending",
        file: "joint_mandate_letter.pdf",
      },
    ],
  });
  assert(fdrSubmitRes.status === 201, `Institution submitted genuine FDR #${fdrRefNum} for ₹${fdrAmount}`);

  // --------------------------------------------------------------------------
  // 3. Verify FD Portal Displays Exact Genuine Submission
  // --------------------------------------------------------------------------
  console.log("\n3. VERIFYING FD PORTAL RETRIEVAL & EXACT MATCH...");
  const fdDepositsAfter = await fdClient.get("/api/fd/deposits");
  assert(fdDepositsAfter.status === 200, "FD Employee fetched updated deposit list");
  const foundDeposit = fdDepositsAfter.json.find((d: any) => d.fdrNumber === fdrRefNum || d.fdrReference === fdrRefNum);
  assert(!!foundDeposit, `Found submitted FDR #${fdrRefNum} in FD deposits list`);
  assert(foundDeposit?.collegeId === assignedCollegeId, `Institution ID matched: ${foundDeposit?.collegeId}`);
  assert(foundDeposit?.collegeName.includes("Delhi Institute of Technology"), `College Name matched: ${foundDeposit?.collegeName}`);
  assert(foundDeposit?.amount === fdrAmount, `Deposit Amount matched: ₹${foundDeposit?.amount}`);
  assert(foundDeposit?.documents?.length === 2, `Deposit has 2 submitted documents`);

  // --------------------------------------------------------------------------
  // 4. FD Review & Verification Updates MongoDB Record
  // --------------------------------------------------------------------------
  console.log("\n4. TESTING FD DOCUMENT VERIFICATION & OFFICIAL LETTER DISPATCH...");
  const verifyDoc1 = await fdClient.post(`/api/fd/deposit/${foundDeposit.id}/verify-document`, {
    docId: "doc-fdr-receipt",
    status: "Verified",
  });
  assert(verifyDoc1.status === 200, "FD Employee marked Fixed Deposit Receipt as 'Verified'");

  const verifyDoc2 = await fdClient.post(`/api/fd/deposit/${foundDeposit.id}/verify-document`, {
    docId: "doc-joint-mandate",
    status: "Verified",
  });
  assert(verifyDoc2.status === 200, "FD Employee marked Joint Mandate as 'Verified'");

  // Send official verification letter
  const sendLetterRes = await fdClient.post(`/api/fd/deposit/${foundDeposit.id}/send-verification-letter`, {
    docId: "doc-fdr-receipt",
  });
  assert(sendLetterRes.status === 200, "FD Employee dispatched Official Verification Letter");
  assert(sendLetterRes.json.letterRecord?.deliveryStatus === "Sent", "Letter delivery status recorded as 'Sent'");

  // --------------------------------------------------------------------------
  // 5. Institution Portal Sees the Updated Status
  // --------------------------------------------------------------------------
  console.log("\n5. VERIFYING INSTITUTION SEES UPDATED STATUS & ALIVE FDRS...");
  const instOverview = await instClient.get("/api/institution/dashboard-overview");
  assert(instOverview.status === 200, "Institution dashboard overview retrieved");
  assert(instOverview.json.stats.verifiedPayments >= 1, `Institution sees verified FDR payment count: ${instOverview.json.stats.verifiedPayments}`);

  // Verify Alive Records in FD portal
  const aliveRecordsRes = await fdClient.get("/api/fd/alive-records");
  assert(aliveRecordsRes.status === 200, "FD Alive Records retrieved");
  const foundAlive = aliveRecordsRes.json.aliveFdrs.find((a: any) => a.fdrNumber === fdrRefNum || a.referenceNumber === fdrRefNum);
  assert(!!foundAlive, `FDR #${fdrRefNum} is active & present in Alive Records`);

  // --------------------------------------------------------------------------
  // 6. PGRC & Vigilance Workflow Integration
  // --------------------------------------------------------------------------
  console.log("\n6. TESTING PGRC & VIGILANCE STATUTORY ESCALATION FLOW...");
  const pgrcClient = new SessionClient();
  await pgrcClient.initCsrf();
  const pgrcLogin = await pgrcClient.post("/api/auth/login", {
    userId: "pgrc_emp",
    password: creds["pgrc_emp"],
  });
  assert(pgrcLogin.status === 200, "PGRC Employee logged in successfully");

  // Create complaint
  const complaintRes = await pgrcClient.post("/api/pgrc/complaint", {
    institutionId: assignedCollegeId,
    title: "Allegation of unauthorized fee collection",
    description: "Inspection required regarding non-prescribed laboratory maintenance fees collected from students.",
  });
  assert(complaintRes.status === 201, `PGRC created complaint record #${complaintRes.json.complaintId}`);
  const compId = complaintRes.json.complaintId;

  // Escalate to Vigilance
  const escalateRes = await pgrcClient.post(`/api/pgrc/complaint/${compId}/escalate`, {});
  assert(escalateRes.status === 201, `PGRC escalated complaint to Vigilance. Investigation ID: ${escalateRes.json.investigationId}`);
  const invId = escalateRes.json.investigationId;

  // Vigilance employee login & action
  const vigilClient = new SessionClient();
  await vigilClient.initCsrf();
  const vigilLogin = await vigilClient.post("/api/auth/login", {
    userId: "vigil_emp1",
    password: creds["vigil_emp1"],
  });
  assert(vigilLogin.status === 200, "Vigilance Employee logged in successfully");

  // Assign investigator
  const assignRes = await vigilClient.post(`/api/vigilance/investigation/${invId}/assign`, {
    investigatorUserId: "vigil_emp1",
  });
  assert(assignRes.status === 200, `Investigator vigil_emp1 assigned to investigation ${invId}`);

  // Submit findings
  const findingsRes = await vigilClient.post(`/api/vigilance/investigation/${invId}/findings`, {
    findings: "Audited financial ledgers and bank deposits. No unauthorized levies detected. Institution strictly adheres to AICTE handbook regulations.",
    status: "UNDER_REVIEW",
  });
  assert(findingsRes.status === 200, `Findings recorded. Investigation status set to UNDER_REVIEW`);

  // Finalize / Approve outcome
  const approveRes = await vigilClient.post(`/api/vigilance/investigation/${invId}/approve`, {
    decision: "UNSUBSTANTIATED",
  });
  assert(approveRes.status === 200, `Investigation finalized with decision: UNSUBSTANTIATED`);
  assert(approveRes.json.investigation.status === "COMPLETED", "Investigation status marked as COMPLETED in MongoDB");

  // Verify complaint resolution
  const pgrcComplaints = await pgrcClient.get("/api/pgrc/complaints");
  const updatedComp = pgrcComplaints.json.find((c: any) => c._id === compId);
  assert(updatedComp?.status === "RESOLVED", `Linked complaint status automatically updated to ${updatedComp?.status}`);
  assert(updatedComp?.finalOutcome === "UNSUBSTANTIATED", `Linked complaint final outcome set to ${updatedComp?.finalOutcome}`);

  console.log("\n============================================================");
  console.log(`TOTAL TEST RESULTS: ${passCount} PASSED / ${failCount} FAILED`);
  console.log("============================================================");

  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
