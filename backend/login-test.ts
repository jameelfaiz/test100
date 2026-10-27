/**
 * login-test.ts — Login/logout/access-control test for all three employee accounts
 * Run: npx tsx backend/login-test.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const BASE      = "http://localhost:5000";
const CRED_PATH = path.resolve(__dirname, "..", "EMPLOYEE_CREDENTIALS.local");

// ── Parse credentials file ───────────────────────────────────────────────────
function parseCredentials() {
  const raw  = fs.readFileSync(CRED_PATH, "utf8");
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

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function post(url: string, body: object, cookie = "", csrfToken = "") {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie    ? { Cookie: cookie }            : {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const text = await r.text().catch(() => "");
  let json: any = {};
  try { json = JSON.parse(text); } catch {}
  const setCookie = r.headers.get("set-cookie") ?? "";
  return { status: r.status, json, setCookie };
}

async function get(url: string, cookie = "") {
  const r = await fetch(url, {
    headers: { ...(cookie ? { Cookie: cookie } : {}) },
    redirect: "manual",
  });
  const text = await r.text().catch(() => "");
  let json: any = {};
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
}

function extractSid(setCookie: string): string {
  const match = setCookie.match(/connect\.sid=([^;]+)/);
  return match ? `connect.sid=${match[1]}` : "";
}

function ok(msg: string)   { console.log(`  ✔  ${msg}`);  return 1 as const; }
function bad(msg: string)  { console.error(`  ✘  ${msg}`); return 0 as const; }

// ── Employee definitions ─────────────────────────────────────────────────────
// otherPath must be an endpoint protected by requireRole() for a *different* role
const ACCOUNTS = [
  {
    userId:         "fd_emp",
    expectedRole:   "AICTE_FD_EMPLOYEE",
    label:          "AICTE FD Employee",
    otherPath:      "/api/pgrc/complaint",   // PGRC_EMPLOYEE only (POST)
    otherMethod:    "POST" as const,
  },
  {
    userId:         "pgrc_emp",
    expectedRole:   "PGRC_EMPLOYEE",
    label:          "PGRC Employee",
    otherPath:      "/api/fd/dashboard",     // AICTE_FD_EMPLOYEE only (GET)
    otherMethod:    "GET" as const,
  },
  {
    userId:         "vigil_emp1",
    expectedRole:   "VIGILANCE_EMPLOYEE",
    label:          "Vigilance Employee",
    otherPath:      "/api/fd/dashboard",     // AICTE_FD_EMPLOYEE only (GET)
    otherMethod:    "GET" as const,
  },
];

let passed = 0;
let failed = 0;

async function runTests() {
  const creds = parseCredentials();
  console.log("Reading credentials from:", CRED_PATH);
  console.log("Backend:", BASE, "\n");

  // Verify backend is reachable
  const health = await get(`${BASE}/health`);
  if (health.status !== 200) {
    console.error("Backend not reachable at", BASE, "— start it first.");
    process.exit(1);
  }
  console.log("Backend healthy ✔\n");

  for (const acc of ACCOUNTS) {
    const password = creds[acc.userId];
    if (!password || password.includes("<existing")) {
      failed++;
      bad(`${acc.userId}: password not found in credentials file`);
      continue;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`TEST: ${acc.label} (${acc.userId})`);
    console.log("=".repeat(60));

    // ── TEST 1: Correct login ────────────────────────────────────────────────
    const loginRes = await post(`${BASE}/api/auth/login`, { userId: acc.userId, password });
    if (loginRes.status === 200 && loginRes.json.role === acc.expectedRole) {
      passed += ok(`Login with correct credentials: HTTP 200, role=${loginRes.json.role}`);
    } else {
      failed++;
      bad(`Login: expected 200/${acc.expectedRole}, got ${loginRes.status}/${loginRes.json.role}`);
      continue; // can't run further tests without a valid session
    }

    const sid        = extractSid(loginRes.setCookie);
    const csrfToken  = loginRes.json.csrfToken as string ?? "";

    // ── TEST 2: Wrong password → 401 ────────────────────────────────────────
    const badLogin = await post(`${BASE}/api/auth/login`, { userId: acc.userId, password: "WrongPass!X99" });
    if (badLogin.status === 401) {
      passed += ok(`Wrong password → HTTP 401 (Invalid credentials)`);
    } else {
      failed++;
      bad(`Wrong password: expected 401, got ${badLogin.status}`);
    }

    // ── TEST 3: /me returns correct role ────────────────────────────────────
    const meRes = await get(`${BASE}/api/auth/me`, sid);
    if (meRes.status === 200 && meRes.json.role === acc.expectedRole) {
      passed += ok(`/auth/me: role=${meRes.json.role}, accountStatus=${meRes.json.accountStatus}`);
    } else {
      failed++;
      bad(`/auth/me: expected 200/${acc.expectedRole}, got ${meRes.status}/${meRes.json.role}`);
    }

    // ── TEST 4: Cross-portal access blocked ─────────────────────────────────
    const crossRes = acc.otherMethod === "POST"
      ? await post(`${BASE}${acc.otherPath}`, {}, sid, csrfToken)
      : await get(`${BASE}${acc.otherPath}`, sid);
    if (crossRes.status === 403 || crossRes.status === 401) {
      passed += ok(`Cross-portal block: ${acc.otherMethod} ${acc.otherPath} → HTTP ${crossRes.status} (forbidden)`);
    } else {
      failed++;
      bad(`Cross-portal block: ${acc.otherMethod} ${acc.otherPath} → HTTP ${crossRes.status} (expected 403/401)`);
    }

    // ── TEST 5: Logout with CSRF token ───────────────────────────────────────
    const logoutRes = await post(`${BASE}/api/auth/logout`, {}, sid, csrfToken);
    if (logoutRes.status === 200) {
      passed += ok(`Logout: HTTP 200 — session destroyed`);
    } else {
      failed++;
      bad(`Logout: expected 200, got ${logoutRes.status} — ${JSON.stringify(logoutRes.json)}`);
    }

    // ── TEST 6: Old session invalid after logout ─────────────────────────────
    const afterLogout = await get(`${BASE}/api/auth/me`, sid);
    if (afterLogout.status === 401) {
      passed += ok(`Post-logout /me: HTTP 401 (session invalidated)`);
    } else {
      failed++;
      bad(`Post-logout /me: expected 401, got ${afterLogout.status}`);
    }
  }

  // ── Final summary ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`RESULTS: ${passed} PASSED  /  ${failed} FAILED`);
  if (failed === 0) {
    console.log("✔  ALL EMPLOYEE LOGIN/LOGOUT/ACCESS-CONTROL TESTS PASSED");
  } else {
    console.error("✘  SOME TESTS FAILED — see above for details");
  }
  console.log("=".repeat(60));
}

runTests().catch((e) => { console.error("Fatal:", e); process.exit(1); });
