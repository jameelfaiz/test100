import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:5000';

async function testFlow() {
  console.log('--- 1. Logging in as Institution (CLG-2026-000001) ---');
  const instClient = axios.create({ baseURL: BASE_URL, withCredentials: true });
  
  // Get CSRF
  const csrfRes = await instClient.get('/api/auth/csrf-token');
  const csrfToken = csrfRes.data.csrfToken;
  const cookie = csrfRes.headers['set-cookie'];

  const loginRes = await instClient.post('/api/auth/login', {
    userId: 'CLG-2026-000001',
    password: 'TestPass@123'
  }, {
    headers: {
      'Cookie': cookie,
      'x-csrf-token': csrfToken
    }
  });
  console.log('Institution logged in:', loginRes.data.userId, loginRes.data.role);
  const instCookie = loginRes.headers['set-cookie'] || cookie;
  const instCsrf = loginRes.data.csrfToken || csrfToken;

  // Create a genuine dummy PDF for upload
  const uploadsDir = path.resolve('./uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const dummyPdfPath = path.join(uploadsDir, 'genuine_test_fdr.pdf');
  fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n% Genuine Test FDR Content\n%%EOF');

  console.log('\n--- 2. Uploading Genuine FDR Document ---');
  const form = new FormData();
  form.append('file', fs.createReadStream(dummyPdfPath), {
    filename: 'genuine_test_fdr.pdf',
    contentType: 'application/pdf'
  });

  const uploadRes = await instClient.post('/api/institution/upload', form, {
    headers: {
      ...form.getHeaders(),
      'Cookie': instCookie,
      'x-csrf-token': instCsrf
    }
  });
  console.log('Upload response:', uploadRes.data.message, 'Filename:', uploadRes.data.fileName);
  const uploadedFileName = uploadRes.data.fileName;

  console.log('\n--- 3. Submitting FDR Payment Details ---');
  const fdrPayload = {
    fdrNumber: `FDR-GENUINE-${Date.now()}`,
    amount: '5000000',
    maturityDate: '2030-05-15',
    bankName: 'State Bank of India',
    branchName: 'Nehru Place Branch',
    ifscCode: 'SBIN0004567',
    bankEmployeeName: 'Rajesh Sharma',
    bankEmployeeId: 'SBI-EMP-44912',
    bankEmployeeDesignation: 'Chief Manager & Authorised Signatory',
    bankEmployeeContact: '011-26448899',
    documentPath: uploadedFileName,
    originalDocumentName: 'Genuine_State_Bank_FDR.pdf'
  };

  const paymentRes = await instClient.post('/api/institution/payment', fdrPayload, {
    headers: {
      'Cookie': instCookie,
      'x-csrf-token': instCsrf
    }
  });
  console.log('FDR Submitted successfully:', paymentRes.data.payment.paymentId);
  const submittedPaymentId = paymentRes.data.payment.paymentId;

  console.log('\n--- 4. Logging in as FD Employee (fd_emp) ---');
  const fdClient = axios.create({ baseURL: BASE_URL, withCredentials: true });
  const fdCsrfRes = await fdClient.get('/api/auth/csrf-token');
  const fdCsrf = fdCsrfRes.data.csrfToken;
  const fdCookieInit = fdCsrfRes.headers['set-cookie'];

  const fdLoginRes = await fdClient.post('/api/auth/login', {
    userId: 'fd_emp',
    password: 'fd_emp_pass'
  }, {
    headers: {
      'Cookie': fdCookieInit,
      'x-csrf-token': fdCsrf
    }
  });
  console.log('FD Employee logged in:', fdLoginRes.data.userId, fdLoginRes.data.role);
  const fdCookie = fdLoginRes.headers['set-cookie'] || fdCookieInit;
  const fdCsrfAfter = fdLoginRes.data.csrfToken || fdCsrf;

  console.log('\n--- 5. Fetching Deposit Records on FD Portal ---');
  const depositsRes = await fdClient.get('/api/fd/deposits', {
    headers: { 'Cookie': fdCookie }
  });
  const deposits = depositsRes.data;
  console.log(`Total deposits retrieved: ${deposits.length}`);
  const match = deposits.find(d => d.id === submittedPaymentId || d.fdrNumber === fdrPayload.fdrNumber);
  if (!match) {
    throw new Error('Submitted FDR not found in FD deposits list!');
  }
  console.log('✅ Found matching deposit on FD portal:');
  console.log(`  FDR Number: ${match.fdrNumber}`);
  console.log(`  Amount: ${match.amount}`);
  console.log(`  Bank Name: ${match.bankName}`);
  console.log(`  Branch Name: ${match.branchName}`);
  console.log(`  IFSC: ${match.ifscCode}`);
  console.log(`  Bank Employee: ${match.bankEmployeeName} (${match.bankEmployeeDesignation}) ID: ${match.bankEmployeeId}`);
  console.log(`  Documents Count: ${match.documents.length}`);
  console.log(`  Document[0]: name="${match.documents[0]?.name}", file="${match.documents[0]?.fileName}"`);

  if (match.documents.length !== 1) {
    throw new Error(`Expected exactly 1 document, found ${match.documents.length}`);
  }

  console.log('\n--- 6. Testing Manual Verification on Deposit Document ---');
  const targetDocId = match.documents[0].id;
  const verifyRes = await fdClient.post(`/api/fd/deposit/${submittedPaymentId}/verify-document`, {
    docId: targetDocId,
    status: 'Verified'
  }, {
    headers: {
      'Cookie': fdCookie,
      'x-csrf-token': fdCsrfAfter
    }
  });
  console.log('Manual Verify Response:', verifyRes.data.message);

  // Check updated status
  const depositsAfter = (await fdClient.get('/api/fd/deposits', { headers: { 'Cookie': fdCookie } })).data;
  const matchAfter = depositsAfter.find(d => d.id === submittedPaymentId);
  console.log('Status after manual verify:', matchAfter.status);
  console.log('Doc[0] status after verify:', matchAfter.documents[0]?.status);

  console.log('\n--- 7. Testing Manual "Not Verified" with Mandatory Remarks ---');
  const rejectRes = await fdClient.post(`/api/fd/deposit/${submittedPaymentId}/verify-document`, {
    docId: targetDocId,
    status: 'Not Verified',
    remarks: 'Bank branch seal is faint and requires re-scan.'
  }, {
    headers: {
      'Cookie': fdCookie,
      'x-csrf-token': fdCsrfAfter
    }
  });
  console.log('Manual Not Verified Response:', rejectRes.data.message);

  const depositsAfterReject = (await fdClient.get('/api/fd/deposits', { headers: { 'Cookie': fdCookie } })).data;
  const matchAfterReject = depositsAfterReject.find(d => d.id === submittedPaymentId);
  console.log('Status after rejection:', matchAfterReject.status);
  console.log('Doc[0] remarks:', matchAfterReject.documents[0]?.remarks);

  console.log('\n✅ ALL INTEGRATION CHECKS PASSED SUCCESSFULLY!');
}

testFlow().catch(console.error);
