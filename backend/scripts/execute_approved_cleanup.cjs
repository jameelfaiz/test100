// backend/scripts/execute_approved_cleanup.cjs
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'aicte_unified';

const TARGETS_TO_DELETE = [
  // 1 & 2: Institutions
  { collection: 'institutions', _id: '6ade85654eaf15daf9ebabe9', desc: 'Delhi Institute of Technology 9805 (CLG-2026-000005)' },
  { collection: 'institutions', _id: '6ade85aa1756c044d6328997', desc: 'Delhi Institute of Technology 7655 (CLG-2026-000006)' },

  // 3 & 4: Payments / FDRs
  { collection: 'payments', _id: '6ade85654eaf15daf9ebabec', desc: 'FDR-1792968037730-59 (Delhi 9805)' },
  { collection: 'payments', _id: '6ade85ab1756c044d632899a', desc: 'FDR-1792968107069-397 (Delhi 7655)' },

  // 5 & 6: Complaints
  { collection: 'complaints', _id: '6ade85654eaf15daf9ebabed', desc: 'Dummy complaint (Delhi 9805)' },
  { collection: 'complaints', _id: '6ade85ab1756c044d632899b', desc: 'Dummy complaint (Delhi 7655)' },

  // 7 & 8: Complaint Letters
  { collection: 'complaintletters', _id: '6adf57279183ff477ff7fe4a', desc: 'Test outcome letter 1' },
  { collection: 'complaintletters', _id: '6adf57409183ff477ff7fe4b', desc: 'Test outcome letter 2' },

  // 9 & 10: Institution Users
  { collection: 'users', _id: '6ade85654eaf15daf9ebabea', desc: 'Institution user CLG-2026-000005' },
  { collection: 'users', _id: '6ade85aa1756c044d6328998', desc: 'Institution user CLG-2026-000006' },
];

async function executeCleanup() {
  console.log('================================================================');
  console.log('APPROVED SEQUENTIAL ATOMIC CLEANUP — 10 EXACT DUMMY RECORDS');
  console.log('================================================================\n');

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  let totalDeleted = 0;
  const deletedRecordsLog = [];

  try {
    for (const item of TARGETS_TO_DELETE) {
      const col = db.collection(item.collection);
      const filter = { _id: new ObjectId(item._id) };

      // Verify record exists before deletion
      const existing = await col.findOne(filter);
      if (!existing) {
        throw new Error(`Record not found prior to deletion: [${item.collection}] _id=${item._id}`);
      }

      // Execute exact single document atomic deletion
      const res = await col.deleteOne(filter);
      if (res.deletedCount !== 1) {
        throw new Error(`Failed to delete record: [${item.collection}] _id=${item._id} (deletedCount=${res.deletedCount})`);
      }

      totalDeleted += res.deletedCount;
      deletedRecordsLog.push({ collection: item.collection, _id: item._id, desc: item.desc });
      console.log(`  ✓ Successfully deleted [${item.collection}] _id=${item._id} (${item.desc})`);
    }

    if (totalDeleted !== 10) {
      throw new Error(`Expected exactly 10 deleted records, but deleted ${totalDeleted}`);
    }

    console.log(`\n✓ ALL ${totalDeleted} AUTHORIZED RECORDS SUCCESSFULLY DELETED.\n`);
  } catch (err) {
    console.error('Cleanup execution error:', err.message);
    await client.close();
    throw err;
  }

  // Post-deletion verification
  console.log('================================================================');
  console.log('POST-DELETION VERIFICATION');
  console.log('================================================================');

  // 1. Verify target records are absent
  for (const item of TARGETS_TO_DELETE) {
    const check = await db.collection(item.collection).findOne({ _id: new ObjectId(item._id) });
    if (check !== null) {
      throw new Error(`Post-verification failed: [${item.collection}] ${item._id} still exists in live DB!`);
    }
  }
  console.log('✓ Confirmed all 10 target records are ABSENT from live MongoDB.');

  // 2. Verify genuine institutions (5)
  const genuineInsts = await db.collection('institutions').find({}).toArray();
  console.log(`✓ Remaining Institutions (${genuineInsts.length}):`);
  for (const inst of genuineInsts) {
    console.log(`    - ${inst.name} (${inst.collegeId})`);
  }
  if (genuineInsts.length !== 5) {
    throw new Error(`Expected exactly 5 genuine institutions, found ${genuineInsts.length}`);
  }

  // 3. Verify genuine applications
  const genuineApps = await db.collection('applications').find({}).toArray();
  console.log(`✓ Remaining Applications (${genuineApps.length}):`);
  for (const a of genuineApps) {
    console.log(`    - ${a.applicationId} | ${a.collegeId} | Status: ${a.status}`);
  }
  if (genuineApps.length !== 2) {
    throw new Error(`Expected exactly 2 genuine applications, found ${genuineApps.length}`);
  }

  // 4. Verify genuine payments / FDRs
  const genuinePays = await db.collection('payments').find({}).toArray();
  console.log(`✓ Remaining FDR Deposits (${genuinePays.length}):`);
  for (const p of genuinePays) {
    console.log(`    - ${p.paymentId} | ${p.collegeId} | ₹${p.amount} | Status: ${p.status}`);
  }
  if (genuinePays.length !== 1 || genuinePays[0].amount !== 5000000) {
    throw new Error(`Expected exactly 1 genuine ₹50,00,000 FDR, found ${genuinePays.length}`);
  }

  // 5. Verify genuine complaints
  const genuineComplaints = await db.collection('complaints').find({}).toArray();
  console.log(`✓ Remaining Complaints (${genuineComplaints.length}):`);
  for (const c of genuineComplaints) {
    console.log(`    - ${c.complaintReference || c._id} | Cat: ${c.category} | Status: ${c.status} | Complainant: ${c.complainant?.name}`);
  }

  // 6. Verify employee user accounts
  const employees = await db.collection('users').find({ role: { $ne: 'INSTITUTION' } }).toArray();
  console.log(`✓ Employee Accounts Preserved (${employees.length}): ${employees.map(e => e.userId).join(', ')}`);

  console.log('\n================================================================');
  console.log('CLEANUP AND POST-VERIFICATION FINISHED: ALL CHECKS PASSED');
  console.log('================================================================\n');

  await client.close();

  return {
    totalDeleted,
    deletedRecordsLog,
    remainingInstitutions: genuineInsts.length,
    remainingApplications: genuineApps.length,
    remainingPayments: genuinePays.length,
    remainingComplaints: genuineComplaints.length,
  };
}

executeCleanup().catch(err => {
  console.error('FATAL CLEANUP ERROR:', err);
  process.exit(1);
});
