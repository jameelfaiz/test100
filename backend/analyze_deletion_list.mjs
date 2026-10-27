import mongoose from 'mongoose';

async function analyze() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const db = mongoose.connection.db;

  const users = await db.collection('users').find().toArray();
  const institutions = await db.collection('institutions').find().toArray();
  const applications = await db.collection('applications').find().toArray();
  const payments = await db.collection('payments').find().toArray();
  const complaints = await db.collection('complaints').find().toArray();
  const investigations = await db.collection('investigations').find().toArray();
  const releaseRequests = await db.collection('releaserequests').find().toArray();
  const documentverifications = await db.collection('documentverifications').find().toArray();
  const notifications = await db.collection('notifications').find().toArray();

  console.log('=== SYSTEM & EMPLOYEE ACCOUNTS (ALWAYS KEEP) ===');
  const employeeUsers = users.filter(u => ['AICTE_FD_EMPLOYEE', 'PGRC_EMPLOYEE', 'VIGILANCE_EMPLOYEE', 'VIGILANCE_SUPERVISOR'].includes(u.role));
  employeeUsers.forEach(u => console.log(`  [KEEP] User: ${u.userId} (${u.role})`));

  console.log('\n=== INSTITUTIONS ANALYSIS ===');
  const genuineInsts = [];
  const dummyInsts = [];

  for (const inst of institutions) {
    const isTest = 
      inst.collegeId.startsWith('TEST-') || 
      inst.name.includes('Delhi Institute of Technology') ||
      inst.name.includes('Apex Engineering') ||
      inst.name.includes('Zenith Institute') ||
      inst.name.includes('Alpha Engineering') ||
      inst.name.includes('Beta Institute') ||
      inst.name.includes('Gamma Polytechnic') ||
      inst.name.includes('Delta College') ||
      inst.name.includes('Epsilon Business') ||
      inst.name.includes('Foxtrot Institute') ||
      inst.name.includes('Galaxy Technical') ||
      inst.name.includes('Horizon College') ||
      inst.name.includes('Imperial Institute') ||
      inst.name.includes('Jupiter Institute') ||
      inst.name.includes('Krypton College') ||
      inst.name.includes('Legacy Institute') ||
      inst.name.includes('Omega Institute') ||
      inst.name.includes('Logout Test Institute') ||
      inst.collegeId === 'CLG-2026-000003' ||
      inst.collegeId === 'CLG-2026-000004' ||
      inst.collegeId === 'CLG-2026-000005' ||
      inst.collegeId === 'CLG-2026-000006';

    if (isTest) {
      dummyInsts.push(inst);
    } else {
      genuineInsts.push(inst);
    }
  }

  console.log(`Genuine Institutions (${genuineInsts.length}):`);
  genuineInsts.forEach(i => console.log(`  [PRESERVE] collegeId=${i.collegeId}, name="${i.name}", status=${i.registrationStatus}`));

  console.log(`Dummy / Test Institutions to delete (${dummyInsts.length}):`);
  dummyInsts.forEach(i => console.log(`  [DELETE] collegeId=${i.collegeId}, name="${i.name}"`));

  const dummyCollegeIds = new Set(dummyInsts.map(i => i.collegeId));

  console.log('\n=== APPLICATIONS ANALYSIS ===');
  const keepApps = [];
  const deleteApps = [];
  for (const a of applications) {
    if (dummyCollegeIds.has(a.collegeId) || a.applicationId?.startsWith('APP-TEST') || a.applicationId?.startsWith('APP-DEF')) {
      deleteApps.push(a);
    } else {
      keepApps.push(a);
    }
  }
  console.log(`Genuine Applications (${keepApps.length}):`);
  keepApps.forEach(a => console.log(`  [PRESERVE] appId=${a.applicationId}, collegeId=${a.collegeId}, title="${a.title}"`));
  console.log(`Dummy Applications to delete (${deleteApps.length}):`);
  deleteApps.forEach(a => console.log(`  [DELETE] appId=${a.applicationId}, collegeId=${a.collegeId}, title="${a.title}"`));

  console.log('\n=== PAYMENTS (FDRs) ANALYSIS ===');
  const keepPayments = [];
  const deletePayments = [];
  for (const p of payments) {
    if (dummyCollegeIds.has(p.collegeId) || p.referenceNumber?.includes('107063') || p.referenceNumber?.includes('037726')) {
      deletePayments.push(p);
    } else {
      keepPayments.push(p);
    }
  }
  console.log(`Genuine / Preserved Payments (${keepPayments.length}):`);
  keepPayments.forEach(p => console.log(`  [PRESERVE] paymentId=${p.paymentId}, collegeId=${p.collegeId}, ref=${p.referenceNumber}, amount=${p.amount}`));
  console.log(`Dummy Payments to delete (${deletePayments.length}):`);
  deletePayments.forEach(p => console.log(`  [DELETE] paymentId=${p.paymentId}, collegeId=${p.collegeId}, ref=${p.referenceNumber}, amount=${p.amount}`));

  console.log('\n=== RELEASE REQUESTS ANALYSIS ===');
  const keepRRs = [];
  const deleteRRs = [];
  for (const r of releaseRequests) {
    if (dummyCollegeIds.has(r.collegeId) || r.releaseRequestId?.startsWith('REL-')) {
      // Check if genuine college
      if (genuineInsts.some(g => g.collegeId === r.collegeId)) {
        keepRRs.push(r);
      } else {
        deleteRRs.push(r);
      }
    } else {
      keepRRs.push(r);
    }
  }
  console.log(`Release Requests: Preserve ${keepRRs.length}, Delete ${deleteRRs.length}`);

  console.log('\n=== COMPLAINTS & INVESTIGATIONS ANALYSIS ===');
  const keepComplaints = [];
  const deleteComplaints = [];
  for (const c of complaints) {
    if (dummyCollegeIds.has(c.collegeId) || c.collegeId === 'FAKE-CLG') {
      deleteComplaints.push(c);
    } else {
      keepComplaints.push(c);
    }
  }
  console.log(`Complaints: Preserve ${keepComplaints.length}, Delete ${deleteComplaints.length}`);

  await mongoose.disconnect();
}

analyze().catch(console.error);
