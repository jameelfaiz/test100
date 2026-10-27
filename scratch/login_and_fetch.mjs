import fetch from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, jar);

const base = 'http://localhost:5000';

(async () => {
  try {
    // Get CSRF token first
    const csrfRes = await fetchWithCookies(`${base}/api/auth/csrf-token`, { credentials: 'include' });
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    console.log('CSRF token:', csrfToken);

    // Login as FD employee
    const loginRes = await fetchWithCookies(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
      body: JSON.stringify({ userId: 'fd_emp', password: process.env.FD_PASSWORD || '' }),
      credentials: 'include',
    });
    const loginData = await loginRes.json();
    console.log('Login response:', loginRes.status, loginData);

    // If login required password, retrieve from credentials file (skip placeholder)
    // For now attempt with known password from credentials file (the one printed earlier). Replace <placeholder> with actual password if needed.
    if (loginRes.status !== 200) {
      console.error('Login failed, cannot fetch applications');
      return;
    }

    // Fetch applications
    const appsRes = await fetchWithCookies(`${base}/api/fd/applications`, {
      method: 'GET',
      headers: { 'X-XSRF-TOKEN': csrfToken },
      credentials: 'include',
    });
    const apps = await appsRes.json();
    console.log('Applications response status:', appsRes.status);
    console.log('Applications data:', JSON.stringify(apps, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
})();
