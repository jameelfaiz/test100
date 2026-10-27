// scratch/test_http_fd_release.ts
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

  // 1. Fetch CSRF token
  const csrfRes = await fetch("http://localhost:5000/api/auth/csrf-token");
  updateCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();

  // 2. Login as FD Employee
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ userId: "fd_emp", password: "fd_emp_pass" }),
  });
  updateCookies(loginRes);
  console.log("FD Login Status:", loginRes.status);

  const activeToken = cookieJar["XSRF-TOKEN"] || csrfToken;

  // 3. Fetch Release Applications
  const relRes = await fetch("http://localhost:5000/api/fd/release-applications", {
    headers: {
      Cookie: getCookieHeader(),
    },
  });
  const releases = await relRes.json();
  console.log("\nTotal Release Applications:", releases.length);

  const balaji = releases.find((r: any) => /balaji/i.test(r.collegeName) || /balaji/i.test(r.collegeId));
  console.log("\n=== BALAJI COLLEGE RELEASE APPLICATION (HTTP GET /fd/release-applications) ===");
  console.log({
    id: balaji?.id,
    collegeName: balaji?.collegeName,
    collegeId: balaji?.collegeId,
    pgrcClearance: balaji?.pgrcClearance,
    vigilanceClearance: balaji?.vigilanceClearance,
    overallDecision: balaji?.overallDecision,
  });

  // 4. Test Refresh Clearance Endpoint
  if (balaji) {
    const refreshRes = await fetch(`http://localhost:5000/api/fd/release/${balaji.id}/refresh-clearance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: getCookieHeader(),
        "x-csrf-token": activeToken,
      },
      body: JSON.stringify({}),
    });
    const refreshed = await refreshRes.json();
    console.log("\n=== BALAJI COLLEGE REFRESH CLEARANCE (HTTP POST /fd/release/:id/refresh-clearance) ===");
    console.log(refreshed);
  }
}

run().catch(console.error);
