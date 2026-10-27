// test_pgrc_vigilance_fd_integration.ts
/**
 * Comprehensive Automated End-to-End Integration Test Suite
 * Covers Tests A to O for:
 * - Common Portal Authentication & Authorization
 * - Public Complaint Submission & Anonymous Tracking
 * - PGRC Employee Portal (Accept, Assign, Notes, Finalize Finding)
 * - Vigilance Employee Portal (Assign, Findings, Supervisor Authorization)
 * - AICTE FD Employee Portal (Real-time Clearance Calculation, Refresh Clearance, Document Verification & Release Decision)
 *
 * Run with: npx tsx backend/test_pgrc_vigilance_fd_integration.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./src/db";
import { User } from "./src/models/User";
import { Institution } from "./src/models/Institution";
import { Complaint } from "./src/models/Complaint";
import { Investigation } from "./src/models/Investigation";
import { ReleaseRequest } from "./src/models/ReleaseRequest";
import { Notification } from "./src/models/Notification";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:5000/api";
const CRED_PATH = path.resolve(__dirname, "..", "EMPLOYEE_CREDENTIALS.local");

// ── Parse credentials ────────────────────────────────────────────────────────
function parseCredentials(): Record<string, string> {
  if (!fs.existsSync(CRED_PATH)) {
    throw new Error(`Credentials file not found at ${CRED_PATH}`);
  }
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

// ── HTTP Client with Cookie and CSRF Tracking ────────────────────────────────
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

  async login(userId: string, password: string) {
    await this.getCsrf();
    const res = await this.post("/auth/login", { userId, password });
    await this.getCsrf();
    return res;
  }

  async post(path: string, body: any) {
    if (!this.csrfToken) await this.getCsrf();
    let res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": this.csrfToken,
        Cookie: this.cookies.join("; "),
      },
      body: JSON.stringify(body),
    });
    this.extractCookies(res);
    if (res.status === 403) {
      await this.getCsrf();
      res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": this.csrfToken,
          Cookie: this.cookies.join("; "),
        },
        body: JSON.stringify(body),
      });
      this.extractCookies(res);
    }
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { rawText: text };
    }
    return { status: res.status, ok: res.ok, data: json };
  }

  async get(path: string) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Cookie: this.cookies.join("; ") },
    });
    this.extractCookies(res);
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { rawText: text };
    }
    return { status: res.status, ok: res.ok, data: json };
  }
}

// ── Test Runner ──────────────────────────────────────────────────────────────
async function run() {
  console.log("================================================================================");
  console.log("UNIFIED AICTE PORTAL: INTEGRATED TEST SUITE (TESTS A TO O)");
  console.log("Real Database Verification & Multi-Portal End-to-End Execution");
  console.log("================================================================================\n");

  await connectDB();
  const creds = parseCredentials();

  const fdPass = creds["fd_emp"];
  const pgrcPass = creds["pgrc_emp"];
  const vigilPass = creds["vigil_emp1"];

  if (!fdPass || !pgrcPass || !vigilPass) {
    console.error("Missing employee passwords in EMPLOYEE_CREDENTIALS.local!");
    process.exit(1);
  }

  // Initialize clients
  const clientFD = new TestClient();
  const clientPGRC = new TestClient();
  const clientVigilance = new TestClient();
  const clientPublic = new TestClient();

  // Log in the 3 employees
  console.log("[SETUP] Authenticating Employee Accounts...");
  const loginFD = await clientFD.login("fd_emp", fdPass);
  const loginPGRC = await clientPGRC.login("pgrc_emp", pgrcPass);
  const loginVigil = await clientVigilance.login("vigil_emp1", vigilPass);

  if (loginFD.status !== 200 || loginPGRC.status !== 200 || loginVigil.status !== 200) {
    console.error("Failed to authenticate one or more employees:", {
      fd: loginFD.status,
      pgrc: loginPGRC.status,
      vigil: loginVigil.status,
    });
    process.exit(1);
  }
  console.log("✓ AICTE FD Employee Authenticated (fd_emp)");
  console.log("✓ PGRC Employee Authenticated (pgrc_emp)");
  console.log("✓ Vigilance Employee Authenticated (vigil_emp1)\n");

  const results: { test: string; title: string; pass: boolean; details: string }[] = [];

  const record = (test: string, title: string, pass: boolean, details: string) => {
    results.push({ test, title, pass, details });
    const mark = pass ? "✓ PASS" : "✗ FAIL";
    console.log(`[TEST ${test}] ${mark} - ${title}`);
    console.log(`         Details: ${details}\n`);
  };

  const ts = Date.now();

  // Helper to create a test institution and release request
  async function createTestInstitutionAndRelease(code: string, name: string) {
    const collegeId = `TEST-CLG-${code}-${ts}`;
    const inst = await Institution.create({
      name,
      collegeId,
      email: `${code.toLowerCase()}_${ts}@institute.edu`,
      phone: "9876543210",
      state: "Maharashtra",
      district: "Pune",
      address: `Campus ${code}, Tech City`,
      registrationStatus: "APPROVED",
      profileCompleted: true,
    });

    const releaseRequestId = `REL-${code}-${ts}`;
    const releaseReq = await ReleaseRequest.create({
      collegeId,
      institutionId: inst._id.toString(),
      releaseRequestId,
      applicationId: releaseRequestId,
      fdrReference: `FDR-${code}-${ts}`,
      depositDetails: "₹35,00,000 in SBI AICTE Joint Account",
      reason: "Completion of 8-year lock-in period for Engineering Programme",
      documents: ["eoa.pdf", "affidavit.pdf", "approval.pdf", "fdr.pdf"],
      documentItems: [
        { id: `${releaseRequestId}-DOC-1`, name: "Extension of Approval (EoA)", status: "Verified", remarks: "" },
        { id: `${releaseRequestId}-DOC-2`, name: "Joint Undertaking Affidavit", status: "Verified", remarks: "" },
        { id: `${releaseRequestId}-DOC-3`, name: "Release Approval Letter", status: "Verified", remarks: "" },
        { id: `${releaseRequestId}-DOC-4`, name: "FDR Receipt Copy", status: "Verified", remarks: "" },
      ],
      submissionDate: new Date(),
      status: "Pending",
      overallReleaseStatus: "Pending",
    });

    return { inst, releaseReq, collegeId, releaseRequestId };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST A: No Complaints -> PGRC: APPROVED, Vigilance: APPROVED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, releaseRequestId } = await createTestInstitutionAndRelease("A", "Alpha Engineering College");
    
    // Call FD clearance endpoint
    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const pgrc = res.data?.pgrcClearance;
    const vig = res.data?.vigilanceClearance;
    const overall = res.data?.overallDecision;

    const pass =
      res.status === 200 &&
      pgrc?.status === "APPROVED" &&
      pgrc?.reason === "No Complaints Found" &&
      vig?.status === "APPROVED" &&
      vig?.reason === "No Complaints Found" &&
      overall?.isEligibleForApproval === true;

    record(
      "A",
      "No Complaints -> PGRC: APPROVED, Vigilance: APPROVED, Overall: ELIGIBLE",
      pass,
      `PGRC: ${pgrc?.status} (${pgrc?.reason}), Vigilance: ${vig?.status} (${vig?.reason}), Overall: ${overall?.overallStatus}`
    );
  } catch (err: any) {
    record("A", "No Complaints -> PGRC: APPROVED, Vigilance: APPROVED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST B: PGRC Proven Complaint -> PGRC: REJECTED, Overall: REJECTED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("B", "Beta Institute of Technology");

    // Insert a PROVEN PGRC complaint in MongoDB
    const compB = await Complaint.create({
      complaintReference: `COMP-${ts}-B`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Ramesh Sharma", email: "ramesh@example.com", mobile: "9876543210" },
      category: "Admission Irregularity",
      title: "Capitation fee charged over approved limits",
      subject: "Capitation fee charged over approved limits",
      description: "Direct evidence collected of excessive fees charged to students.",
      assignedDepartment: "PGRC",
      status: "PROVEN",
      finalOutcome: "PROVEN",
      findingSummary: "Evidence of illegal capitation fees confirmed by committee.",
      finalizedBy: "pgrc_emp",
      finalizedAt: new Date(),
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const pgrc = res.data?.pgrcClearance;
    const overall = res.data?.overallDecision;

    const pass =
      res.status === 200 &&
      pgrc?.status === "REJECTED" &&
      pgrc?.reason === "Proven Complaint" &&
      overall?.overallStatus === "REJECTED" &&
      overall?.isEligibleForApproval === false;

    record(
      "B",
      "PGRC Proven -> PGRC: REJECTED, Overall: REJECTED",
      pass,
      `PGRC: ${pgrc?.status} (${pgrc?.reason}), Overall: ${overall?.overallStatus}, Eligible: ${overall?.isEligibleForApproval}`
    );
  } catch (err: any) {
    record("B", "PGRC Proven -> PGRC: REJECTED, Overall: REJECTED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST C: PGRC Not Proven -> PGRC: APPROVED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("C", "Gamma Polytechnic Institute");

    // Insert a finalized NOT_PROVEN complaint
    await Complaint.create({
      complaintReference: `COMP-${ts}-C`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Sunil Verma", email: "sunil@example.com", mobile: "9876543211" },
      category: "Faculty Grievance",
      title: "Allegation of delayed pay",
      subject: "Allegation of delayed pay",
      description: "Audit confirmed salary disbursements were on schedule.",
      assignedDepartment: "PGRC",
      status: "NOT_PROVEN",
      finalOutcome: "NOT_PROVEN",
      findingSummary: "Bank disbursement records reviewed; salary disbursed on time.",
      finalizedBy: "pgrc_emp",
      finalizedAt: new Date(),
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const pgrc = res.data?.pgrcClearance;

    const pass =
      res.status === 200 &&
      pgrc?.status === "APPROVED" &&
      pgrc?.reason === "Complaint Not Proven";

    record(
      "C",
      "PGRC Not Proven -> PGRC: APPROVED",
      pass,
      `PGRC: ${pgrc?.status} (${pgrc?.reason})`
    );
  } catch (err: any) {
    record("C", "PGRC Not Proven -> PGRC: APPROVED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST D: PGRC On Process -> PGRC: MATURITY EXTENDED, Overall: MATURITY_EXTENDED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("D", "Delta College of Engineering");

    // Insert an ON_PROCESS / UNDER_INVESTIGATION complaint
    await Complaint.create({
      complaintReference: `COMP-${ts}-D`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Ananya Roy", email: "ananya@example.com", mobile: "9876543212" },
      category: "Infrastructure Deficiency",
      title: "Laboratory equipment inspection pending",
      subject: "Laboratory equipment inspection pending",
      description: "Field verification visit scheduled next week.",
      assignedDepartment: "PGRC",
      status: "UNDER_INVESTIGATION",
      investigationStatus: "UNDER_INVESTIGATION",
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const pgrc = res.data?.pgrcClearance;
    const overall = res.data?.overallDecision;

    const pass =
      res.status === 200 &&
      (pgrc?.status === "MATURITY EXTENDED" || pgrc?.status === "MATURITY DATE EXTENDED") &&
      pgrc?.reason === "Complaint Investigation in Progress" &&
      overall?.overallStatus === "MATURITY_EXTENDED" &&
      overall?.isEligibleForApproval === false;

    record(
      "D",
      "PGRC On Process -> PGRC: MATURITY EXTENDED, Overall: MATURITY_EXTENDED",
      pass,
      `PGRC: ${pgrc?.status} (${pgrc?.reason}), Overall: ${overall?.overallStatus}`
    );
  } catch (err: any) {
    record("D", "PGRC On Process -> PGRC: MATURITY EXTENDED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST E: Vigilance Proven -> Vigilance: REJECTED, Overall: REJECTED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("E", "Epsilon Business Academy");

    // Insert a Complaint that routes to Vigilance
    const compE = await Complaint.create({
      complaintReference: `COMP-VIG-${ts}-E`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Audit Officer", email: "audit_e@test.com", mobile: "9876500010" },
      category: "Fraud or Corruption",
      title: "Diversion of funds",
      subject: "Diversion of funds",
      description: "Diversion of institutional funds.",
      assignedDepartment: "VIGILANCE",
      status: "ESCALATED",
    });

    // Insert a PROVEN Vigilance Investigation
    await Investigation.create({
      investigationId: `INV-${ts}-E`,
      complaintId: compE._id,
      institutionId: inst._id.toString(),
      collegeId,
      complaintReference: `COMP-VIG-${ts}-E`,
      status: "COMPLETED",
      findings: "Substantiated diversion of institutional endowment funds.",
      findingSummary: "Diversion of institutional endowment funds confirmed.",
      finalOutcome: "PROVEN",
      supervisorDecision: "PROVEN",
      finalizedBy: "vigil_emp1",
      finalizedAt: new Date(),
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const vig = res.data?.vigilanceClearance;
    const overall = res.data?.overallDecision;

    const pass =
      res.status === 200 &&
      vig?.status === "REJECTED" &&
      vig?.reason === "Proven Investigation" &&
      overall?.overallStatus === "REJECTED" &&
      overall?.isEligibleForApproval === false;

    record(
      "E",
      "Vigilance Proven -> Vigilance: REJECTED, Overall: REJECTED",
      pass,
      `Vigilance: ${vig?.status} (${vig?.reason}), Overall: ${overall?.overallStatus}`
    );
  } catch (err: any) {
    record("E", "Vigilance Proven -> Vigilance: REJECTED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST F: Vigilance Not Proven -> Vigilance: APPROVED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("F", "Foxtrot Institute of Management");

    const compF = await Complaint.create({
      complaintReference: `COMP-VIG-${ts}-F`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Audit Officer", email: "audit_f@test.com", mobile: "9876500011" },
      category: "Financial Irregularities",
      title: "Scholarship fund check",
      subject: "Scholarship fund check",
      description: "Scholarship disbursement allegations.",
      assignedDepartment: "VIGILANCE",
      status: "ESCALATED",
    });

    await Investigation.create({
      investigationId: `INV-${ts}-F`,
      complaintId: compF._id,
      institutionId: inst._id.toString(),
      collegeId,
      complaintReference: `COMP-VIG-${ts}-F`,
      status: "COMPLETED",
      findings: "Audit showed all scholarship disbursements reconciled with state treasury.",
      findingSummary: "Scholarship disbursement allegations unsubstantiated.",
      finalOutcome: "NOT_PROVEN",
      supervisorDecision: "UNSUBSTANTIATED",
      finalizedBy: "vigil_emp1",
      finalizedAt: new Date(),
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const vig = res.data?.vigilanceClearance;

    const pass =
      res.status === 200 &&
      vig?.status === "APPROVED" &&
      vig?.reason === "Investigation Not Proven";

    record(
      "F",
      "Vigilance Not Proven -> Vigilance: APPROVED",
      pass,
      `Vigilance: ${vig?.status} (${vig?.reason})`
    );
  } catch (err: any) {
    record("F", "Vigilance Not Proven -> Vigilance: APPROVED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST G: Vigilance On Process -> Vigilance: MATURITY EXTENDED, Overall: MATURITY_EXTENDED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("G", "Galaxy Technical University");

    const compG = await Complaint.create({
      complaintReference: `COMP-VIG-${ts}-G`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Audit Officer", email: "audit_g@test.com", mobile: "9876500012" },
      category: "Financial Irregularities",
      title: "Procurement invoice audit",
      subject: "Procurement invoice audit",
      description: "Forensic audit ongoing.",
      assignedDepartment: "VIGILANCE",
      status: "ESCALATED",
    });

    await Investigation.create({
      investigationId: `INV-${ts}-G`,
      complaintId: compG._id,
      institutionId: inst._id.toString(),
      collegeId,
      complaintReference: `COMP-VIG-${ts}-G`,
      status: "UNDER_INVESTIGATION",
      investigationNotes: [{ note: "Forensic audit team dispatched.", author: "vigil_emp1", date: new Date() }],
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const vig = res.data?.vigilanceClearance;
    const overall = res.data?.overallDecision;

    const pass =
      res.status === 200 &&
      (vig?.status === "MATURITY EXTENDED" || vig?.status === "MATURITY DATE EXTENDED") &&
      vig?.reason === "Investigation in Progress" &&
      overall?.overallStatus === "MATURITY_EXTENDED";

    record(
      "G",
      "Vigilance On Process -> Vigilance: MATURITY EXTENDED, Overall: MATURITY_EXTENDED",
      pass,
      `Vigilance: ${vig?.status} (${vig?.reason}), Overall: ${overall?.overallStatus}`
    );
  } catch (err: any) {
    record("G", "Vigilance On Process -> Vigilance: MATURITY EXTENDED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST H: Multiple Complaints (one NOT_PROVEN, one PROVEN) -> REJECTED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("H", "Horizon College of Pharmacy");

    // Complaint 1: NOT_PROVEN
    await Complaint.create({
      complaintReference: `COMP-${ts}-H1`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "User 1", email: "u1@test.com", mobile: "9876500001" },
      category: "Library Facility",
      title: "Library books count dispute",
      subject: "Library books count dispute",
      description: "Books found compliant with AICTE norms.",
      assignedDepartment: "PGRC",
      status: "NOT_PROVEN",
      finalOutcome: "NOT_PROVEN",
      findingSummary: "Library count matches catalog.",
    });

    // Complaint 2: PROVEN
    await Complaint.create({
      complaintReference: `COMP-${ts}-H2`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "User 2", email: "u2@test.com", mobile: "9876500002" },
      category: "Faculty Ratio",
      title: "Ghost faculty listed in portal",
      subject: "Ghost faculty listed in portal",
      description: "Physical audit verified 8 listed faculty were not present.",
      assignedDepartment: "PGRC",
      status: "PROVEN",
      finalOutcome: "PROVEN",
      findingSummary: "Ghost faculty violation proven.",
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const pgrc = res.data?.pgrcClearance;
    const overall = res.data?.overallDecision;

    const pass =
      res.status === 200 &&
      pgrc?.status === "REJECTED" &&
      overall?.overallStatus === "REJECTED";

    record(
      "H",
      "Multiple Complaints (one NOT_PROVEN, one PROVEN) -> REJECTED Precedence",
      pass,
      `PGRC: ${pgrc?.status} (${pgrc?.reason}), Overall: ${overall?.overallStatus}`
    );
  } catch (err: any) {
    record("H", "Multiple Complaints -> REJECTED Precedence", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST I: Mixed Portals (PGRC NOT_PROVEN, Vigilance ON_PROCESS) -> MATURITY_EXTENDED
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("I", "Imperial Institute of Science");

    // PGRC complaint finalized NOT_PROVEN
    await Complaint.create({
      complaintReference: `COMP-${ts}-I`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Faculty Member", email: "fac@test.com", mobile: "9876500003" },
      category: "Academic Grievance",
      title: "Classroom allocation dispute",
      subject: "Classroom allocation dispute",
      description: "Resolved internally.",
      assignedDepartment: "PGRC",
      status: "NOT_PROVEN",
      finalOutcome: "NOT_PROVEN",
      findingSummary: "Resolved through timetable restructuring.",
    });

    // Vigilance complaint and investigation in progress
    const compI2 = await Complaint.create({
      complaintReference: `COMP-VIG-${ts}-I`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Vendor Rep", email: "vendor@test.com", mobile: "9876500013" },
      category: "Financial Irregularities",
      title: "Vendor invoice dispute",
      subject: "Vendor invoice dispute",
      description: "Procurement documents review in progress.",
      assignedDepartment: "VIGILANCE",
      status: "ESCALATED",
    });

    await Investigation.create({
      investigationId: `INV-${ts}-I`,
      complaintId: compI2._id,
      institutionId: inst._id.toString(),
      collegeId,
      complaintReference: `COMP-VIG-${ts}-I`,
      status: "UNDER_INVESTIGATION",
      investigationNotes: [{ note: "Procurement documents requested from vendor.", author: "vigil_emp1", date: new Date() }],
    });

    const res = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const pgrc = res.data?.pgrcClearance;
    const vig = res.data?.vigilanceClearance;
    const overall = res.data?.overallDecision;

    const pass =
      res.status === 200 &&
      pgrc?.status === "APPROVED" &&
      (vig?.status === "MATURITY EXTENDED" || vig?.status === "MATURITY DATE EXTENDED") &&
      overall?.overallStatus === "MATURITY_EXTENDED";

    record(
      "I",
      "Mixed Portals (PGRC NOT_PROVEN, Vigilance ON_PROCESS) -> Overall MATURITY_EXTENDED",
      pass,
      `PGRC: ${pgrc?.status}, Vigilance: ${vig?.status}, Overall: ${overall?.overallStatus}`
    );
  } catch (err: any) {
    record("I", "Mixed Portals -> MATURITY_EXTENDED", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST J: FD Document Verification (one doc Not Verified) -> DOCUMENT DEFICIENCY
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("J", "Jupiter Institute of Technology");

    // Mark document 2 as "Not Verified" with remarks
    const docId = `${releaseRequestId}-DOC-2`;
    const verifyRes = await clientFD.post(`/fd/release/${releaseRequestId}/verify-document`, {
      docId,
      status: "Not Verified",
      remarks: "Notary stamp missing on Page 3 of Joint Undertaking Affidavit.",
    });

    // Check release request state in DB
    const updatedRR = await ReleaseRequest.findOne({ releaseRequestId });
    const targetDoc = updatedRR?.documentItems?.find((d: any) => d.id === docId);

    // Check notification in DB
    const notif = await Notification.findOne({
      collegeId,
      type: "DOCUMENT_NOT_VERIFIED",
    });

    const overallRes = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const overall = overallRes.data?.overallDecision;

    const pass =
      verifyRes.status === 200 &&
      targetDoc?.status === "Not Verified" &&
      targetDoc?.remarks === "Notary stamp missing on Page 3 of Joint Undertaking Affidavit." &&
      notif !== null &&
      overall?.overallStatus === "DOCUMENT_DEFICIENCY" &&
      overall?.isEligibleForApproval === false;

    record(
      "J",
      "FD Document Verification (Not Verified with remarks) -> DOCUMENT DEFICIENCY & Notification",
      pass,
      `Doc Status: ${targetDoc?.status}, Overall Status: ${overall?.overallStatus}, Notif Created: ${notif !== null}`
    );
  } catch (err: any) {
    record("J", "FD Document Verification -> DOCUMENT DEFICIENCY", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST K: Full Successful Release (all 4 docs VERIFIED, clearances APPROVED)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("K", "Krypton College of Architecture");

    // All 4 documents are Verified by default in createTestInstitutionAndRelease
    // Verify clearance is APPROVED
    const clearanceRes = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const isEligible = clearanceRes.data?.overallDecision?.isEligibleForApproval;

    // FD Employee executes final decision: Approved
    const decisionRes = await clientFD.post(`/fd/release/${releaseRequestId}/decision`, {
      action: "Approved",
    });

    // Verify DB update
    const finalizedRR = await ReleaseRequest.findOne({ releaseRequestId });
    const notif = await Notification.findOne({
      collegeId,
      title: "Release Application Approved",
    });

    const pass =
      isEligible === true &&
      decisionRes.status === 200 &&
      finalizedRR?.status === "Approved" &&
      finalizedRR?.overallReleaseStatus === "APPROVED" &&
      finalizedRR?.reviewedBy === "fd_emp" &&
      notif !== null;

    record(
      "K",
      "Full Successful Release -> ELIGIBLE_FOR_APPROVAL & Decision APPROVED",
      pass,
      `Eligible: ${isEligible}, Final Status: ${finalizedRR?.status}, ReviewedBy: ${finalizedRR?.reviewedBy}, Notif: ${notif !== null}`
    );
  } catch (err: any) {
    record("K", "Full Successful Release", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST L: Automatic Updates (Real-Time Recalculation via Refresh Clearance)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const { inst, releaseReq, collegeId, releaseRequestId } = await createTestInstitutionAndRelease("L", "Legacy Institute of Applied Science");

    // 1. Submit a complaint for Institution L
    const compL = await Complaint.create({
      complaintReference: `COMP-${ts}-L`,
      institutionId: inst._id.toString(),
      collegeId,
      complainant: { name: "Alok Gupta", email: "alok@test.com", mobile: "9876500004" },
      category: "Examinations Malpractice",
      title: "Mass copying reported during term examination",
      subject: "Mass copying reported during term examination",
      description: "Answer keys allegedly leaked before examination.",
      assignedDepartment: "PGRC",
      status: "UNDER_INVESTIGATION",
    });

    // Initial clearance check: must be MATURITY EXTENDED
    const initialCheck = await clientFD.get(`/fd/release/${releaseRequestId}/clearance`);
    const initialPgrc = initialCheck.data?.pgrcClearance?.status;

    // 2. PGRC Employee finalizes the complaint to PROVEN
    const finalizeRes = await clientPGRC.post(`/pgrc/complaint/${compL._id}/finalize`, {
      outcome: "PROVEN",
      findingSummary: "CCTV footage and independent committee confirmed exam leakage.",
      rationale: "Violation of AICTE Examination Integrity Code Section 12.",
    });

    // 3. FD Employee clicks "Refresh Clearance"
    const refreshRes = await clientFD.post(`/fd/release/${releaseRequestId}/refresh-clearance`, {});

    const refreshedPgrc = refreshRes.data?.pgrcClearance?.status;
    const refreshedOverall = refreshRes.data?.overallDecision?.overallStatus;

    const pass =
      (initialPgrc === "MATURITY EXTENDED" || initialPgrc === "MATURITY DATE EXTENDED") &&
      finalizeRes.status === 200 &&
      refreshRes.status === 200 &&
      refreshedPgrc === "REJECTED" &&
      refreshedOverall === "REJECTED";

    record(
      "L",
      "Automatic Updates: Dynamic Recalculation on Refresh Clearance",
      pass,
      `Initial: ${initialPgrc} -> After PGRC Finalize: ${refreshedPgrc}, Overall: ${refreshedOverall}`
    );
  } catch (err: any) {
    record("L", "Automatic Updates", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST M: Unauthorized Access (Cross-Portal Security Enforcement)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // 1. FD Employee attempts to finalize a PGRC complaint -> HTTP 403
    const compM = await Complaint.create({
      complaintReference: `COMP-${ts}-M`,
      institutionId: "fake-inst",
      collegeId: "FAKE-CLG",
      complainant: { name: "Test Complainant", email: "test@example.com", mobile: "9000000000" },
      title: "Unauthorized test",
      subject: "Unauthorized test",
      description: "Unauthorized test",
      status: "UNDER_INVESTIGATION",
    });

    const fdAttemptsPgrc = await clientFD.post(`/pgrc/complaint/${compM._id}/finalize`, {
      outcome: "PROVEN",
      findingSummary: "Illegal tampering attempt.",
    });

    // 2. PGRC Employee attempts to access FD release decision -> HTTP 403
    const pgrcAttemptsFd = await clientPGRC.post(`/fd/release/ANY-ID/decision`, {
      action: "Approved",
    });

    // 3. Vigilance Employee attempts to verify FD application document -> HTTP 403
    const vigilAttemptsFd = await clientVigilance.post(`/fd/application/ANY-ID/verify-document`, {
      docId: "DOC-1",
      status: "Verified",
    });

    // 4. Public client attempts to access employee clearance -> HTTP 401 / 403
    const publicAttemptsClearance = await clientPublic.get(`/fd/release/ANY-ID/clearance`);

    const pass =
      fdAttemptsPgrc.status === 403 &&
      pgrcAttemptsFd.status === 403 &&
      vigilAttemptsFd.status === 403 &&
      (publicAttemptsClearance.status === 401 || publicAttemptsClearance.status === 403);

    record(
      "M",
      "Unauthorized Access: Strict Role-Based RBAC Enforcement (HTTP 403/401)",
      pass,
      `FD->PGRC: ${fdAttemptsPgrc.status}, PGRC->FD: ${pgrcAttemptsFd.status}, Vigilance->FD: ${vigilAttemptsFd.status}, Public->FD: ${publicAttemptsClearance.status}`
    );
  } catch (err: any) {
    record("M", "Unauthorized Access", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST N: Database Failure & Input Resilience Simulation
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Non-existent release request clearance returns 404
    const notFoundClearance = await clientFD.get(`/fd/release/NON-EXISTENT-REQUEST-ID/clearance`);

    // Non-existent release request decision returns 404
    const notFoundDecision = await clientFD.post(`/fd/release/NON-EXISTENT-REQUEST-ID/decision`, {
      action: "Approved",
    });

    // Document verification with invalid status returns 400
    const invalidStatus = await clientFD.post(`/fd/release/NON-EXISTENT/verify-document`, {
      docId: "DOC-1",
      status: "INVALID_STATUS",
    });

    // Document marked Not Verified without mandatory remarks returns 400
    const missingRemarks = await clientFD.post(`/fd/release/NON-EXISTENT/verify-document`, {
      docId: "DOC-1",
      status: "Not Verified",
      remarks: "",
    });

    const pass =
      notFoundClearance.status === 404 &&
      notFoundDecision.status === 404 &&
      invalidStatus.status === 400 &&
      missingRemarks.status === 400;

    record(
      "N",
      "Database Failure & Resilience Simulation (Input Validation & Error Handling)",
      pass,
      `404 on Missing Clearance: ${notFoundClearance.status}, 404 on Missing Decision: ${notFoundDecision.status}, 400 on Bad Status: ${invalidStatus.status}, 400 on Missing Remarks: ${missingRemarks.status}`
    );
  } catch (err: any) {
    record("N", "Resilience Simulation", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST O: Existing Login Regression & Public Complaint Workflow
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // 1. Create a real institution user in MongoDB
    const collegeIdO = `TEST-CLG-O-${ts}`;
    const instO = await Institution.create({
      name: "Omega Institute of Technology",
      collegeId: collegeIdO,
      email: `omega_${ts}@test.edu`,
      phone: "9876543219",
      state: "Karnataka",
      district: "Bengaluru",
      address: "Outer Ring Road, Bengaluru",
      registrationStatus: "APPROVED",
      profileCompleted: true,
    });

    const instPassword = "Password@123";
    const passwordHash = await bcrypt.hash(instPassword, 10);
    const instUser = await User.create({
      userId: collegeIdO,
      passwordHash,
      role: "INSTITUTION",
      institutionId: instO._id.toString(),
      collegeId: collegeIdO,
      accountStatus: "ACTIVE",
    });

    // 2. Test Institution Login
    const clientInst = new TestClient();
    const instLoginRes = await clientInst.login(collegeIdO, instPassword);
    const instMe = await clientInst.get("/auth/me");

    // 3. Test Public Complaint Submission
    const submitRes = await clientPublic.post("/public/complaint", {
      complainantName: "Public Citizen",
      email: "citizen@example.com",
      mobile: "9123456780",
      collegeId: collegeIdO,
      institutionId: instO._id.toString(),
      category: "Administrative Delay",
      subject: "Certificate issuance delayed by 6 months",
      description: "Student completed course in March but degree certificate withheld.",
    });

    const complaintRef = submitRes.data?.complaintReference;

    // 4. Test Public Tracking Endpoint
    const trackRes = await clientPublic.post("/public/track", {
      complaintReference: complaintRef,
      verificationFactor: "citizen@example.com",
    });

    const pass =
      instLoginRes.status === 200 &&
      instMe.data?.role === "INSTITUTION" &&
      submitRes.status === 201 &&
      Boolean(complaintRef) &&
      trackRes.status === 200 &&
      trackRes.data?.complaintReference === complaintRef &&
      trackRes.data?.currentStep >= 1;

    record(
      "O",
      "Existing Login Regression & Public Complaint Submission & Tracking Workflow",
      pass,
      `Inst Login: HTTP ${instLoginRes.status} (role=${instMe.data?.role}), Submit Public: HTTP ${submitRes.status} (${complaintRef}), Track Public: HTTP ${trackRes.status} (step=${trackRes.data?.currentStep})`
    );
  } catch (err: any) {
    record("O", "Existing Login Regression", false, err.message);
  }

  // ── Final Summary ────────────────────────────────────────────────────────────
  console.log("================================================================================");
  console.log("FINAL INTEGRATION TEST REPORT");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;

  results.forEach((r) => {
    console.log(`[${r.pass ? "PASS" : "FAIL"}] TEST ${r.test}: ${r.title}`);
  });

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("--------------------------------------------------------------------------------\n");

  if (failed > 0) {
    console.error("Test suite finished with FAILURES.");
    process.exit(1);
  } else {
    console.log("ALL TESTS COMPLETED SUCCESSFULLY! ✓✓✓");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
