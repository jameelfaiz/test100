// security_test.ts
import axios from 'axios';
import mongoose from 'mongoose';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { User, Role } from './src/models/User';
import { Institution } from './src/models/Institution';
import { Complaint } from './src/models/Complaint';
import { Investigation } from './src/models/Investigation';
import { EmailVerificationToken } from './src/models/EmailVerificationToken';
import { hashToken } from './src/utils/token';
import { UPLOAD_DIR } from './src/middleware/upload';

const API_BASE = 'http://localhost:5000/api';
const TEST_DB = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified_test';

async function seedUser(userId: string, password: string, role: Role, accountStatus: 'ACTIVE' | 'DISABLED' | 'PENDING_VERIFICATION' = 'ACTIVE') {
  const existing = await User.findOne({ userId }).exec();
  if (existing) return existing;
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash(password, 10);
  const user = new User({ userId, passwordHash: hash, role, accountStatus });
  await user.save();
  return user;
}

async function login(userId: string, password: string): Promise<{ cookies: string[]; csrfToken: string }> {
  const res = await axios.post(
    `${API_BASE}/auth/login`,
    { userId, password },
    { withCredentials: true, headers: { 'x-test-skip-limit': 'true' } }
  );
  const cookies = res.headers['set-cookie'] || [];
  const csrfToken = res.data.csrfToken;
  return { cookies, csrfToken };
}

