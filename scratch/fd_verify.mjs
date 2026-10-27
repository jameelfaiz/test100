import fetch from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, jar);

const base = 'http://localhost:5000';

(async () => {
  try {
    // CSRF token
    const csrfRes = await fetchWithCookies(`${base}/api/auth/csrf-token`, { credentials: 'include' });
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    console.log('CSRF token:', csrfToken);

    // Login using known password
    const loginRes = await fetchWithCookies(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
      body: JSON.stringify({ userId: 'fd_emp', password: 'fd_test_pass' }),
      credentials: 'include',
    });
    const loginData = await loginRes.json();
    console.log('Login status:', loginRes.status, loginData);
    if (loginRes.status !== 200) return;

    // Fetch applications
    const appsRes = await fetchWithCookies(`${base}/api/fd/applications`, {
      method: 'GET',
      headers: { 'X-XSRF-TOKEN': csrfToken },
      credentials: 'include',
    });
    const apps = await appsRes.json();
    console.log('Applications fetched:', appsRes.status);
    if (!Array.isArray(apps) || apps.length === 0) {
      console.log('No applications found');
      return;
    }
    const app = apps[0];
    console.log('First application ID:', app.id, 'College ID:', app.collegeId);
    console.log('Document count:', app.documents?.length || 0);
    if (app.documents && app.documents.length > 0) {
      const doc = app.documents[0];
      console.log('First document fileName:', doc.fileName);
      // Fetch preview
      const previewRes = await fetchWithCookies(`${base}/api/fd/files/${doc.fileName}`, {
        method: 'GET',
        headers: { 'X-XSRF-TOKEN': csrfToken },
        credentials: 'include',
      });
      console.log('Preview fetch status:', previewRes.status);
    }

    // Test verification: mark first document Not Verified with a remark
    const verifyRes = await fetchWithCookies(`${base}/api/fd/application/${app.id}/verify-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
      body: JSON.stringify({ docId: app.documents[0].id, status: 'Not Verified', remarks: 'Test deficiency remark' }),
      credentials: 'include',
    });
    const verifyData = await verifyRes.json();
    console.log('Verify response status:', verifyRes.status, verifyData.message);

    // Refetch application to see updated status
    const appRes2 = await fetchWithCookies(`${base}/api/fd/applications`, {
      method: 'GET',
      headers: { 'X-XSRF-TOKEN': csrfToken },
      credentials: 'include',
    });
    const apps2 = await appRes2.json();
    const updatedApp = apps2.find(a => a.id === app.id);
    console.log('Updated doc status:', updatedApp?.documents?.[0]?.status, 'remarks:', updatedApp?.documents?.[0]?.remarks);
  } catch (e) {
    console.error('Error:', e);
  }
})();
