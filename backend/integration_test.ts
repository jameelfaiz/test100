// integration_test.ts
import axios from 'axios';
import mongoose from 'mongoose';
import assert from 'assert';
import { User, Role } from './src/models/User';
import { Complaint } from './src/models/Complaint';
import { Investigation } from './src/models/Investigation';
import { AuditLog } from './src/models/AuditLog';

const API_BASE = 'http://localhost:5000/api';
const TEST_DB = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified_test';

interface AuthSession {
  cookies: string[];
  csrfToken: string;
}

function authHeaders(session: AuthSession) {
  return {
    Cookie: session.cookies.join('; '),
    'x-csrf-token': session.csrfToken,
    'x-test-skip-limit': 'true',
  };
}

async function seedUser(userId: string, password: string, role: Role) {
  const existing = await User.findOne({ userId }).exec();
  if (existing) return existing;
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash(password, 10);
  const user = new User({ userId, passwordHash: hash, role, accountStatus: 'ACTIVE' });
  await user.save();
  return user;
}

async function login(userId: string, password: string): Promise<AuthSession> {
  const res = await axios.post(
    `${API_BASE}/auth/login`,
    { userId, password },
    { withCredentials: true, headers: { 'x-test-skip-limit': 'true' } }
  );
  const cookies = res.headers['set-cookie'];
  if (!cookies) throw new Error(`Login failed for ${userId}: no cookies`);
  const csrfToken = res.data.csrfToken;
  return { cookies, csrfToken };
}

async function createComplaint(institutionId: string, title: string, applicationId?: string) {
  const complaint = new Complaint({
    institutionId,
    applicationId,
    title,
    description: `Complaint for ${institutionId} - ${title}`,
    status: 'PENDING',
  });
  await complaint.save();
  return complaint._id.toString();
}

