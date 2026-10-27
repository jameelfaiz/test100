import axios from 'axios';

async function testFdApplications() {
  const client = axios.create({
    baseURL: 'http://localhost:5000',
    withCredentials: true,
  });

  // Get CSRF
  const csrfRes = await client.get('/api/auth/csrf-token');
  const cookie = csrfRes.headers['set-cookie'];
  console.log('CSRF Token:', csrfRes.data);

  // Login as fd_emp
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
  console.log('Login status:', loginRes.status, loginRes.data);

  // Get applications
  const appsRes = await client.get('/api/fd/applications', {
    headers: {
      'Cookie': sessionCookie.join('; '),
    }
  });

  console.log('FD Applications count:', appsRes.data.length);
  appsRes.data.forEach((app, i) => {
    console.log(`\n--- FD App ${i} ---`);
    console.log(`id: ${app.id}`);
    console.log(`collegeId: ${app.collegeId}`);
    console.log(`institutionName: ${app.institutionName}`);
    console.log(`collegeName: ${app.collegeName}`);
    console.log(`programme: ${app.programme}`);
    console.log(`status: ${app.status}`);
    console.log(`documents count: ${app.documents?.length}`);
    if (app.documents && app.documents.length > 0) {
      console.log('First 2 docs:', app.documents.slice(0, 2));
    }
  });
}

testFdApplications().catch(err => {
  console.error('Error:', err.response?.data || err.message);
});
