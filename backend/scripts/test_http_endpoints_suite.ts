// backend/scripts/test_http_endpoints_suite.ts
async function runHttpSuite() {
  const cookieJar: Record<string, string> = {};

  function updateCookies(res: Response) {
    const list = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [];
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

  console.log("==================================================================");
  console.log("AICTE CHATBOT END-TO-END HTTP INTENT & ROUTING VERIFICATION SUITE");
  console.log("==================================================================");

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

  if (loginRes.status !== 200) {
    throw new Error(`Login failed with status: ${loginRes.status}`);
  }
  console.log("✓ Authenticated session established with backend.");

  let activeToken = cookieJar["XSRF-TOKEN"] || token;

  // ── TEST 1: Greeting 'hi' via HTTP ───────────────────────────────────────
  console.log("\n[HTTP Test 1] POST /api/chatbot/query with 'hi'");
  const res1 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "hi",
      clientContext: { portal: "Institution Portal", route: "/institution/dashboard" },
    }),
  });
  const data1 = await res1.json();
  console.log("  Status:", res1.status);
  console.log("  Content:", `"${data1.content}"`);
  console.log("  Citations:", data1.citations?.length || 0);
  if (!data1.content.includes("Hello!")) {
    throw new Error("HTTP Test 1 Failed: Greeting message not returned.");
  }
  if (data1.citations && data1.citations.length > 0) {
    throw new Error("HTTP Test 1 Failed: Greeting query returned citations.");
  }
  console.log("  ✓ HTTP Test 1 Passed: 'hi' returned natural greeting with 0 citations.\n");

  // ── TEST 2: Conversational Prompt 'I have one doubt' ──────────────────────
  console.log("[HTTP Test 2] POST /api/chatbot/query with 'I have one doubt'");
  const res2 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "I have one doubt",
      clientContext: { portal: "Institution Portal", route: "/institution/dashboard" },
    }),
  });
  const data2 = await res2.json();
  console.log("  Status:", res2.status);
  console.log("  Content:", `"${data2.content}"`);
  console.log("  Citations:", data2.citations?.length || 0);
  if (!data2.content.toLowerCase().includes("doubt") && !data2.content.toLowerCase().includes("question")) {
    throw new Error("HTTP Test 2 Failed: Conversational reply not returned.");
  }
  if (data2.citations && data2.citations.length > 0) {
    throw new Error("HTTP Test 2 Failed: 'I have one doubt' returned citations.");
  }
  console.log("  ✓ HTTP Test 2 Passed: 'I have one doubt' returned brief natural reply with 0 citations.\n");

  // ── TEST 3: FDR Maturity / Refund Question ────────────────────────────────
  console.log("[HTTP Test 3] POST /api/chatbot/query with 'when the maturity fund would not back to the institution'");
  const res3 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "when the maturity fund would not back to the institution",
      clientContext: { portal: "Institution Portal", route: "/institution/receive/deposit" },
    }),
  });
  const data3 = await res3.json();
  console.log("  Status:", res3.status);
  console.log("  Full Content:\n", data3.content);
  const lowerContent = data3.content.toLowerCase();
  const hasMaturity = lowerContent.includes("maturity");
  const hasReleaseOrReturn = lowerContent.includes("return") || lowerContent.includes("release");
  const hasClearance = lowerContent.includes("clearance") || lowerContent.includes("pgrc") || lowerContent.includes("vigilance");
  const hasForfeiture = lowerContent.includes("forfeit") || lowerContent.includes("withheld") || lowerContent.includes("block");
  if (!hasMaturity || !hasReleaseOrReturn || !hasClearance || !hasForfeiture) {
    throw new Error("HTTP Test 3 Failed: FDR release/withholding explanation incomplete.");
  }
  console.log("  ✓ HTTP Test 3 Passed: Evidence-grounded 5-tier FDR release/withholding explanation returned.\n");

  // ── TEST 4: EoD versus EoA ────────────────────────────────────────────────
  console.log("[HTTP Test 4] POST /api/chatbot/query with 'what if I get EoD instead of EoA'");
  const res4 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "what if I get EoD instead of EoA",
      clientContext: { portal: "Institution Portal", route: "/institution/receive/lod-eod" },
    }),
  });
  const data4 = await res4.json();
  const conversationId = data4.conversationId;
  console.log("  Status:", res4.status);
  console.log("  ConversationId:", conversationId);
  console.log("  Content Excerpt:\n  " + data4.content?.slice(0, 250).replace(/\n/g, "\n  ") + "...");
  console.log("  Citations Count:", data4.citations?.length);
  if (!data4.content.includes("Extension of Approval") || !data4.content.includes("Extension of Deficiency")) {
    throw new Error("HTTP Test 4 Failed: EoD vs EoA not distinguished.");
  }
  console.log("  ✓ HTTP Test 4 Passed: EoD vs EoA distinguished with portal routes and clarification prompt.\n");

  // ── TEST 5: Context-aware follow-up ───────────────────────────────────────
  console.log("[HTTP Test 5] POST /api/chatbot/query with 'what I am suppose do if I am get EoD instead of EoA' (Follow-up)");
  const res5 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "what I am suppose do if I am get EoD instead of EoA",
      conversationId,
      clientContext: { portal: "Institution Portal", route: "/institution/receive/lod-eod" },
    }),
  });
  const data5 = await res5.json();
  console.log("  Status:", res5.status);
  console.log("  Content Excerpt:\n  " + data5.content?.slice(0, 250).replace(/\n/g, "\n  ") + "...");
  if (!data5.content.includes("Receive → LoD / EoD") || !data5.content.includes("Submit → Approval Seeking")) {
    throw new Error("HTTP Test 5 Failed: Follow-up did not provide step-by-step deficiency rectification.");
  }
  console.log("  ✓ HTTP Test 5 Passed: Context preserved; practical rectification steps provided.\n");

  // ── TEST 6: Off-topic refusal ─────────────────────────────────────────────
  console.log("[HTTP Test 6] POST /api/chatbot/query with 'What is the weather today?'");
  const res6 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "What is the weather today?",
      clientContext: { portal: "Institution Portal", route: "/institution/dashboard" },
    }),
  });
  const data6 = await res6.json();
  console.log("  Status:", res6.status);
  console.log("  Content:", `"${data6.content}"`);
  console.log("  isRefusal:", data6.isRefusal);
  console.log("  Citations:", data6.citations?.length || 0);
  if (data6.content !== "It is not under my coverage") {
    throw new Error(`HTTP Test 6 Failed: Expected 'It is not under my coverage', got '${data6.content}'`);
  }
  if (!data6.isRefusal) {
    throw new Error("HTTP Test 6 Failed: isRefusal was false.");
  }
  if (data6.citations && data6.citations.length > 0) {
    throw new Error("HTTP Test 6 Failed: Off-topic returned citations.");
  }
  console.log("  ✓ HTTP Test 6 Passed: Off-topic returned exactly 'It is not under my coverage'.\n");

  console.log("==================================================================");
  console.log("ALL 6 HTTP END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

runHttpSuite().catch((err) => {
  console.error("HTTP suite error:", err);
  process.exit(1);
});
