// backend/scripts/test_gemini_connected.ts
async function run() {
  const cookieJar: Record<string, string> = {};

  function updateCookies(res: Response) {
    const list = res.headers.getSetCookie();
    for (const c of list) {
      const parts = c.split(";")[0].split("=");
      cookieJar[parts[0].trim()] = parts.slice(1).join("=");
    }
  }

  function getCookieHeader() {
    return Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  console.log("=== VERIFYING AICTE CHATBOT GEMINI INTEGRATION ===");

  // 1. Fetch CSRF token
  const csrfRes = await fetch("http://localhost:5000/api/auth/csrf-token");
  updateCookies(csrfRes);
  const csrfData = await csrfRes.json();
  const token = csrfData.csrfToken;

  // 2. Authenticate
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": token,
    },
    body: JSON.stringify({ userId: "fd_emp", password: "fd_emp_pass" }),
  });
  updateCookies(loginRes);

  console.log("Authentication status:", loginRes.status);
  if (loginRes.status !== 200) {
    throw new Error("Login failed during verification");
  }

  // 3. Make query to chatbot
  const activeToken = cookieJar["XSRF-TOKEN"] || token;
  const start = Date.now();
  const chatRes = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "What is FDR in AICTE regulatory terms?",
      clientContext: { portal: "FD Employee Portal", route: "/fd/dashboard" },
    }),
  });

  const duration = Date.now() - start;
  const data = await chatRes.json();

  console.log("Chatbot HTTP Status:", chatRes.status);
  console.log("Response Time:", duration + "ms");
  console.log("Model Configured:", Boolean(data.modelConfigured));
  console.log("Citations retrieved:", data.citations?.map((c: any) => c.clauseNumber));
  console.log("\nChatbot Gemini Response Preview:\n" + data.content?.slice(0, 300) + "...\n");

  if (!data.content) {
    throw new Error("Chatbot returned empty response");
  }

  console.log("✓ AICTE Chatbot Gemini API request verified successfully!");
}

run().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
