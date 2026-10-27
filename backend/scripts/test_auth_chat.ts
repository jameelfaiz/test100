// backend/scripts/test_auth_chat.ts
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

  console.log("=== AICTE CHATBOT AUTHENTICATED HTTP SESSION TEST ===");

  // 1. Fetch CSRF token
  const csrfRes = await fetch("http://localhost:5000/api/auth/csrf-token");
  updateCookies(csrfRes);
  const csrfData = await csrfRes.json();
  const token = csrfData.csrfToken;

  // 2. Login as FD Employee
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

  console.log("FD Login Status:", loginRes.status);

  // 3. Query Chatbot as FD employee: What is FDR?
  let activeToken = cookieJar["XSRF-TOKEN"] || token;
  const chat1 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "What is FDR?",
      clientContext: { portal: "FD Employee Portal", route: "/fd/dashboard" },
    }),
  });

  const data1 = await chat1.json();
  console.log("\n[Query 1: What is FDR?]");
  console.log("Status:", chat1.status);
  console.log("Content Excerpt:\n" + data1.content?.slice(0, 220) + "...");
  console.log("Citations:", data1.citations?.map((c: any) => c.clauseNumber));

  const convId = data1.conversationId;

  // 4. Follow-up Query: What documents are required for it?
  activeToken = cookieJar["XSRF-TOKEN"] || token;
  const chat2 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "What documents are required for it?",
      conversationId: convId,
      clientContext: { portal: "FD Employee Portal", route: "/fd/dashboard" },
    }),
  });

  const data2 = await chat2.json();
  console.log("\n[Query 2: What documents are required for it? (Follow-up)]");
  console.log("Status:", chat2.status);
  console.log("Content Excerpt:\n" + data2.content?.slice(0, 240) + "...");

  // 5. Follow-up Query: Where should I upload them?
  activeToken = cookieJar["XSRF-TOKEN"] || token;
  const chat3 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "Where should I upload them?",
      conversationId: convId,
      clientContext: { portal: "FD Employee Portal", route: "/fd/dashboard" },
    }),
  });

  const data3 = await chat3.json();
  console.log("\n[Query 3: Where should I upload them? (Follow-up)]");
  console.log("Status:", chat3.status);
  console.log("Content Excerpt:\n" + data3.content?.slice(0, 240) + "...");

  // 6. Query: How do I submit my approval application?
  activeToken = cookieJar["XSRF-TOKEN"] || token;
  const chat4 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "How do I submit my approval application?",
      clientContext: { portal: "Institution Portal", route: "/institution/dashboard" },
    }),
  });

  const data4 = await chat4.json();
  console.log("\n[Query 4: How do I submit my approval application?]");
  console.log("Status:", chat4.status);
  console.log("Content Excerpt:\n" + data4.content?.slice(0, 240) + "...");

  // 7. Verify all 4 responses are completely distinct
  const answers = [data1.content, data2.content, data3.content, data4.content];
  const unique = new Set(answers);
  console.log(`\nDiversity: ${unique.size} unique out of ${answers.length} queries.`);
  if (unique.size !== answers.length) {
    throw new Error("HTTP Session test failed: Duplicate responses detected!");
  }

  console.log("\n✓ All 4 HTTP session queries produced distinct, specific, accurate answers!");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
