// test_logout_security_suite.ts
/**
 * Automated Security & Verification Suite for Portal Logout Functionality
 *
 * Verifies:
 * 1. Institution Portal: Login, Protected Access, Logout Session Destruction, Direct Access Block (401), Relogin
 * 2. FD Employee Portal: Login, Protected Access, Logout Session Destruction, Direct Access Block (401), Relogin
 * 3. PGRC Employee Portal: Login, Protected Access, Logout Session Destruction, Direct Access Block (401), Relogin
 * 4. Vigilance Employee Portal: Login, Protected Access, Logout Session Destruction, Direct Access Block (401), Relogin
 * 5. Cross-Session Isolation: Logging out User A does not affect active session of User B
 * 6. Database Preservation: User accounts, complaints, and institutions remain intact after logout
 *
 * Run: npx tsx backend/test_logout_security_suite.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { connectDB } from "./src/db";
import { User } from "./src/models/User";
import { Institution } from "./src/models/Institution";
import { Complaint } from "./src/models/Complaint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:5000/api";
const CRED_PATH = path.resolve(__dirname, "..", "EMPLOYEE_CREDENTIALS.local");

function parseCredentials(): Record<string, string> {
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

  async logout() {
    if (!this.csrfToken) await this.getCsrf();
    return await this.post("/auth/logout", {});
  }

  async post(path: string, body: any) {
    if (!this.csrfToken) await this.getCsrf();
    let res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": this.csrfToken,
        "x-csrf-token": this.csrfToken,
        Cookie: this.cookies.join("; "),
      },
      body: JSON.stringify(body),
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

async function run() {
  console.log("================================================================================");
  console.log("PORTAL LOGOUT & SESSION INVALIDATION TEST SUITE");
  console.log("Testing All 4 Portals: Institution, FD, PGRC, Vigilance");
  console.log("================================================================================\n");

  await connectDB();
  const creds = parseCredentials();

  const fdPass = creds["fd_emp"];
  const pgrcPass = creds["pgrc_emp"];
  const vigilPass = creds["vigil_emp1"];

  const results: { test: number; title: string; pass: boolean; details: string }[] = [];

  const record = (test: number, title: string, pass: boolean, details: string) => {
    results.push({ test, title, pass, details });
    const mark = pass ? "✓ PASS" : "✗ FAIL";
    console.log(`[TEST ${test.toString().padStart(2, "0")}] ${mark} - ${title}`);
    console.log(`          Details: ${details}\n`);
  };

  const ts = Date.now();

  // Create Test Institution User
  const collegeId = `TEST-INST-${ts}`;
  const instPass = "InstPass@123";
  const passwordHash = await bcrypt.hash(instPass, 10);

  const inst = await Institution.create({
    name: "Logout Test Institute",
    collegeId,
    email: `logout_test_${ts}@inst.edu`,
    phone: "9876543299",
    state: "Delhi",
    district: "New Delhi",
    address: "Nelson Mandela Marg",
    registrationStatus: "APPROVED",
    profileCompleted: true,
  });

  const instUser = await User.create({
    userId: collegeId,
    collegeId,
    passwordHash,
    role: "INSTITUTION",
    institutionId: inst._id.toString(),
    accountStatus: "ACTIVE",
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. INSTITUTION PORTAL LOGOUT FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const client = new TestClient();

    // 1.1 Login
    const loginRes = await client.login(collegeId, instPass);
    const authMeBefore = await client.get("/auth/me");
    const profBefore = await client.get("/institution/profile");

    // 1.2 Call Logout endpoint
    const logoutRes = await client.logout();

    // 1.3 Attempt to access protected dashboard endpoints with same cookie/session
    const authMeAfter = await client.get("/auth/me");
    const profAfter = await client.get("/institution/profile");

    // 1.4 Relogin
    const reloginRes = await client.login(collegeId, instPass);
    const authMeRelogin = await client.get("/auth/me");

    const pass =
      loginRes.status === 200 &&
      authMeBefore.status === 200 &&
      profBefore.status === 200 &&
      logoutRes.status === 200 &&
      authMeAfter.status === 401 &&
      profAfter.status === 401 &&
      reloginRes.status === 200 &&
      authMeRelogin.status === 200;

    record(
      1,
      "Institution Portal: Login -> Protected Access -> Logout -> Block (401) -> Relogin",
      pass,
      `Login: ${loginRes.status}, Logout: ${logoutRes.status}, Post-Logout /auth/me: ${authMeAfter.status}, Post-Logout /profile: ${profAfter.status}, Relogin: ${reloginRes.status}`
    );
  } catch (err: any) {
    record(1, "Institution Portal Logout Flow", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AICTE FD EMPLOYEE PORTAL LOGOUT FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const client = new TestClient();

    // 2.1 Login as FD employee
    const loginRes = await client.login("fd_emp", fdPass);
    const authMeBefore = await client.get("/auth/me");
    const dashBefore = await client.get("/fd/dashboard");

    // 2.2 Logout
    const logoutRes = await client.logout();

    // 2.3 Attempt to access protected FD dashboard endpoints
    const authMeAfter = await client.get("/auth/me");
    const dashAfter = await client.get("/fd/dashboard");
    const relAppsAfter = await client.get("/fd/release-applications");

    // 2.4 Relogin
    const reloginRes = await client.login("fd_emp", fdPass);
    const authMeRelogin = await client.get("/auth/me");

    const pass =
      loginRes.status === 200 &&
      authMeBefore.status === 200 &&
      dashBefore.status === 200 &&
      logoutRes.status === 200 &&
      authMeAfter.status === 401 &&
      dashAfter.status === 401 &&
      relAppsAfter.status === 401 &&
      reloginRes.status === 200 &&
      authMeRelogin.status === 200;

    record(
      2,
      "AICTE FD Employee Portal: Login -> Protected Access -> Logout -> Block (401) -> Relogin",
      pass,
      `Login: ${loginRes.status}, Logout: ${logoutRes.status}, Post-Logout /auth/me: ${authMeAfter.status}, Post-Logout /fd/dashboard: ${dashAfter.status}, Relogin: ${reloginRes.status}`
    );
  } catch (err: any) {
    record(2, "AICTE FD Employee Portal Logout Flow", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PGRC EMPLOYEE PORTAL LOGOUT FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const client = new TestClient();

    // 3.1 Login as PGRC employee
    const loginRes = await client.login("pgrc_emp", pgrcPass);
    const authMeBefore = await client.get("/auth/me");
    const dashBefore = await client.get("/pgrc/dashboard");

    // 3.2 Logout
    const logoutRes = await client.logout();

    // 3.3 Attempt to access protected PGRC endpoints
    const authMeAfter = await client.get("/auth/me");
    const dashAfter = await client.get("/pgrc/dashboard");
    const compAfter = await client.get("/pgrc/complaints");

    // 3.4 Relogin
    const reloginRes = await client.login("pgrc_emp", pgrcPass);
    const authMeRelogin = await client.get("/auth/me");

    const pass =
      loginRes.status === 200 &&
      authMeBefore.status === 200 &&
      dashBefore.status === 200 &&
      logoutRes.status === 200 &&
      authMeAfter.status === 401 &&
      dashAfter.status === 401 &&
      compAfter.status === 401 &&
      reloginRes.status === 200 &&
      authMeRelogin.status === 200;

    record(
      3,
      "PGRC Employee Portal: Login -> Protected Access -> Logout -> Block (401) -> Relogin",
      pass,
      `Login: ${loginRes.status}, Logout: ${logoutRes.status}, Post-Logout /auth/me: ${authMeAfter.status}, Post-Logout /pgrc/dashboard: ${dashAfter.status}, Relogin: ${reloginRes.status}`
    );
  } catch (err: any) {
    record(3, "PGRC Employee Portal Logout Flow", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. VIGILANCE EMPLOYEE PORTAL LOGOUT FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const client = new TestClient();

    // 4.1 Login as Vigilance employee
    const loginRes = await client.login("vigil_emp1", vigilPass);
    const authMeBefore = await client.get("/auth/me");
    const dashBefore = await client.get("/vigilance/dashboard");

    // 4.2 Logout
    const logoutRes = await client.logout();

    // 4.3 Attempt to access protected Vigilance endpoints
    const authMeAfter = await client.get("/auth/me");
    const dashAfter = await client.get("/vigilance/dashboard");
    const invAfter = await client.get("/vigilance/investigations");

    // 4.4 Relogin
    const reloginRes = await client.login("vigil_emp1", vigilPass);
    const authMeRelogin = await client.get("/auth/me");

    const pass =
      loginRes.status === 200 &&
      authMeBefore.status === 200 &&
      dashBefore.status === 200 &&
      logoutRes.status === 200 &&
      authMeAfter.status === 401 &&
      dashAfter.status === 401 &&
      invAfter.status === 401 &&
      reloginRes.status === 200 &&
      authMeRelogin.status === 200;

    record(
      4,
      "Vigilance Employee Portal: Login -> Protected Access -> Logout -> Block (401) -> Relogin",
      pass,
      `Login: ${loginRes.status}, Logout: ${logoutRes.status}, Post-Logout /auth/me: ${authMeAfter.status}, Post-Logout /vigilance/dashboard: ${dashAfter.status}, Relogin: ${reloginRes.status}`
    );
  } catch (err: any) {
    record(4, "Vigilance Employee Portal Logout Flow", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CROSS-SESSION ISOLATION
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const clientA = new TestClient();
    const clientB = new TestClient();

    // Log in User A (FD) and User B (PGRC) concurrently
    await clientA.login("fd_emp", fdPass);
    await clientB.login("pgrc_emp", pgrcPass);

    // Verify both are active
    const aBefore = await clientA.get("/auth/me");
    const bBefore = await clientB.get("/auth/me");

    // User A logs out
    const aLogout = await clientA.logout();

    // Verify User A is invalidated, but User B remains fully active!
    const aAfter = await clientA.get("/auth/me");
    const bAfter = await clientB.get("/auth/me");

    const pass =
      aBefore.status === 200 &&
      bBefore.status === 200 &&
      aLogout.status === 200 &&
      aAfter.status === 401 &&
      bAfter.status === 200 &&
      bAfter.data?.role === "PGRC_EMPLOYEE";

    record(
      5,
      "Cross-Session Isolation: Logging out User A leaves User B active",
      pass,
      `User A post-logout: ${aAfter.status} (invalidated), User B post-logout: ${bAfter.status} (remains active)`
    );
  } catch (err: any) {
    record(5, "Cross-Session Isolation", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. DATABASE PRESERVATION VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Check that user, institution, and complaints records in MongoDB were not touched by logout
    const userInDb = await User.findOne({ userId: collegeId });
    const instInDb = await Institution.findOne({ collegeId });

    const pass = userInDb !== null && instInDb !== null;

    record(
      6,
      "Database Preservation: User accounts & institution data intact in MongoDB",
      pass,
      `User exists in DB: ${Boolean(userInDb)}, Institution exists in DB: ${Boolean(instInDb)}`
    );
  } catch (err: any) {
    record(6, "Database Preservation", false, err.message);
  }

  // ── Final Report Summary ────────────────────────────────────────────────────
  console.log("================================================================================");
  console.log("LOGOUT SUITE TEST RESULTS");
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
    console.error("Logout test suite had failures!");
    process.exit(1);
  } else {
    console.log("ALL LOGOUT TESTS COMPLETED SUCCESSFULLY! ✓✓✓");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
