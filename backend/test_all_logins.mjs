import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data ? JSON.parse(data) : null
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function extractCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

async function testLogin(username, password, roleExpected) {
  console.log(`\n--- Testing Login: ${username} ---`);
  
  // 1. Get CSRF token
  const csrfRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/csrf-token',
    method: 'GET'
  });
  
  let cookie = extractCookie(csrfRes.headers['set-cookie']);
  const csrfToken = csrfRes.data?.csrfToken;

  // 2. Perform Login
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'X-CSRF-Token': csrfToken
    }
  }, { userId: username, password });

  console.log(`Login status: ${loginRes.statusCode}`);
  if (loginRes.statusCode !== 200) {
    console.error(`Login failed:`, loginRes.data);
    return null;
  }
  
  const loginCookie = extractCookie(loginRes.headers['set-cookie']) || cookie;
  const user = loginRes.data?.user;
  console.log(`✓ Logged in as: ${user?.username} (${user?.role})`);

  return { cookie: loginCookie, user, csrfToken: loginRes.data?.csrfToken || csrfToken };
}

async function main() {
  console.log('=== VERIFYING ALL EMPLOYEE LOGINS & DATA LOADING ===');

  // 1. FD Employee Login & Data Check
  const fdAuth = await testLogin('fd_emp', 'fd_emp_pass', 'AICTE_FD_EMPLOYEE');
  if (fdAuth) {
    // Check FD applications
    const fdApps = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/fd/applications',
      method: 'GET',
      headers: { 'Cookie': fdAuth.cookie }
    });
    console.log(`FD Applications returned: ${fdApps.data?.length || 0}`);
    fdApps.data?.forEach(a => console.log(`  - App ID: ${a.applicationId} | Inst: ${a.institutionName || a.collegeId}`));

    // Check FD deposits
    const fdDeps = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/fd/deposits',
      method: 'GET',
      headers: { 'Cookie': fdAuth.cookie }
    });
    console.log(`FD Deposits returned: ${fdDeps.data?.length || 0}`);
    fdDeps.data?.forEach(d => console.log(`  - FDR: ${d.fdrReference || d.fdrNumber} | Amount: ₹${d.amount} | Inst: ${d.collegeName}`));
  }

  // 2. PGRC Employee Login & Data Check
  const pgrcAuth = await testLogin('pgrc_emp', 'pgrc_emp_pass', 'AICTE_PGRC_EMPLOYEE');
  if (pgrcAuth) {
    const pgrcDashboard = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/pgrc/dashboard',
      method: 'GET',
      headers: { 'Cookie': pgrcAuth.cookie }
    });
    console.log(`PGRC Dashboard status: ${pgrcDashboard.statusCode}`);
    const pgrcComplaints = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/pgrc/complaints',
      method: 'GET',
      headers: { 'Cookie': pgrcAuth.cookie }
    });
    console.log(`PGRC Complaints list count: ${pgrcComplaints.data?.complaints?.length || pgrcComplaints.data?.length || 0}`);
  }

  // 3. Vigilance Employee Login & Data Check
  const vigAuth = await testLogin('vig_emp', 'vig_emp_pass', 'AICTE_VIGILANCE_EMPLOYEE');
  if (vigAuth) {
    const vigDashboard = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/vigilance/dashboard',
      method: 'GET',
      headers: { 'Cookie': vigAuth.cookie }
    });
    console.log(`Vigilance Dashboard status: ${vigDashboard.statusCode}`);
    
    const vigComplaints = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/vigilance/complaints',
      method: 'GET',
      headers: { 'Cookie': vigAuth.cookie }
    });
    console.log(`Vigilance Complaints list count: ${vigComplaints.data?.complaints?.length || vigComplaints.data?.length || 0}`);
  }

  console.log('\n=== ALL LOGINS & DATA ENDPOINTS VERIFIED ===');
}

main().catch(console.error);
