// backend/scripts/test_inst_chat.ts
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../src/models/User";

async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/aicte_unified");
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash("Inst@12345", salt);
  await User.updateOne({ userId: "HIi" }, { passwordHash: hash });
  console.log("Password reset for HIi to Inst@12345");
  await mongoose.disconnect();

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

  console.log("\n=== TESTING INSTITUTION LIVE SESSION CHATBOT QUERY ===");

  // 1. Get CSRF token
  const csrfRes = await fetch("http://localhost:5000/api/auth/csrf-token");
  updateCookies(csrfRes);
  const csrfData = await csrfRes.json();
  const token = csrfData.csrfToken;

  // 2. Login as HIi (Institution)
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": token,
    },
    body: JSON.stringify({ userId: "HIi", password: "Inst@12345" }),
  });
  updateCookies(loginRes);

  console.log("Institution Login Status:", loginRes.status);
  if (loginRes.status !== 200) {
    const err = await loginRes.text();
    throw new Error(`Login failed: ${err}`);
  }

  // 3. Query: "Why was my document rejected?"
  let activeToken = cookieJar["XSRF-TOKEN"] || token;
  const chat1 = await fetch("http://localhost:5000/api/chatbot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": activeToken,
    },
    body: JSON.stringify({
      message: "Why was my document rejected?",
      clientContext: { portal: "Institution Portal", route: "/institution/dashboard" },
    }),
  });

  const data1 = await chat1.json();
  console.log("\n[Institution Query: Why was my document rejected?]");
  console.log("Status:", chat1.status);
  console.log("Response:\n" + data1.content);

  // Check if live deficiency remark "Mistake in Name" is in the response!
  if (!data1.content.includes("Mistake in Name") || !data1.content.includes("Approved Building Plan")) {
    throw new Error("Institution query failed to retrieve live deficiency remark!");
  }
  console.log("\n✓ SUCCESS: Live FD officer remark 'Mistake in Name' retrieved and presented!");

  // 4. Off-topic query: "What is the weather today?"
  activeToken = cookieJar["XSRF-TOKEN"] || token;
  const chat2 = await fetch("http://localhost:5000/api/chatbot/query", {
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

  const data2 = await chat2.json();
  console.log("\n[Institution Query: What is the weather today?]");
  console.log("Status:", chat2.status);
  console.log("Response:", data2.content);
  console.log("Is Refusal:", data2.isRefusal);

  if (!data2.isRefusal) {
    throw new Error("Off-topic weather question was not refused!");
  }
  console.log("\n✓ SUCCESS: Off-topic query politely refused!");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
