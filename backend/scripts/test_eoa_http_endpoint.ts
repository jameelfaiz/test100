// backend/scripts/test_eoa_http_endpoint.ts
import { connectDB } from "../src/db";
import { Application } from "../src/models/Application";
import { Institution } from "../src/models/Institution";

const BASE_URL = "http://localhost:5000";

async function runHttpTest() {
  console.log("================================================================================");
  console.log("RUNNING HTTP ENDPOINT INTEGRATION TEST FOR EOA PDF DOWNLOAD");
  console.log("================================================================================\n");

  await connectDB();

  const TEST_APP_ID = `HTTP-TEST-APP-${Date.now()}`;
  const COLLEGE_ID = `HTTP-INST-${Date.now()}`;

  const cookieJar: Record<string, string> = {};
  function updateCookies(res: Response) {
    const list = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [];
    for (const c of list) {
      const parts = c.split(";")[0].split("=");
      cookieJar[parts[0].trim()] = parts.slice(1).join("=");
    }
  }
  function getCookieHeader() {
    return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  try {
    // 1. Create fixture application and institution
    await Institution.create({
      collegeId: COLLEGE_ID,
      name: "HTTP Test Engineering College",
      email: "test@college.edu",
    });

    await Application.create({
      applicationId: TEST_APP_ID,
      collegeId: COLLEGE_ID,
      title: "Extension of Approval for HTTP Test",
      programme: "Computer Science",
      intake: 60,
      result: "EoA",
      letterType: "EoA",
      letterGenerated: true,
      letterSent: true,
      letterSentDate: new Date(),
      letterReferenceNumber: `AICTE/AB/2026-27/${COLLEGE_ID}/${TEST_APP_ID}`,
      letterText: "Official EoA Letter for HTTP Integration Test",
      status: "APPROVED",
    });

    // 2. Fetch CSRF token
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf-token`);
    updateCookies(csrfRes);
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;

    // 3. Login as FD Employee
    console.log("Step 1: Authenticating as FD employee...");
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: getCookieHeader(),
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ userId: "fd_emp", password: "fd_emp_pass" }),
    });
    updateCookies(loginRes);

    if (loginRes.status !== 200) {
      const errText = await loginRes.text();
      throw new Error(`Login failed with status ${loginRes.status}: ${errText}`);
    }
    console.log("[PASS] Logged in successfully as FD employee.");

    // 4. Make HTTP GET request for the EoA letter PDF
    console.log("\nStep 2: Requesting GET /api/fd/application/" + TEST_APP_ID + "/letter-pdf ...");
    const pdfRes = await fetch(`${BASE_URL}/api/fd/application/${TEST_APP_ID}/letter-pdf`, {
      headers: {
        Cookie: getCookieHeader(),
      },
    });

    console.log("Response status:", pdfRes.status);
    const contentType = pdfRes.headers.get("content-type") || "";
    const contentDisposition = pdfRes.headers.get("content-disposition") || "";
    console.log("Content-Type:", contentType);
    console.log("Content-Disposition:", contentDisposition);

    const arrayBuffer = await pdfRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Data size (bytes):", buffer.length);

    const isPdfStatus = pdfRes.status === 200;
    const isContentTypePdf = contentType.includes("application/pdf");
    const hasDisposition = contentDisposition.includes(`attachment; filename="EoA_Letter_${TEST_APP_ID}.pdf"`);
    const hasMagicBytes = buffer.slice(0, 4).toString() === "%PDF";

    if (isPdfStatus && isContentTypePdf && hasDisposition && hasMagicBytes) {
      console.log("\n[PASS] HTTP integration test verified successfully! Real PDF returned with attachment header.");
    } else {
      throw new Error(`Verification failed: status=${isPdfStatus}, contentType=${isContentTypePdf}, disposition=${hasDisposition}, magicBytes=${hasMagicBytes}`);
    }

  } finally {
    await Application.deleteMany({ applicationId: TEST_APP_ID });
    await Institution.deleteMany({ collegeId: COLLEGE_ID });
    console.log("\nFixture cleaned up.");
  }
}

runHttpTest().catch(err => {
  console.error("HTTP test error:", err.message || err);
  process.exit(1);
});
