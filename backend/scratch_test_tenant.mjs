import axios from 'axios';

async function testOtherInstitutionAccess() {
  const client = axios.create({
    baseURL: 'http://localhost:5000',
    withCredentials: true,
  });

  const csrfRes = await client.get('/api/auth/csrf-token');
  const cookie = csrfRes.headers['set-cookie'];

  // Login as CLG-2026-000001
  const loginRes = await client.post('/api/auth/login', {
    userId: 'CLG-2026-000001',
    password: 'TestPass@123',
  }, {
    headers: {
      'Cookie': cookie?.join('; '),
      'X-XSRF-TOKEN': csrfRes.data.csrfToken,
    }
  });

  const sessionCookie = loginRes.headers['set-cookie'] || cookie;

  // Try to download Sakthi's file: 42192a96-976e-4c87-a1f6-1f0e3530d4b8.jpeg
  try {
    const fileRes = await client.get('/api/institution/files/42192a96-976e-4c87-a1f6-1f0e3530d4b8.jpeg', {
      headers: { 'Cookie': sessionCookie.join('; ') },
    });
    console.log('UNAUTHORIZED ACCESS ALLOWED! Status:', fileRes.status);
  } catch (err) {
    console.log('ACCESS BLOCKED! Status:', err.response?.status, err.response?.data);
  }
}

testOtherInstitutionAccess();
