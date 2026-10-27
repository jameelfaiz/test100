import mongoose from 'mongoose';
import axios from 'axios';
import bcrypt from 'bcrypt';
import { User } from './src/models/User';
import { Institution } from './src/models/Institution';

const BASE = 'http://localhost:5000/api';
const MONGO_URI = 'mongodb://127.0.0.1:27017/aicte_unified';

const ts = Date.now();
const testUsername = `testinst${ts}`;
const testPassword = 'TestPass@123';

type R = { ok: boolean; status: number; data: any };

class Client {
  cookies: string[] = [];
  csrf = '';

  async getCsrf(): Promise<void> {
    const r = await axios.get(`${BASE}/auth/csrf-token`, {
      withCredentials: true,
      headers: this.cookies.length ? { Cookie: this.cookies.join('; ') } : {},
    }).catch((e: any) => e.response);
    if (r?.headers['set-cookie']) this.cookies.push(...r.headers['set-cookie']);
    this.csrf = r?.data?.csrfToken || '';
  }

  async post(path: string, body: any): Promise<R> {
    const r = await axios.post(`${BASE}${path}`, body, {
      withCredentials: true,
      headers: { 'X-XSRF-TOKEN': this.csrf, Cookie: this.cookies.join('; ') },
      validateStatus: () => true,
    });
    if (r.headers['set-cookie']) this.cookies.push(...r.headers['set-cookie']);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, data: r.data };
  }

  async get(path: string): Promise<R> {
    const r = await axios.get(`${BASE}${path}`, {
      withCredentials: true,
      headers: { Cookie: this.cookies.join('; ') },
      validateStatus: () => true,
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, data: r.data };
  }
}

type Result = { id: number; desc: string; pass: boolean; detail: string };
const results: Result[] = [];

function record(id: number, desc: string, pass: boolean, detail: string) {
  results.push({ id, desc, pass, detail });
  console.log(`[SCENARIO ${String(id).padStart(2,'0')}] ${pass ? 'PASS' : 'FAIL'} - ${desc} (${detail})`);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected');

  // Cleanup any previous test users
  await User.deleteMany({ $or: [{ userId: testUsername }, { username: testUsername }] });

  const client = new Client();
  await client.getCsrf();

  // 1. Register new institution without email verification
  const reg1 = await client.post('/institution/register', {
    username: testUsername,
    name: 'Test University ' + ts,
    institutionType: 'Technical',
    email: `${testUsername}@test.ac.in`,
    contactNumber: '9876543210',
    state: 'Tamil Nadu',
    district: 'Chennai',
    address: '123 Test Street, Chennai',
    principalName: 'Dr. Test Principal',
    authorizedContactPerson: 'Contact Person',
    password: testPassword,
    confirmPassword: testPassword,
  });
  record(1, 'Register new institution without email verification', reg1.ok, `Status: ${reg1.status}, CollegeID: ${reg1.data?.collegeId}`);

  const assignedCollegeId = reg1.data?.collegeId;

  // 2. Duplicate username is rejected
  const reg2 = await client.post('/institution/register', {
    username: testUsername,
    name: 'Another Institution',
    institutionType: 'Technical',
    email: `diff${testUsername}@test.ac.in`,
    contactNumber: '9876543210',
    state: 'Tamil Nadu',
    district: 'Chennai',
    address: '456 Another Street',
    principalName: 'Principal 2',
    authorizedContactPerson: 'Contact 2',
    password: testPassword,
    confirmPassword: testPassword,
  });
  record(2, 'Duplicate username is rejected with 409', !reg2.ok && reg2.status === 409, `Status: ${reg2.status}, Msg: ${reg2.data?.message}`);

  // 3. Records in MongoDB
  const dbUser = await User.findOne({ userId: testUsername });
  const dbInst = dbUser ? await Institution.findById(dbUser.institutionId) : null;
  record(3, 'Institution and user stored in MongoDB correctly', Boolean(dbUser && dbInst && dbInst.collegeId === assignedCollegeId), `user: ${dbUser?.userId}, collegeId: ${dbInst?.collegeId}`);

  // 4. accountStatus is ACTIVE immediately
  record(4, 'User accountStatus is ACTIVE immediately (no email verification)', dbUser?.accountStatus === 'ACTIVE', `accountStatus: ${dbUser?.accountStatus}`);

  // 5. Institution is APPROVED immediately
  record(5, 'Institution registrationStatus is APPROVED immediately', (dbInst as any)?.registrationStatus === 'APPROVED', `registrationStatus: ${(dbInst as any)?.registrationStatus}`);

  // 6. Login with username succeeds
  const loginClient = new Client();
  await loginClient.getCsrf();
  const loginRes = await loginClient.post('/auth/login', { userId: testUsername, password: testPassword });
  record(6, 'Login with username succeeds without email verification', loginRes.ok, `Status: ${loginRes.status}, role: ${loginRes.data?.role}`);

  // 7. First-time user directed to complete-profile
  record(7, 'First-time login returns profileCompleted=false (complete-profile redirect)', loginRes.ok && loginRes.data?.profileCompleted === false, `profileCompleted: ${loginRes.data?.profileCompleted}`);

  // 8. Old PENDING_VERIFICATION account gets auto-activated on login
  const oldUsername = `oldinst${ts}`;
  const oldHash = await bcrypt.hash(testPassword, 12);
  await User.create({ userId: oldUsername, passwordHash: oldHash, role: 'INSTITUTION', accountStatus: 'PENDING_VERIFICATION' } as any);
  const oldClient = new Client();
  await oldClient.getCsrf();
  const oldLogin = await oldClient.post('/auth/login', { userId: oldUsername, password: testPassword });
  record(8, 'PENDING_VERIFICATION account auto-activated and can log in', oldLogin.ok, `Status: ${oldLogin.status}, role: ${oldLogin.data?.role}`);
  await User.deleteOne({ userId: oldUsername });

  // 9. No verification-related error in successful login response
  const noVerifMsg = !loginRes.data?.message?.toLowerCase().includes('verif') && !loginRes.data?.message?.toLowerCase().includes('pending');
  record(9, 'No email verification warning in login response', noVerifMsg, `message: "${loginRes.data?.message || '(none)'}"`);

  // 10. FD employee login unchanged
  const empClient = new Client();
  await empClient.getCsrf();
  const empLogin = await empClient.post('/auth/login', { userId: 'fd_emp', password: '$mvV$7eBm277xm6GBN' });
  record(10, 'FD employee login still works after changes', empLogin.ok && empLogin.data?.role === 'AICTE_FD_EMPLOYEE', `Status: ${empLogin.status}, role: ${empLogin.data?.role}`);

  // Cleanup
  if (dbUser) await User.deleteOne({ _id: dbUser._id });
  if (dbInst) await Institution.deleteOne({ _id: dbInst._id });

  await mongoose.disconnect();

  const passed = results.filter(r => r.pass).length;
  console.log('\n================================================================================');
  console.log(`TOTAL PASSED: ${passed} / ${results.length}`);
  console.log('================================================================================');
  if (passed === results.length) {
    console.log('ALL 10 EMAIL-VERIFICATION-REMOVAL TESTS PASSED!');
    process.exit(0);
  } else {
    console.error(`FAILED: ${results.length - passed} scenario(s) failed.`);
    process.exit(1);
  }
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
