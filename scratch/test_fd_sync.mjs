import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import fetchCookie from 'fetch-cookie';

const jar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, jar);

(async () => {
  const loginRes = await fetchWithCookies('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'fd_emp', password: 'password123' }),
    redirect: 'manual',
  });
  console.log('Login status', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Login data', loginData);

  const appsRes = await fetchWithCookies('http://localhost:5000/api/fd/applications', { method: 'GET' });
  console.log('Apps status', appsRes.status);
  const appsData = await appsRes.json();
  console.log('Apps count', Array.isArray(appsData) ? appsData.length : 0);
  console.log('First app', appsData[0]);
})();
