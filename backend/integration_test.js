// integration_test.ts
import axios from 'axios';
import mongoose from 'mongoose';
import { User } from './src/models/User';
import { Complaint } from './src/models/Complaint';
const API_BASE = 'http://localhost:5000/api';
async function seedUser(userId, password, role) {
    const existing = await User.findOne({ userId }).exec();
    if (existing)
        return existing;
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ userId, passwordHash: hash, role, accountStatus: 'ACTIVE' });
    await user.save();
    return user;
}
async function login(userId, password) {
    const res = await axios.post(`${API_BASE}/auth/login`, { userId, password }, { withCredentials: true });
    return res.headers['set-cookie'];
}
async function createDummyComplaint() {
    const complaint = new Complaint({
        institutionId: 'dummyInst',
        title: 'Test Complaint',
        description: 'Dummy complaint for integration test',
        status: 'PENDING',
    });
    await complaint.save();
    return complaint._id.toString();
}
async function main() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified');
    // Seed users
    await seedUser('fd_emp', 'Password123!', 'AICTE_FD_EMPLOYEE');
    await seedUser('vigil_emp', 'Password123!', 'VIGILANCE_EMPLOYEE');
    await seedUser('vigil_sup', 'Password123!', 'VIGILANCE_SUPERVISOR');
    await seedUser('pgrc_emp', 'Password123!', 'PGRC_EMPLOYEE');
    // Create a dummy complaint
    const complaintId = await createDummyComplaint();
    // Login as vigilance employee (investigator)
    const vigilEmpCookies = await login('vigil_emp', 'Password123!');
    // Create investigation (complaintId only)
    const invRes = await axios.post(`${API_BASE}/vigilance/investigation`, { complaintId }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    const investigationId = invRes.data.investigation.investigationId;
    // Assign investigator (using same vigilance employee)
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId}/assign`, { investigatorUserId: 'vigil_emp' }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    // Verify FD employee cannot submit findings
    let fdCookies = await login('fd_emp', 'Password123!');
    try {
        await axios.post(`${API_BASE}/vigilance/investigation/${investigationId}/findings`, { findings: 'FD attempt', status: 'COMPLETED' }, { headers: { Cookie: fdCookies.join('; ') } });
        console.log('FD employee incorrectly allowed to submit findings');
    }
    catch (e) {
        console.log('FD employee correctly forbidden from submitting findings');
    }
    // Submit findings as assigned vigilance employee
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId}/findings`, { findings: 'Valid findings', status: 'COMPLETED' }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    // Supervisor approves with PROVEN outcome
    const supCookies = await login('vigil_sup', 'Password123!');
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId}/approve`, { decision: 'PROVEN' }, { headers: { Cookie: supCookies.join('; ') } });
    // Additional outcome tests: UNSUBSTANTIATED and INCONCLUSIVE
    // Create second investigation for UNSUBSTANTIATED outcome
    const invRes2 = await axios.post(`${API_BASE}/vigilance/investigation`, { complaintId }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    const investigationId2 = invRes2.data.investigation.investigationId;
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId2}/assign`, { investigatorUserId: 'vigil_emp' }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId2}/findings`, { findings: 'Findings for unsub', status: 'COMPLETED' }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId2}/approve`, { decision: 'UNSUBSTANTIATED' }, { headers: { Cookie: supCookies.join('; ') } });
    // Create third investigation for INCONCLUSIVE outcome
    const invRes3 = await axios.post(`${API_BASE}/vigilance/investigation`, { complaintId }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    const investigationId3 = invRes3.data.investigation.investigationId;
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId3}/assign`, { investigatorUserId: 'vigil_emp' }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId3}/findings`, { findings: 'Findings for inconclusive', status: 'COMPLETED' }, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    await axios.post(`${API_BASE}/vigilance/investigation/${investigationId3}/approve`, { decision: 'INCONCLUSIVE' }, { headers: { Cookie: supCookies.join('; ') } });
    // Verify audit logs for actions
    const auditRes = await axios.get(`${API_BASE}/audit/logs`, { headers: { Cookie: supCookies.join('; ') } });
    console.log('Audit log entries count:', auditRes.data.logs.length);
    // PGRC escalation workflow
    const pgrcCookies = await login('pgrc_emp', 'Password123!');
    const pgrcComplaintRes = await axios.post(`${API_BASE}/pgrc/complaint`, { institutionId: 'inst2', title: 'PGRC complaint', description: 'Testing escalation' }, { headers: { Cookie: pgrcCookies.join('; ') } });
    const pgrcComplaintId = pgrcComplaintRes.data.complaintId;
    await axios.post(`${API_BASE}/pgrc/complaint/${pgrcComplaintId}/escalate`, {}, { headers: { Cookie: pgrcCookies.join('; ') } });
    const vigComplaintsRes = await axios.get(`${API_BASE}/vigilance/complaints`, { headers: { Cookie: vigilEmpCookies.join('; ') } });
    console.log('Investigations for escalated PGRC complaint:', vigComplaintsRes.data.complaints.filter((c) => c.originalComplaintId === pgrcComplaintId).length);
    // FD complaint-clearance summary validation
    fdCookies = await login('fd_emp', 'Password123!');
    const clearanceRes = await axios.get(`${API_BASE}/fd/complaint-summary?institutionId=dummyInst&applicationId=app1`, { headers: { Cookie: fdCookies.join('; ') } });
    console.log('Complaint clearance summary:', clearanceRes.data);
    console.log('All verification steps completed');
    await mongoose.disconnect();
}
main().catch(err => console.error(err));
