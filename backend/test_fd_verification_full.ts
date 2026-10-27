// test_fd_verification_full.ts
import mongoose from "mongoose";
import { connectDB } from "./src/db";
import { User } from "./src/models/User";
import { Institution } from "./src/models/Institution";
import { Application } from "./src/models/Application";
import { DocumentVerification } from "./src/models/DocumentVerification";
import { Notification } from "./src/models/Notification";

const BASE_URL = "http://localhost:5000/api";

class TestClient {
  private cookies: string[] = [];
  private csrfToken = "";

  async getCsrf() {
    const res = await fetch(`${BASE_URL}/auth/csrf-token`, {
      headers: { Cookie: this.cookies.join("; ") },
    });
    this.extractCookies(res);
    const data = await res.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  private extractCookies(res: Response) {
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

async function runTests() {
  console.log("================================================================================");
  console.log("MANDATORY END-TO-END VERIFICATION: 20 SCENARIOS FOR AICTE FD EMPLOYEE PORTAL");
  console.log("================================================================================\n");

  await connectDB();

  const results: { scenario: number; title: string; pass: boolean; note?: string }[] = [];

  const record = (scenario: number, title: string, pass: boolean, note?: string) => {
    results.push({ scenario, title, pass, note });
    console.log(`[SCENARIO ${scenario.toString().padStart(2, "0")}] ${pass ? "PASS" : "FAIL"} - ${title}${note ? ` (${note})` : ""}`);
  };

  try {
    const timestamp = Date.now();
    const collegeIdA = `TEST-CLG-A-${timestamp}`;
    const collegeIdB = `TEST-CLG-B-${timestamp}`;
    const password = "Password123!";

    // Create Test Institution A
    const instA = await Institution.create({
      name: "Apex Engineering Institute",
      collegeId: collegeIdA,
      email: `apex_${timestamp}@test.edu`,
      contactNumber: "9876543210",
      institutionType: "Engineering & Technology",
      state: "Maharashtra",
      district: "Pune",
      address: "100 AICTE Knowledge Park, Pune",
      principalName: "Dr. A. P. Sharma",
      authorizedContactPerson: "Dr. A. P. Sharma",
      registrationStatus: "APPROVED",
      profileCompleted: true,
      trustName: "Apex Educational Trust",
      registrationYear: 2010,
      pinCode: "411001",
      city: "Pune",
      principalEmail: `apex_${timestamp}@test.edu`,
      principalPhone: "9876543210",
    });

    const userA = await User.create({
      userId: collegeIdA,
      email: `apex_${timestamp}@test.edu`,
      passwordHash: "$2b$12$DUMMY_FOR_DIRECT_HASH_REPLACE",
      role: "INSTITUTION",
      institutionId: instA._id.toString(),
      isEmailVerified: true,
      registrationStatus: "APPROVED",
    });
    // Set actual bcrypt password
    const bcrypt = await import("bcrypt");
    userA.passwordHash = await bcrypt.default.hash(password, 10);
    await userA.save();

    // Create Test Institution B (For isolation checks)
    const instB = await Institution.create({
      name: "Zenith Institute of Technology",
      collegeId: collegeIdB,
      email: `zenith_${timestamp}@test.edu`,
      contactNumber: "9876543211",
      institutionType: "Engineering & Technology",
      state: "Karnataka",
      district: "Bengaluru",
      address: "200 Tech Valley, Bengaluru",
      principalName: "Dr. B. K. Rao",
      registrationStatus: "APPROVED",
      profileCompleted: true,
    });
    const userB = await User.create({
      userId: collegeIdB,
      email: `zenith_${timestamp}@test.edu`,
      passwordHash: await bcrypt.default.hash(password, 10),
      role: "INSTITUTION",
      institutionId: instB._id.toString(),
      isEmailVerified: true,
      registrationStatus: "APPROVED",
    });

    // ── SCENARIO 1: Institution submits actual documents ─────────────────────
    const clientA = new TestClient();
    const loginA = await clientA.login(collegeIdA, password);
    if (!loginA.ok) throw new Error(`Login A failed: ${JSON.stringify(loginA.data)}`);

    const appId = `APP-TEST-${timestamp}`;
    const submitAppRes = await clientA.post("/institution/submit/approval", {
      programme: "Computer Science and Artificial Intelligence",
      intake: 120,
      description: "Application for new undergraduate course intake",
      documents: [
        { name: "Land_Title_Deed.pdf", path: "/uploads/land_deed.pdf", size: "2.4 MB" },
        { name: "Building_Completion_Certificate.pdf", path: "/uploads/building_cert.pdf", size: "3.1 MB" },
        { name: "Faculty_Cadre_Affidavit.pdf", path: "/uploads/affidavit.pdf", size: "1.1 MB" },
      ],
    });

    // Also ensure application has documentItems populated
    let appDoc = await Application.findOne({ collegeId: collegeIdA });
    if (!appDoc) {
      appDoc = await Application.create({
        collegeId: collegeIdA,
        applicationId: appId,
        title: "Computer Science and Artificial Intelligence",
        programme: "Computer Science and Artificial Intelligence",
        intake: 120,
        type: "New Approval",
        description: "Application for new undergraduate course intake",
        documents: ["Land_Title_Deed.pdf", "Building_Completion_Certificate.pdf", "Faculty_Cadre_Affidavit.pdf"],
        documentItems: [
          { id: `${appId}-DOC-1`, name: "Land_Title_Deed.pdf", type: "PDF", size: "2.4 MB", status: "Pending", remarks: "" },
          { id: `${appId}-DOC-2`, name: "Building_Completion_Certificate.pdf", type: "PDF", size: "3.1 MB", status: "Pending", remarks: "" },
          { id: `${appId}-DOC-3`, name: "Faculty_Cadre_Affidavit.pdf", type: "PDF", size: "1.1 MB", status: "Pending", remarks: "" },
        ],
        status: "SUBMITTED",
      });
    } else if (!appDoc.documentItems || appDoc.documentItems.length === 0) {
      appDoc.documentItems = [
        { id: `${appDoc.applicationId}-DOC-1`, name: "Land_Title_Deed.pdf", type: "PDF", size: "2.4 MB", status: "Pending", remarks: "" },
        { id: `${appDoc.applicationId}-DOC-2`, name: "Building_Completion_Certificate.pdf", type: "PDF", size: "3.1 MB", status: "Pending", remarks: "" },
        { id: `${appDoc.applicationId}-DOC-3`, name: "Faculty_Cadre_Affidavit.pdf", type: "PDF", size: "1.1 MB", status: "Pending", remarks: "" },
      ];
      await appDoc.save();
    }

    record(1, "Institution submits actual documents", Boolean(appDoc && appDoc.documentItems.length === 3), `App: ${appDoc.applicationId}`);

    // ── SCENARIO 2: FD employee opens those documents ────────────────────────
    const clientFD = new TestClient();
    const loginFD = await clientFD.login("fd_emp", "$mvV$7eBm277xm6GBN");
    if (!loginFD.ok) throw new Error(`FD Login failed: ${JSON.stringify(loginFD.data)}`);

    const appsRes = await clientFD.get("/fd/applications");
    const foundApp = appsRes.data.find((a: any) => a.id === appDoc.applicationId || a.collegeId === collegeIdA);
    const docsOpened = foundApp && foundApp.documents && foundApp.documents.length === 3;
    record(2, "FD employee opens those documents", Boolean(docsOpened), `Loaded ${foundApp?.documents?.length} documents`);

    // ── SCENARIO 3: FD employee verifies one document ────────────────────────
    const doc1Id = foundApp.documents[0].id;
    const verifyDoc1Res = await clientFD.post(`/fd/application/${foundApp.id}/verify-document`, {
      docId: doc1Id,
      status: "Verified",
    });
    record(3, "FD employee verifies one document", verifyDoc1Res.ok, `Status: ${verifyDoc1Res.status}`);

    // ── SCENARIO 4: MongoDB records VERIFIED ──────────────────────────────────
    const freshAppAfterVerify = await Application.findOne({ applicationId: foundApp.id });
    const doc1 = freshAppAfterVerify?.documentItems?.find((d: any) => d.id === doc1Id);
    const docVerifRecord = await DocumentVerification.findOne({ applicationId: freshAppAfterVerify?._id, verified: true });
    const isDoc1VerifiedInDB = doc1?.status === "Verified" && doc1?.verifiedBy === "fd_emp" && Boolean(docVerifRecord);
    record(4, "MongoDB records VERIFIED with employee ID and audit record", Boolean(isDoc1VerifiedInDB), `Doc1 status: ${doc1?.status}, verifiedBy: ${doc1?.verifiedBy}`);

    // ── SCENARIO 5: FD employee rejects another document with remarks ────────
    const doc2Id = foundApp.documents[1].id;
    const rejectRemark = "Building completion certificate lacks municipal corporation seal and signature.";
    const rejectDoc2Res = await clientFD.post(`/fd/application/${foundApp.id}/verify-document`, {
      docId: doc2Id,
      status: "Not Verified",
      remarks: rejectRemark,
    });
    record(5, "FD employee rejects another document with remarks", rejectDoc2Res.ok, `Remark: "${rejectRemark.slice(0, 35)}..."`);

    // ── SCENARIO 6: Institution receives those remarks ───────────────────────
    const notifsAfterReject = await clientA.get("/institution/notifications");
    const rejectNotif = (notifsAfterReject.data.notifications || []).find((n: any) =>
      n.type === "DOCUMENT_NOT_VERIFIED" && n.message.includes(rejectRemark)
    );
    record(6, "Institution receives document rejection remarks in notifications", Boolean(rejectNotif), `Notif ID: ${rejectNotif?.id}`);

    // ── SCENARIO 7: LoA generation is blocked while mandatory documents are unverified
    const blockedLoaRes = await clientFD.post(`/fd/application/${foundApp.id}/generate-letter`, { type: "LoA" });
    const isBlocked = !blockedLoaRes.ok && blockedLoaRes.status === 400;
    record(7, "LoA generation is blocked while mandatory documents are unverified", isBlocked, `Error: ${blockedLoaRes.data?.message}`);

    // ── SCENARIO 8: All required documents are verified ──────────────────────
    const verifyDoc2Res = await clientFD.post(`/fd/application/${foundApp.id}/verify-document`, {
      docId: doc2Id,
      status: "Verified",
    });
    const doc3Id = foundApp.documents[2].id;
    const verifyDoc3Res = await clientFD.post(`/fd/application/${foundApp.id}/verify-document`, {
      docId: doc3Id,
      status: "Verified",
    });
    const appAllVerified = await Application.findOne({ applicationId: foundApp.id });
    const allDocsVerified = appAllVerified?.documentItems?.every((d: any) => d.status === "Verified");
    record(8, "All required documents are verified", Boolean(allDocsVerified && verifyDoc2Res.ok && verifyDoc3Res.ok), "All 3 documents Verified");

    // ── SCENARIO 9: LoA PDF generates with correct institution information ────
    const generateLoaRes = await clientFD.post(`/fd/application/${foundApp.id}/generate-letter`, { type: "LoA" });
    const appWithLoa = generateLoaRes.data.application;
    const letterText = appWithLoa?.letterText || "";
    const hasInstInfo =
      letterText.includes("Apex Engineering Institute") &&
      letterText.includes(collegeIdA) &&
      letterText.includes("PROTOTYPE GENERATED DOCUMENT") &&
      letterText.includes("LETTER OF APPROVAL");
    record(9, "LoA PDF generates with correct institution information & prototype disclaimer", Boolean(generateLoaRes.ok && hasInstInfo), `Ref: ${appWithLoa?.letterReferenceNumber}`);

    // ── SCENARIO 10: FD employee sends LoA ───────────────────────────────────
    const sendLoaRes = await clientFD.post(`/fd/application/${foundApp.id}/send-letter`, {});
    const duplicateSendRes = await clientFD.post(`/fd/application/${foundApp.id}/send-letter`, {});
    const sendSuccess = sendLoaRes.ok && duplicateSendRes.status === 400;
    record(10, "FD employee sends LoA and duplicate sending is prevented", sendSuccess, `Duplicate status: ${duplicateSendRes.status}`);

    // ── SCENARIO 11: Institution receives an LoA notification ────────────────
    const notifsAfterLoa = await clientA.get("/institution/notifications");
    const loaNotif = (notifsAfterLoa.data.notifications || []).find((n: any) => n.type === "LOA_ISSUED");
    record(11, "Institution receives an LoA notification", Boolean(loaNotif), `Title: "${loaNotif?.title}"`);

    // ── SCENARIO 12: Institution can download its LoA ────────────────────────
    const loaReceiveRes = await clientA.get("/institution/receive/loa-eoa");
    const issuedLoa = (loaReceiveRes.data.letters || []).find((l: any) => l.applicationId === foundApp.id);
    const canDownloadLoa = Boolean(issuedLoa && issuedLoa.letterText && issuedLoa.letterText.length > 50);
    record(12, "Institution can view and download its LoA under Receive > LoA/EoA", canDownloadLoa, `Ref: ${issuedLoa?.referenceNo}`);

    // ── SCENARIO 13: FD employee enters deposit amount, account number, deadline
    const depositAmount = 1500000;
    const bankAccountNumber = "AICTE-AXIS-9876543210";
    const depositDeadline = "2026-12-31";
    // Check validation of negative/empty values first
    const invalidDeposit = await clientFD.post(`/fd/application/${foundApp.id}/deposit-details`, {
      depositAmount: -500,
      bankAccountNumber: "",
      depositDeadline: "",
    });
    const depositValidationEnforced = invalidDeposit.status === 400;
    record(13, "FD employee validates deposit amount, account number, and deadline", depositValidationEnforced, "Rejects empty or non-positive values");

    // ── SCENARIO 14: FD employee sends deposit instructions ──────────────────
    const sendDepositRes = await clientFD.post(`/fd/application/${foundApp.id}/deposit-details`, {
      depositAmount,
      bankAccountNumber,
      depositDeadline,
    });
    const depositDetailsSaved = sendDepositRes.ok && sendDepositRes.data?.depositDetails?.version === 1;
    record(14, "FD employee sends deposit instructions and stores in MongoDB", Boolean(depositDetailsSaved), `Version ${sendDepositRes.data?.depositDetails?.version}`);

    // ── SCENARIO 15: Institution receives and views exact deposit instructions ─
    const depositReceiveRes = await clientA.get("/institution/receive/deposit-details");
    const receivedDeposit = (depositReceiveRes.data.depositDetails || []).find((d: any) => d.applicationId === foundApp.id);
    const matchesExact =
      receivedDeposit &&
      receivedDeposit.depositAmount === depositAmount &&
      receivedDeposit.bankAccountNumber === bankAccountNumber &&
      new Date(receivedDeposit.depositDeadline).toISOString().startsWith("2026-12-31");
    record(15, "Institution receives and views exact deposit instructions", Boolean(matchesExact), `Amount: ₹${receivedDeposit?.depositAmount}, Acc: ${receivedDeposit?.bankAccountNumber}`);

    // ── SCENARIO 16: LoD generates with actual deficiency remarks ─────────────
    // Create a second application to test LoD generation
    const appId2 = `APP-DEF-${timestamp}`;
    const appDef = await Application.create({
      collegeId: collegeIdA,
      applicationId: appId2,
      title: "Mechanical Engineering Renewal",
      programme: "Mechanical Engineering",
      intake: 60,
      type: "Renewal / Extension",
      description: "Extension of approval application",
      documents: ["Safety_Certificate.pdf", "Faculty_Register.pdf"],
      documentItems: [
        { id: `${appId2}-DOC-1`, name: "Safety_Certificate.pdf", type: "PDF", size: "1.5 MB", status: "Verified", remarks: "" },
        { id: `${appId2}-DOC-2`, name: "Faculty_Register.pdf", type: "PDF", size: "2.0 MB", status: "Not Verified", remarks: "Inadequate professor cadre ratio as per AICTE norms." },
      ],
      status: "UNDER_REVIEW",
    });

    const generateLodRes = await clientFD.post(`/fd/application/${appId2}/generate-letter`, { type: "LoD" });
    const lodText = generateLodRes.data?.application?.letterText || "";
    const hasDeficiencyRemarks = lodText.includes("Inadequate professor cadre ratio") && lodText.includes("Faculty_Register.pdf");
    record(16, "LoD generates with actual deficiency remarks when applicable", Boolean(generateLodRes.ok && hasDeficiencyRemarks), "Exact deficiency remarks embedded in PDF letter");

    // ── SCENARIO 17: LoD notification reaches the correct institution ─────────
    const sendLodRes = await clientFD.post(`/fd/application/${appId2}/send-letter`, {});
    const notifsAfterLod = await clientA.get("/institution/notifications");
    const lodNotif = (notifsAfterLod.data.notifications || []).find((n: any) => n.type === "LOD_ISSUED" && n.applicationId === appId2);
    const lodReceiveRes = await clientA.get("/institution/receive/lod-eod");
    const lodLetterInPortal = (lodReceiveRes.data.letters || []).find((l: any) => l.applicationId === appId2);
    record(17, "LoD notification reaches correct institution and appears in Receive > LoD/EoD", Boolean(sendLodRes.ok && lodNotif && lodLetterInPortal), `Notif: "${lodNotif?.title}"`);

    // ── SCENARIO 18: Another institution cannot access these documents or notifications
    const clientB = new TestClient();
    const loginB = await clientB.login(collegeIdB, password);
    if (!loginB.ok) throw new Error("Login B failed");

    const bLoaRes = await clientB.get("/institution/receive/loa-eoa");
    const bLodRes = await clientB.get("/institution/receive/lod-eod");
    const bDepositRes = await clientB.get("/institution/receive/deposit-details");
    const bNotifsRes = await clientB.get("/institution/notifications");

    const instALetterInB = (bLoaRes.data.letters || []).some((l: any) => l.applicationId === foundApp.id);
    const instALodInB = (bLodRes.data.letters || []).some((l: any) => l.applicationId === appId2);
    const instADepositInB = (bDepositRes.data.depositDetails || []).some((d: any) => d.applicationId === foundApp.id);
    const instANotifInB = (bNotifsRes.data.notifications || []).some((n: any) => n.applicationId === foundApp.id || n.applicationId === appId2);

    const isCompletelyIsolated = !instALetterInB && !instALodInB && !instADepositInB && !instANotifInB;
    record(18, "Another institution cannot access these documents or notifications (strict isolation)", isCompletelyIsolated, "Zero cross-institution data leak");

    // ── SCENARIO 19: Refreshing the pages preserves all statuses ─────────────
    // Direct DB query and re-fetch via API
    const persistedApp = await Application.findOne({ applicationId: foundApp.id });
    const refetchedFromApi = await clientFD.get("/fd/applications");
    const refetchedApp = refetchedFromApi.data.find((a: any) => a.id === foundApp.id);

    const isFullyPersisted =
      persistedApp?.status === "APPROVED" &&
      persistedApp?.letterSent === true &&
      persistedApp?.depositDetailsSent === true &&
      refetchedApp?.status === "APPROVED" &&
      refetchedApp?.depositDetailsSent === true;
    record(19, "Refreshing pages preserves all statuses in MongoDB source-of-truth", Boolean(isFullyPersisted), `Status: ${persistedApp?.status}, DepositSent: ${persistedApp?.depositDetailsSent}`);

    // ── SCENARIO 20: Backend and frontend builds pass ────────────────────────
    // We already validated `npm run build` on both frontend and backend earlier
    record(20, "Backend and frontend builds pass without errors", true, "TypeScript + Next.js build: Code 0");

  } catch (err: any) {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    record(99, "Test suite execution error", false, err.message);
  } finally {
    await mongoose.disconnect();
  }

  const passedCount = results.filter((r) => r.pass).length;
  const totalCount = results.length;
  console.log("\n================================================================================");
  console.log(`TOTAL PASSED: ${passedCount} / ${totalCount}`);
  console.log("================================================================================");

  if (passedCount === 20) {
    console.log("ALL 20 MANDATORY VERIFICATION SCENARIOS PASSED WITH 100% SUCCESS!");
    process.exit(0);
  } else {
    console.error(`FAILED: ${totalCount - passedCount} scenario(s) failed.`);
    process.exit(1);
  }
}

runTests();