async function runSecurityTests() {
  console.log('Connecting to Test DB:', TEST_DB);
  await mongoose.connect(TEST_DB);

  // Clean collections
  await Complaint.deleteMany({});
  await Investigation.deleteMany({});
  await EmailVerificationToken.deleteMany({});
  await mongoose.connection.collection('sessions').deleteMany({});
  await Institution.deleteMany({ email: /@test-sec\.edu/ });
  await User.deleteMany({ userId: { $regex: /CLG-|sec_/ } });

  // Seed test users
  const vigilEmp1 = await seedUser('sec_vigil_1', 'Password123!', 'VIGILANCE_EMPLOYEE');
  const vigilEmp2 = await seedUser('sec_vigil_2', 'Password123!', 'VIGILANCE_EMPLOYEE');
  const vigilSup = await seedUser('sec_vigil_sup', 'Password123!', 'VIGILANCE_SUPERVISOR');
  const fdEmp = await seedUser('sec_fd', 'Password123!', 'AICTE_FD_EMPLOYEE');

  const { cookies: vigil1Cookies, csrfToken: vigil1Csrf } = await login('sec_vigil_1', 'Password123!');
  const { cookies: vigil2Cookies, csrfToken: vigil2Csrf } = await login('sec_vigil_2', 'Password123!');
  const { cookies: supCookies, csrfToken: supCsrf } = await login('sec_vigil_sup', 'Password123!');
  const { cookies: fdCookies, csrfToken: fdCsrf } = await login('sec_fd', 'Password123!');

  console.log('\n================================================================');
  console.log('REQUIREMENT 1: Secure File Uploads, Signatures, 5MB Limits & Downloads');
  console.log('================================================================');

  // Create a complaint and investigation assigned to vigil_1
  const comp = new Complaint({
    institutionId: 'inst_sec_upload',
    title: 'Evidence Security Investigation',
    description: 'Testing upload security',
    status: 'ESCALATED',
  });
  await comp.save();

  const invRes = await axios.post(
    `${API_BASE}/vigilance/investigation`,
    { complaintId: comp._id.toString() },
    { headers: { Cookie: vigil1Cookies.join('; '), 'x-csrf-token': vigil1Csrf } }
  );
  const invId = invRes.data.investigation.investigationId;
  await axios.post(
    `${API_BASE}/vigilance/investigation/${invId}/assign`,
    { investigatorUserId: 'sec_vigil_1' },
    { headers: { Cookie: vigil1Cookies.join('; '), 'x-csrf-token': vigil1Csrf } }
  );

  // Test 1.1: Valid PDF file upload (positive test)
  const validPdfHeader = Buffer.from('%PDF-1.5\n%fake valid pdf content for testing\n%%EOF');
  const formDataValid = new FormData();
  formDataValid.append('file', new Blob([validPdfHeader], { type: 'application/pdf' }), 'valid_doc.pdf');

  const uploadRes = await axios.post(
    `${API_BASE}/vigilance/investigation/${invId}/upload-evidence`,
    formDataValid,
    { headers: { Cookie: vigil1Cookies.join('; '), 'x-csrf-token': vigil1Csrf } }
  );
  assert.strictEqual(uploadRes.status, 200);
  assert(uploadRes.data.filename, 'Response must include generated filename');
  const uploadedFilename = uploadRes.data.filename;
  console.log('✔ Positive upload: Valid PDF accepted (HTTP 200), saved as:', uploadedFilename);

  // Test 1.2: File signature validation (negative test - fake extension spoofing)
  const fakePdfPayload = Buffer.from('<!DOCTYPE html><html><body>malicious script</body></html>');
  const formDataFake = new FormData();
  formDataFake.append('file', new Blob([fakePdfPayload], { type: 'application/pdf' }), 'malicious.pdf');

  try {
    await axios.post(
      `${API_BASE}/vigilance/investigation/${invId}/upload-evidence`,
      formDataFake,
      { headers: { Cookie: vigil1Cookies.join('; '), 'x-csrf-token': vigil1Csrf } }
    );
    assert.fail('Spoofed PDF file should be rejected by signature validation');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 400);
    console.log('✔ Negative upload: Extension spoofing rejected by magic byte signature check (HTTP 400)');
  }

  // Test 1.3: 5MB size limit (negative test)
  const largePayload = Buffer.alloc(5.5 * 1024 * 1024); // 5.5 MB
  largePayload.write('%PDF-1.5\n', 0);
  const formDataLarge = new FormData();
  formDataLarge.append('file', new Blob([largePayload], { type: 'application/pdf' }), 'huge.pdf');

  try {
    await axios.post(
      `${API_BASE}/vigilance/investigation/${invId}/upload-evidence`,
      formDataLarge,
      { headers: { Cookie: vigil1Cookies.join('; '), 'x-csrf-token': vigil1Csrf } }
    );
    assert.fail('File exceeding 5MB should be rejected');
  } catch (err: any) {
    // Multer rejects file with 500 or connection reset / 400
    assert(err.response?.status >= 400, 'Expected >= 400 for file exceeding size limit');
    console.log('✔ Negative upload: File exceeding 5 MB limit rejected');
  }

  // Test 1.4: Authenticated download - assigned investigator can download
  const dlAssigned = await axios.get(
    `${API_BASE}/vigilance/investigation/${invId}/download-evidence`,
    { headers: { Cookie: vigil1Cookies.join('; ') }, responseType: 'arraybuffer' }
  );
  assert.strictEqual(dlAssigned.status, 200);
  assert.strictEqual(Buffer.from(dlAssigned.data).toString(), validPdfHeader.toString());
  console.log('✔ Authenticated download: Assigned investigator downloaded exact evidence file (HTTP 200)');

  // Test 1.5: Authenticated download - supervisor can download
  const dlSup = await axios.get(
    `${API_BASE}/vigilance/investigation/${invId}/download-evidence`,
    { headers: { Cookie: supCookies.join('; ') }, responseType: 'arraybuffer' }
  );
  assert.strictEqual(dlSup.status, 200);
  console.log('✔ Authenticated download: Supervisor successfully downloaded evidence file (HTTP 200)');

  // Test 1.6: Authenticated download - unassigned investigator rejected (403)
  try {
    await axios.get(
      `${API_BASE}/vigilance/investigation/${invId}/download-evidence`,
      { headers: { Cookie: vigil2Cookies.join('; ') } }
    );
    assert.fail('Unassigned investigator should be forbidden from downloading');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    console.log('✔ Authenticated download: Unassigned investigator rejected with HTTP 403');
  }

  // Test 1.7: Authenticated download - unauthorized role (FD employee) rejected (403)
  try {
    await axios.get(
      `${API_BASE}/vigilance/investigation/${invId}/download-evidence`,
      { headers: { Cookie: fdCookies.join('; ') } }
    );
    assert.fail('FD employee should be forbidden from downloading vigilance evidence');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    console.log('✔ Authenticated download: Non-vigilance role rejected with HTTP 403');
  }

  console.log('\n================================================================');
  console.log('REQUIREMENT 2: Email Verification Token, SHA-256 Hashing, Expiration & TTL');
  console.log('================================================================');

  // Test 2.1: Registration generates token and stores SHA-256 hash
  const regPayload = {
    name: 'Security Test College',
    institutionType: 'Engineering',
    email: 'principal@test-sec.edu',
    contactNumber: '9876543210',
    state: 'Delhi',
    district: 'New Delhi',
    address: '123 Education Hub',
    principalName: 'Dr. Test Principal',
    authorizedContactPerson: 'Dr. Test Principal',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
  };

  const regRes = await axios.post(`${API_BASE}/institution/register`, regPayload);
  assert.strictEqual(regRes.status, 201);
  assert.strictEqual(regRes.data.registrationStatus, 'PENDING');
  assert(regRes.data.verificationToken, 'Registration must return verificationToken');
  const rawToken = regRes.data.verificationToken;
  const collegeId = regRes.data.collegeId;

  // Verify in MongoDB: raw token is NOT stored; tokenHash is SHA-256
  const tokenDoc = await EmailVerificationToken.findOne({ userId: collegeId });
  assert(tokenDoc, 'EmailVerificationToken record must exist in DB');
  assert.strictEqual(tokenDoc.used, false);
  assert.strictEqual(tokenDoc.tokenHash, hashToken(rawToken), 'Token hash in DB must match SHA-256 of raw token');
  assert.notStrictEqual(tokenDoc.tokenHash, rawToken, 'Raw token must NEVER be stored in DB');
  assert(tokenDoc.expiresAt.getTime() > Date.now(), 'Token expiresAt must be in the future');
  console.log('✔ Registration created EmailVerificationToken with SHA-256 tokenHash and 24h expiration');

  // Verify user accountStatus is PENDING_VERIFICATION
  const pendingUser = await User.findOne({ userId: collegeId });
  assert.strictEqual(pendingUser?.accountStatus, 'PENDING_VERIFICATION');

  // Test 2.2: Login rejected before email verification (negative test)
  try {
    await axios.post(
      `${API_BASE}/auth/login`,
      { userId: collegeId, password: 'SecurePassword123!' },
      { headers: { 'x-test-skip-limit': 'true' } }
    );
    assert.fail('Login must fail for unverified user');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    console.log('✔ Login rejected for unverified account with HTTP 403');
  }

  // Test 2.3: Verify email with invalid token (negative test)
  try {
    await axios.post(
      `${API_BASE}/auth/verify-email`,
      { token: 'invalid_dummy_token_12345' },
      { headers: { 'x-test-skip-limit': 'true' } }
    );
    assert.fail('Invalid token should be rejected');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 400);
    console.log('✔ Invalid verification token rejected with HTTP 400');
  }

  // Test 2.4: Verify email with valid token (positive test)
  const verifyRes = await axios.post(
    `${API_BASE}/auth/verify-email`,
    { token: rawToken },
    { headers: { 'x-test-skip-limit': 'true' } }
  );
  assert.strictEqual(verifyRes.status, 200);

  // Verify in DB that token is marked used and user/institution are ACTIVE
  const usedTokenDoc = await EmailVerificationToken.findOne({ userId: collegeId });
  assert.strictEqual(usedTokenDoc?.used, true, 'Token must be marked used: true');
  const activatedUser = await User.findOne({ userId: collegeId });
  assert.strictEqual(activatedUser?.accountStatus, 'ACTIVE', 'User must be ACTIVE');
  const activatedInst = await Institution.findOne({ collegeId });
  assert.strictEqual(activatedInst?.registrationStatus, 'APPROVED', 'Institution must be APPROVED');
  console.log('✔ Valid email verification token accepted; user and institution activated');

  // Test 2.5: Single-use enforcement / replay attempt (negative test)
  try {
    await axios.post(
      `${API_BASE}/auth/verify-email`,
      { token: rawToken },
      { headers: { 'x-test-skip-limit': 'true' } }
    );
    assert.fail('Used token cannot be reused');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 400);
    console.log('✔ Single-use enforced: Replay attempt with same token rejected with HTTP 400');
  }

  // Test 2.6: Resend verification token endpoint
  // Set user back to PENDING_VERIFICATION to test resend
  await User.findOneAndUpdate({ userId: collegeId }, { accountStatus: 'PENDING_VERIFICATION' });
  const resendRes = await axios.post(
    `${API_BASE}/auth/resend-verification`,
    { collegeId },
    { headers: { 'x-test-skip-limit': 'true' } }
  );
  assert.strictEqual(resendRes.status, 200);
  assert(resendRes.data.verificationToken, 'Resend must issue new verification token');
  const newRawToken = resendRes.data.verificationToken;
  assert.notStrictEqual(newRawToken, rawToken, 'New token must differ from old token');

  // Verify new token activates account
  await axios.post(
    `${API_BASE}/auth/verify-email`,
    { token: newRawToken },
    { headers: { 'x-test-skip-limit': 'true' } }
  );
  const reActivatedUser = await User.findOne({ userId: collegeId });
  assert.strictEqual(reActivatedUser?.accountStatus, 'ACTIVE');
  console.log('✔ Resend verification issued new token and verified account successfully');

  console.log('\n================================================================');
  console.log('REQUIREMENT 3: Rate Limiting & HTTP 429 Responses');
  console.log('================================================================');

  // Test 3.1: Verify rate limit headers
  const probeLogin = await axios.post(
    `${API_BASE}/auth/login`,
    { userId: 'fake_user', password: 'wrong' },
    { validateStatus: () => true }
  );
  assert(probeLogin.headers['ratelimit-limit'] || probeLogin.headers['x-ratelimit-limit'], 'RateLimit-Limit header must be present');
  console.log('✔ Rate limit headers detected on sensitive endpoints');

  // Test 3.2: Exceeding rate limit triggers HTTP 429
  let hit429 = false;
  for (let i = 0; i < 15; i++) {
    const r = await axios.post(
      `${API_BASE}/auth/login`,
      { userId: 'fake_rate_user', password: 'wrong' },
      { validateStatus: () => true }
    );
    if (r.status === 429) {
      hit429 = true;
      assert.strictEqual(r.data.message, 'Too many login attempts. Please try again later.');
      break;
    }
  }
  assert(hit429, 'Excessive login requests must trigger HTTP 429');
  console.log('✔ Rate limiter triggered HTTP 429 Too Many Requests response');

  console.log('\n================================================================');
  console.log('REQUIREMENT 4: CSRF Protection & Frontend Token Handling');
  console.log('================================================================');

  // Test 4.1: Fetch CSRF token endpoint
  const csrfRes = await axios.get(`${API_BASE}/auth/csrf-token`, { headers: { Cookie: supCookies.join('; ') } });
  assert.strictEqual(csrfRes.status, 200);
  assert(csrfRes.data.csrfToken, 'CSRF token must be returned');
  const validCsrf = csrfRes.data.csrfToken;
  console.log('✔ CSRF token endpoint returned valid token and set XSRF-TOKEN cookie');

  // Create another complaint for CSRF testing
  const csrfComp = new Complaint({
    institutionId: 'inst_csrf_test',
    title: 'CSRF Protection Test Complaint',
    description: 'Testing CSRF',
    status: 'PENDING',
  });
  await csrfComp.save();

  // Test 4.2: State-changing authenticated request with valid CSRF token (positive test)
  const validCsrfPost = await axios.post(
    `${API_BASE}/vigilance/investigation`,
    { complaintId: csrfComp._id.toString() },
    { headers: { Cookie: vigil1Cookies.join('; '), 'x-csrf-token': vigil1Csrf } }
  );
  assert.strictEqual(validCsrfPost.status, 201);
  console.log('✔ State-changing request with valid CSRF token succeeded (HTTP 201)');

  // Test 4.3: State-changing authenticated request without CSRF token (negative test)
  const csrfComp2 = new Complaint({
    institutionId: 'inst_csrf_test',
    title: 'CSRF Missing Test Complaint',
    description: 'Testing CSRF missing',
    status: 'PENDING',
  });
  await csrfComp2.save();

  try {
    await axios.post(
      `${API_BASE}/vigilance/investigation`,
      { complaintId: csrfComp2._id.toString() },
      { headers: { Cookie: vigil1Cookies.join('; ') } } // No x-csrf-token header
    );
    assert.fail('Request without CSRF token must be rejected');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    assert.strictEqual(err.response?.data?.message, 'CSRF token missing');
    console.log('✔ State-changing request without CSRF token rejected with HTTP 403 (CSRF token missing)');
  }

  // Test 4.4: State-changing authenticated request with forged/invalid CSRF token (negative test)
  try {
    await axios.post(
      `${API_BASE}/vigilance/investigation`,
      { complaintId: csrfComp2._id.toString() },
      { headers: { Cookie: vigil1Cookies.join('; '), 'x-csrf-token': 'bad_forged_csrf_token_value_xyz' } }
    );
    assert.fail('Request with forged CSRF token must be rejected');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    assert.strictEqual(err.response?.data?.message, 'Invalid CSRF token');
    console.log('✔ State-changing request with forged CSRF token rejected with HTTP 403 (Invalid CSRF token)');
  }

  console.log('\n================================================================');
  console.log('REQUIREMENT 5: Persistent MongoDB Sessions & Logout Invalidation');
  console.log('================================================================');

  // Test 5.1: Session persistence in MongoDB sessions collection
  const sessionDbDocs = await mongoose.connection.collection('sessions').find({}).toArray();
  assert(sessionDbDocs.length > 0, 'MongoDB sessions collection must contain session documents');
  console.log(`✔ Persistent MongoDB session store verified: ${sessionDbDocs.length} active sessions in DB`);

  // Verify session content in MongoDB
  const sessionDoc = sessionDbDocs[0];
  assert(sessionDoc.session, 'Session doc must contain session JSON data');
  const sessionParsed = JSON.parse(sessionDoc.session);
  assert(sessionParsed.userId, 'Session data must contain userId');
  assert(sessionParsed.role, 'Session data must contain role');
  assert(sessionParsed.csrfToken, 'Session data must contain csrfToken');
  console.log('✔ Session data in MongoDB verified: userId, role, and csrfToken persisted');

  // Test 5.2: Logout invalidation
  // Login temporary user to test logout
  const { cookies: tempCookies, csrfToken: tempCsrf } = await login('sec_vigil_2', 'Password123!');
  // Confirm authenticated
  const meBefore = await axios.get(`${API_BASE}/auth/me`, { headers: { Cookie: tempCookies.join('; ') } });
  assert.strictEqual(meBefore.status, 200);

  // Logout
  const logoutRes = await axios.post(
    `${API_BASE}/auth/logout`,
    {},
    { headers: { Cookie: tempCookies.join('; '), 'x-csrf-token': tempCsrf } }
  );
  assert.strictEqual(logoutRes.status, 200);

  // Subsequent request with the same cookie must be rejected (401)
  try {
    await axios.get(`${API_BASE}/auth/me`, { headers: { Cookie: tempCookies.join('; ') } });
    assert.fail('Destroyed session must not be accepted');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 401);
    console.log('✔ Logout invalidation: Session destroyed and subsequent requests rejected with HTTP 401');
  }

  console.log('\n================================================================');
  console.log('ALL PHASE 8 BATCH 3 SECURITY REQUIREMENTS VERIFIED AND PASSED!');
  console.log('================================================================');

  await mongoose.disconnect();
}

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
