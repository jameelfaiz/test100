import axios from 'axios';

async function testAllFdEndpoints() {
  const client = axios.create({
    baseURL: 'http://localhost:5000',
    withCredentials: true,
  });

  const csrfRes = await client.get('/api/auth/csrf-token');
  const cookie = csrfRes.headers['set-cookie'];

  const loginRes = await client.post('/api/auth/login', {
    userId: 'fd_emp',
    password: '$mvV$7eBm277xm6GBN',
  }, {
    headers: {
      'Cookie': cookie?.join('; '),
      'X-XSRF-TOKEN': csrfRes.data.csrfToken,
    }
  });

  const sessionCookie = loginRes.headers['set-cookie'] || cookie;
  const headers = { 'Cookie': sessionCookie.join('; ') };

  const endpoints = [
    '/api/fd/dashboard',
    '/api/fd/applications',
    '/api/fd/deposits',
    '/api/fd/alive-records',
    '/api/fd/release-applications',
    '/api/fd/notifications'
  ];

  for (const ep of endpoints) {
    try {
      const res = await client.get(ep, { headers });
      console.log(`✅ ${ep}: status ${res.status}, isArray: ${Array.isArray(res.data)}, data:`, Array.isArray(res.data) ? `array of ${res.data.length}` : typeof res.data);
    } catch (err) {
      console.error(`❌ ${ep} FAILED:`, err.response?.status, err.response?.data || err.message);
    }
  }
}

testAllFdEndpoints();