async function runTests() {
  console.log('Connecting to Test DB:', TEST_DB);
  await mongoose.connect(TEST_DB);

  // Clean test database collections
  await Complaint.deleteMany({});
  await Investigation.deleteMany({});
  await AuditLog.deleteMany({});

  // Seed roles
  const fdUser = await seedUser('fd_emp', 'Password123!', 'AICTE_FD_EMPLOYEE');
  const vigilEmp1 = await seedUser('vigil_emp1', 'Password123!', 'VIGILANCE_EMPLOYEE');
  const vigilEmp2 = await seedUser('vigil_emp2', 'Password123!', 'VIGILANCE_EMPLOYEE');
  const vigilSup = await seedUser('vigil_sup', 'Password123!', 'VIGILANCE_SUPERVISOR');
  const pgrcEmp = await seedUser('pgrc_emp', 'Password123!', 'PGRC_EMPLOYEE');

  const fdSession = await login('fd_emp', 'Password123!');
  const vigil1Session = await login('vigil_emp1', 'Password123!');
  const vigil2Session = await login('vigil_emp2', 'Password123!');
  const vigilSupSession = await login('vigil_sup', 'Password123!');
  const pgrcSession = await login('pgrc_emp', 'Password123!');

  console.log('\n==================================================');
  console.log('TEST 1: Investigation outcomes (PROVEN, UNSUBSTANTIATED, INCONCLUSIVE)');
  console.log('==================================================');

  // Outcome 1: PROVEN
  const compId1 = await createComplaint('inst_A', 'Allegation A (Proven)');
  const invRes1 = await axios.post(`${API_BASE}/vigilance/investigation`, { complaintId: compId1 }, { headers: authHeaders(vigil1Session) });
  const invId1 = invRes1.data.investigation.investigationId;
  await axios.post(`${API_BASE}/vigilance/investigation/${invId1}/assign`, { investigatorUserId: 'vigil_emp1' }, { headers: authHeaders(vigil1Session) });
  await axios.post(`${API_BASE}/vigilance/investigation/${invId1}/findings`, { findings: 'Solid evidence found', status: 'COMPLETED' }, { headers: authHeaders(vigil1Session) });
  await axios.post(`${API_BASE}/vigilance/investigation/${invId1}/approve`, { decision: 'PROVEN' }, { headers: authHeaders(vigilSupSession) });

  const dbInv1 = await Investigation.findOne({ investigationId: invId1 });
  const dbComp1 = await Complaint.findById(compId1);
  assert.strictEqual(dbInv1?.status, 'COMPLETED');
  assert.strictEqual(dbInv1?.finalOutcome, 'PROVEN');
  assert.strictEqual(dbComp1?.finalOutcome, 'PROVEN');
  console.log('✔ Outcome PROVEN verified in MongoDB Investigation & Complaint');

  // Outcome 2: UNSUBSTANTIATED
  const compId2 = await createComplaint('inst_A', 'Allegation B (Unsubstantiated)');
  const invRes2 = await axios.post(`${API_BASE}/vigilance/investigation`, { complaintId: compId2 }, { headers: authHeaders(vigil1Session) });
  const invId2 = invRes2.data.investigation.investigationId;
  await axios.post(`${API_BASE}/vigilance/investigation/${invId2}/assign`, { investigatorUserId: 'vigil_emp1' }, { headers: authHeaders(vigil1Session) });
  await axios.post(`${API_BASE}/vigilance/investigation/${invId2}/findings`, { findings: 'No corroborating evidence', status: 'COMPLETED' }, { headers: authHeaders(vigil1Session) });
  await axios.post(`${API_BASE}/vigilance/investigation/${invId2}/approve`, { decision: 'UNSUBSTANTIATED' }, { headers: authHeaders(vigilSupSession) });

  const dbInv2 = await Investigation.findOne({ investigationId: invId2 });
  const dbComp2 = await Complaint.findById(compId2);
  assert.strictEqual(dbInv2?.status, 'COMPLETED');
  assert.strictEqual(dbInv2?.finalOutcome, 'UNSUBSTANTIATED');
  assert.strictEqual(dbComp2?.finalOutcome, 'UNSUBSTANTIATED');
  assert.strictEqual(dbComp2?.status, 'RESOLVED');
  console.log('✔ Outcome UNSUBSTANTIATED verified in MongoDB Investigation & Complaint');

  // Outcome 3: INCONCLUSIVE
  const compId3 = await createComplaint('inst_A', 'Allegation C (Inconclusive)');
  const invRes3 = await axios.post(`${API_BASE}/vigilance/investigation`, { complaintId: compId3 }, { headers: authHeaders(vigil1Session) });
  const invId3 = invRes3.data.investigation.investigationId;
  await axios.post(`${API_BASE}/vigilance/investigation/${invId3}/assign`, { investigatorUserId: 'vigil_emp1' }, { headers: authHeaders(vigil1Session) });
  await axios.post(`${API_BASE}/vigilance/investigation/${invId3}/findings`, { findings: 'Conflicting testimony', status: 'COMPLETED' }, { headers: authHeaders(vigil1Session) });
  await axios.post(`${API_BASE}/vigilance/investigation/${invId3}/approve`, { decision: 'INCONCLUSIVE' }, { headers: authHeaders(vigilSupSession) });

  const dbInv3 = await Investigation.findOne({ investigationId: invId3 });
  const dbComp3 = await Complaint.findById(compId3);
  assert.strictEqual(dbInv3?.status, 'COMPLETED');
  assert.strictEqual(dbInv3?.finalOutcome, 'INCONCLUSIVE');
  assert.strictEqual(dbComp3?.finalOutcome, 'INCONCLUSIVE');
  assert.strictEqual(dbComp3?.status, 'RESOLVED');
  console.log('✔ Outcome INCONCLUSIVE verified in MongoDB Investigation & Complaint');

  console.log('\n==================================================');
  console.log('TEST 2: Persistent audit logging');
  console.log('==================================================');

  const auditLogs = await AuditLog.find({}).lean();
  console.log(`Total AuditLog entries in DB: ${auditLogs.length}`);

  const actions = auditLogs.map(l => l.action);
  assert(actions.includes('create_investigation'), 'Missing create_investigation audit log');
  assert(actions.includes('assign_investigator'), 'Missing assign_investigator audit log');
  assert(actions.includes('submit_findings'), 'Missing submit_findings audit log');
  assert(actions.includes('supervisor_approval'), 'Missing supervisor_approval audit log');

  for (const log of auditLogs) {
    assert(log.employeeId, 'AuditLog missing employeeId');
    assert(log.role, 'AuditLog missing role');
    assert(log.action, 'AuditLog missing action');
    assert(log.timestamp, 'AuditLog missing timestamp');
  }

  // Also verify GET /api/audit/logs endpoint
  const auditRes = await axios.get(`${API_BASE}/audit/logs`, { headers: authHeaders(vigilSupSession) });
  assert.strictEqual(auditRes.status, 200);
  assert(auditRes.data.logs.length >= 4, 'Audit endpoint returned insufficient logs');
  console.log(`✔ Audit logs verified via DB & GET /api/audit/logs: ${auditRes.data.logs.length} entries`);

  console.log('\n==================================================');
  console.log('TEST 3: PGRC escalation integration & duplicate protection');
  console.log('==================================================');

  const pgrcComplaintRes = await axios.post(
    `${API_BASE}/pgrc/complaint`,
    { institutionId: 'inst_pgrc', title: 'PGRC Escalation Test', description: 'Testing PGRC Escalation' },
    { headers: authHeaders(pgrcSession) }
  );
  const pgrcCompId = pgrcComplaintRes.data.complaintId;

  // Escalate once
  const escRes = await axios.post(`${API_BASE}/pgrc/complaint/${pgrcCompId}/escalate`, {}, { headers: authHeaders(pgrcSession) });
  assert.strictEqual(escRes.status, 201);
  const pgrcInvCount = await Investigation.countDocuments({ complaintId: pgrcCompId });
  assert.strictEqual(pgrcInvCount, 1, 'Exactly one investigation should exist after first escalation');
  console.log('✔ First PGRC escalation succeeded, exactly 1 investigation created');

  // Attempt duplicate escalation sequentially
  try {
    await axios.post(`${API_BASE}/pgrc/complaint/${pgrcCompId}/escalate`, {}, { headers: authHeaders(pgrcSession) });
    assert.fail('Duplicate escalation should have been rejected');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 400);
    console.log('✔ Sequential duplicate escalation rejected with HTTP 400');
  }

  // Test concurrent escalations on a new complaint
  const pgrcCompIdConcurrent = (await axios.post(
    `${API_BASE}/pgrc/complaint`,
    { institutionId: 'inst_pgrc', title: 'Concurrent Test', description: 'Testing concurrency' },
    { headers: authHeaders(pgrcSession) }
  )).data.complaintId;

  const results = await Promise.allSettled([
    axios.post(`${API_BASE}/pgrc/complaint/${pgrcCompIdConcurrent}/escalate`, {}, { headers: authHeaders(pgrcSession) }),
    axios.post(`${API_BASE}/pgrc/complaint/${pgrcCompIdConcurrent}/escalate`, {}, { headers: authHeaders(pgrcSession) }),
    axios.post(`${API_BASE}/pgrc/complaint/${pgrcCompIdConcurrent}/escalate`, {}, { headers: authHeaders(pgrcSession) }),
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');
  assert.strictEqual(fulfilled.length, 1, 'Only one concurrent escalation should succeed');
  assert.strictEqual(rejected.length, 2, 'Two concurrent escalations should be rejected');

  const concurrentInvCount = await Investigation.countDocuments({ complaintId: pgrcCompIdConcurrent });
  assert.strictEqual(concurrentInvCount, 1, 'Database should contain exactly one investigation after concurrent attempts');
  console.log('✔ Concurrent escalation attempts handled safely: 1 success, 2 rejected, exactly 1 DB record');

  console.log('\n==================================================');
  console.log('TEST 4: FD complaint-clearance calculations');
  console.log('==================================================');

  // Create complaints for inst_clearance_1:
  // - app1: 1 PROVEN, 1 UNSUBSTANTIATED, 1 PENDING
  // - app2: 1 INCONCLUSIVE
  const c1 = await createComplaint('inst_clearance_1', 'C1', 'app_1');
  const c2 = await createComplaint('inst_clearance_1', 'C2', 'app_1');
  const c3 = await createComplaint('inst_clearance_1', 'C3', 'app_1');
  const c4 = await createComplaint('inst_clearance_1', 'C4', 'app_2');

  // Mark outcomes
  await Complaint.findByIdAndUpdate(c1, { status: 'PROVEN', finalOutcome: 'PROVEN' });
  await Complaint.findByIdAndUpdate(c2, { status: 'RESOLVED', finalOutcome: 'UNSUBSTANTIATED' });
  await Complaint.findByIdAndUpdate(c3, { status: 'PENDING' });
  await Complaint.findByIdAndUpdate(c4, { status: 'RESOLVED', finalOutcome: 'INCONCLUSIVE' });

  // Create complaint for inst_clearance_2:
  const cOther = await createComplaint('inst_clearance_2', 'Other Inst C', 'app_1');
  await Complaint.findByIdAndUpdate(cOther, { status: 'PROVEN', finalOutcome: 'PROVEN' });

  // Query clearance summary for inst_clearance_1 scoped to app_1
  const app1Summary = await axios.get(
    `${API_BASE}/fd/complaint-summary?institutionId=inst_clearance_1&applicationId=app_1`,
    { headers: authHeaders(fdSession) }
  );
  assert.strictEqual(app1Summary.data.total, 3);
  assert.strictEqual(app1Summary.data.pending, 1);
  assert.strictEqual(app1Summary.data.proven, 1); // Only C1, not C2 or C3
  assert.strictEqual(app1Summary.data.unsubstantiated, 1);
  assert.strictEqual(app1Summary.data.inconclusive, 0);
  assert.strictEqual(app1Summary.data.findings, undefined, 'Confidential findings must not be exposed');
  assert.strictEqual(app1Summary.data.evidencePath, undefined, 'Confidential evidence must not be exposed');
  console.log('✔ FD complaint summary scoped to institution + application correctly calculated');

  // Query clearance summary for inst_clearance_1 across all applications
  const allSummary = await axios.get(
    `${API_BASE}/fd/complaint-summary?institutionId=inst_clearance_1`,
    { headers: authHeaders(fdSession) }
  );
  assert.strictEqual(allSummary.data.total, 4);
  assert.strictEqual(allSummary.data.proven, 1);
  assert.strictEqual(allSummary.data.unsubstantiated, 1);
  assert.strictEqual(allSummary.data.inconclusive, 1);
  console.log('✔ FD complaint summary scoped to institution across all applications correctly calculated');

  // Verify unauthorized roles cannot access FD summary
  try {
    await axios.get(
      `${API_BASE}/fd/complaint-summary?institutionId=inst_clearance_1`,
      { headers: authHeaders(pgrcSession) }
    );
    assert.fail('PGRC employee should not have access to FD complaint summary');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    console.log('✔ Non-FD role rejected from FD complaint-summary with HTTP 403');
  }

  console.log('\n==================================================');
  console.log('TEST 5: Evidence security, permissions & path traversal');
  console.log('==================================================');

  // Create an investigation and assign to vigil_emp1
  const compEvidence = await createComplaint('inst_evid', 'Evidence Test');
  const invEvidRes = await axios.post(`${API_BASE}/vigilance/investigation`, { complaintId: compEvidence }, { headers: authHeaders(vigil1Session) });
  const invEvidId = invEvidRes.data.investigation.investigationId;
  await axios.post(`${API_BASE}/vigilance/investigation/${invEvidId}/assign`, { investigatorUserId: 'vigil_emp1' }, { headers: authHeaders(vigil1Session) });

  // Assigned investigator (vigil_emp1) adds valid evidence
  const addEvidRes = await axios.post(
    `${API_BASE}/vigilance/investigation/${invEvidId}/evidence`,
    { evidencePath: 'uploads/evidence_file_123.pdf' },
    { headers: authHeaders(vigil1Session) }
  );
  assert.strictEqual(addEvidRes.status, 200);
  console.log('✔ Assigned investigator successfully added evidence');

  // Unassigned vigilance employee (vigil_emp2) attempts to submit evidence -> rejected (403)
  try {
    await axios.post(
      `${API_BASE}/vigilance/investigation/${invEvidId}/evidence`,
      { evidencePath: 'uploads/unauthorized_attempt.pdf' },
      { headers: authHeaders(vigil2Session) }
    );
    assert.fail('Unassigned investigator should be rejected');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    console.log('✔ Unassigned investigator rejected with HTTP 403 from submitting evidence');
  }

  // Path traversal prevention: ../ or / or \ or drive letters
  const pathTraversalPayloads = [
    '../secret/passwords.txt',
    '/etc/passwd',
    '..\\windows\\win.ini',
    'C:\\sensitive\\data.txt',
  ];
  for (const ptPath of pathTraversalPayloads) {
    try {
      await axios.post(
        `${API_BASE}/vigilance/investigation/${invEvidId}/evidence`,
        { evidencePath: ptPath },
        { headers: authHeaders(vigil1Session) }
      );
      assert.fail(`Path traversal payload should have failed: ${ptPath}`);
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400);
    }
  }
  console.log('✔ Path traversal attempts rejected with HTTP 400');

  // Evidence retrieval:
  // 1) Assigned investigator can retrieve
  const getEvidAssigned = await axios.get(
    `${API_BASE}/vigilance/investigation/${invEvidId}/evidence`,
    { headers: authHeaders(vigil1Session) }
  );
  assert.strictEqual(getEvidAssigned.data.evidencePath, 'uploads/evidence_file_123.pdf');
  console.log('✔ Assigned investigator successfully retrieved evidence');

  // 2) Supervisor can retrieve
  const getEvidSup = await axios.get(
    `${API_BASE}/vigilance/investigation/${invEvidId}/evidence`,
    { headers: authHeaders(vigilSupSession) }
  );
  assert.strictEqual(getEvidSup.data.evidencePath, 'uploads/evidence_file_123.pdf');
  console.log('✔ Vigilance supervisor successfully retrieved evidence');

  // 3) Unassigned investigator cannot retrieve (403)
  try {
    await axios.get(
      `${API_BASE}/vigilance/investigation/${invEvidId}/evidence`,
      { headers: authHeaders(vigil2Session) }
    );
    assert.fail('Unassigned investigator should not view evidence');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    console.log('✔ Unassigned investigator rejected with HTTP 403 from viewing evidence');
  }

  // 4) Unauthorized role (FD employee) cannot retrieve (403)
  try {
    await axios.get(
      `${API_BASE}/vigilance/investigation/${invEvidId}/evidence`,
      { headers: authHeaders(fdSession) }
    );
    assert.fail('FD employee should not view vigilance evidence');
  } catch (err: any) {
    assert.strictEqual(err.response?.status, 403);
    console.log('✔ FD employee rejected with HTTP 403 from viewing evidence');
  }

  console.log('\n==================================================');
  console.log('ALL PHASE 8 BATCH 2 & BATCH 3 INTEGRATION TESTS PASSED!');
  console.log('==================================================');

  await mongoose.disconnect();
}

runTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
