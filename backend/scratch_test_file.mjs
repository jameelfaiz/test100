import axios from 'axios';

async function testFileDownload() {
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

  // Try to download one of Sakthi's files: 42192a96-976e-4c87-a1f6-1f0e3530d4b8.jpeg
  const fileRes = await client.get('/api/institution/files/42192a96-976e-4c87-a1f6-1f0e3530d4b8.jpeg', {
    headers: { 'Cookie': sessionCookie.join('; ') },
    responseType: 'arraybuffer'
  });

  console.log('File download status:', fileRes.status);
  console.log('Content-Type:', fileRes.headers['content-type']);
  console.log('Downloaded bytes:', fileRes.data.length);
}

testFileDownload().catch(err => {
  console.error('File download failed:', err.response?.status, err.message);
});
