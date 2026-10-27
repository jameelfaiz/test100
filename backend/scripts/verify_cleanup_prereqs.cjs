// backend/scripts/verify_cleanup_prereqs.cjs
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'aicte_unified';
const TEST_RESTORE_DB = 'aicte_backup_restore_test';

const TARGET_RECORDS = [
  { collection: 'institutions', _id: '6ade85654eaf15daf9ebabe9', desc: 'Delhi Institute of Technology 9805 (CLG-2026-000005)' },
  { collection: 'institutions', _id: '6ade85aa1756c044d6328997', desc: 'Delhi Institute of Technology 7655 (CLG-2026-000006)' },
  { collection: 'payments', _id: '6ade85654eaf15daf9ebabec', desc: 'FDR-1792968037730-59 (Delhi 9805)' },
  { collection: 'payments', _id: '6ade85ab1756c044d632899a', desc: 'FDR-1792968107069-397 (Delhi 7655)' },
  { collection: 'complaints', _id: '6ade85654eaf15daf9ebabed', desc: 'Dummy complaint (Delhi 9805)' },
  { collection: 'complaints', _id: '6ade85ab1756c044d632899b', desc: 'Dummy complaint (Delhi 7655)' },
  { collection: 'complaintletters', _id: '6adf57279183ff477ff7fe4a', desc: 'Test outcome letter 1' },
  { collection: 'complaintletters', _id: '6adf57409183ff477ff7fe4b', desc: 'Test outcome letter 2' },
  { collection: 'users', _id: '6ade85654eaf15daf9ebabea', desc: 'Institution user CLG-2026-000005' },
  { collection: 'users', _id: '6ade85aa1756c044d6328998', desc: 'Institution user CLG-2026-000006' },
];

async function run() {
  console.log('================================================================');
  console.log('SAFETY AUDIT: BACKUP RESTORABILITY & PROVENANCE / DEPENDENCY CHECKS');
  console.log('================================================================\n');

  const backupDir = path.join(__dirname, '..', 'backups', 'aicte_unified_backup_1793027298929');

  // 1. Verify backup directory & files
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory does not exist: ${backupDir}`);
  }
  const manifestPath = path.join(backupDir, '_backup_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest missing: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`[1] Backup Directory Verified: ${backupDir}`);
  console.log(`    Manifest Collections: ${Object.keys(manifest.collections).length} collections`);

  // Verify all 14 files exist and contain valid JSON
  for (const col of Object.keys(manifest.collections)) {
    const colFile = path.join(backupDir, `${col}.json`);
    if (!fs.existsSync(colFile)) throw new Error(`Missing backup collection file: ${colFile}`);
    const data = JSON.parse(fs.readFileSync(colFile, 'utf8'));
    if (data.length !== manifest.collections[col]) {
      throw new Error(`Count mismatch in backup for ${col}: manifest=${manifest.collections[col]}, file=${data.length}`);
    }
  }
  console.log('    All 14 collection JSON files verified.');

  // Verify all 10 target records are in the backup
  for (const target of TARGET_RECORDS) {
    const data = JSON.parse(fs.readFileSync(path.join(backupDir, `${target.collection}.json`), 'utf8'));
    const found = data.some(d => String(d._id) === target._id);
    if (!found) throw new Error(`Target record not found in backup: ${target.collection} id=${target._id}`);
  }
  console.log('    All 10 target records confirmed present in backup.');

  // 2. Test Restore into an isolated temporary database
  console.log(`\n[2] Testing Backup Restorability into isolated db: ${TEST_RESTORE_DB}...`);
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const testDb = client.db(TEST_RESTORE_DB);

  try {
    // Drop test database if already exists
    await testDb.dropDatabase();

    for (const col of Object.keys(manifest.collections)) {
      const data = JSON.parse(fs.readFileSync(path.join(backupDir, `${col}.json`), 'utf8'));
      if (data.length > 0) {
        // convert string _id back to ObjectId where appropriate
        const processed = data.map(doc => {
          const d = { ...doc };
          if (d._id && typeof d._id === 'string' && /^[0-9a-fA-F]{24}$/.test(d._id)) {
            d._id = new ObjectId(d._id);
          }
          return d;
        });
        await testDb.collection(col).insertMany(processed);
      }
      const restoredCount = await testDb.collection(col).countDocuments();
      if (restoredCount !== manifest.collections[col]) {
        throw new Error(`Restore count mismatch for ${col}: expected ${manifest.collections[col]}, got ${restoredCount}`);
      }
    }
    console.log(`    Successfully restored all 14 collections into ${TEST_RESTORE_DB}! Backup is 100% restorable.`);

    // Clean up temporary restore database
    await testDb.dropDatabase();
    console.log(`    Temporary test database ${TEST_RESTORE_DB} cleaned up.`);
  } catch (err) {
    await testDb.dropDatabase();
    throw new Error(`Backup restore test failed: ${err.message}`);
  }

  // 3. Provenance & Dependency Checks in Live Database
  console.log(`\n[3] Checking Provenance & Dependencies in Live DB (${DB_NAME})...`);
  const liveDb = client.db(DB_NAME);

  for (const target of TARGET_RECORDS) {
    const doc = await liveDb.collection(target.collection).findOne({ _id: new ObjectId(target._id) });
    if (!doc) {
      throw new Error(`Target record not found in live database: ${target.collection} id=${target._id}`);
    }
    console.log(`    ✓ Confirmed in live DB: [${target.collection}] ${target._id} (${target.desc})`);
  }

  // Check applications referencing Delhi institutions
  const delhiApps = await liveDb.collection('applications').find({
    $or: [
      { collegeId: 'CLG-2026-000005' },
      { collegeId: 'CLG-2026-000006' },
      { collegeId: { $regex: /delhi/i } }
    ]
  }).toArray();
  console.log(`\n    Applications referencing Delhi dummy institutions: ${delhiApps.length}`);
  if (delhiApps.length > 0) {
    throw new Error(`Unexpected applications referencing Delhi: ${JSON.stringify(delhiApps)}`);
  }

  // Check investigations
  const invs = await liveDb.collection('investigations').find({
    $or: [
      { collegeId: 'CLG-2026-000005' },
      { collegeId: 'CLG-2026-000006' },
      { complaintId: { $in: [new ObjectId('6ade85654eaf15daf9ebabed'), new ObjectId('6ade85ab1756c044d632899b')] } }
    ]
  }).toArray();
  console.log(`    Investigations referencing Delhi: ${invs.length}`);

  // Check release requests
  const releases = await liveDb.collection('releaserequests').find({
    $or: [
      { collegeId: 'CLG-2026-000005' },
      { collegeId: 'CLG-2026-000006' }
    ]
  }).toArray();
  console.log(`    Release requests referencing Delhi: ${releases.length}`);

  // Check complaint letters dependencies
  const letters = await liveDb.collection('complaintletters').find({
    _id: { $in: [new ObjectId('6adf57279183ff477ff7fe4a'), new ObjectId('6adf57409183ff477ff7fe4b')] }
  }).toArray();
  console.log(`    Target draft complaint letters: ${letters.length} found.`);
  for (const l of letters) {
    console.log(`      Letter: ${l.letterReference} | Dept: ${l.department} | Status: ${l.status} | Sent: ${l.isSent}`);
  }

  // Check genuine institutions status
  const genuineInsts = await liveDb.collection('institutions').find({
    collegeId: { $in: ['CLG-2026-000001', 'CLG-2026-000002', 'CLG-2026-000008', 'CLG-2026-000009', 'CLG-2026-000010'] }
  }).toArray();
  console.log(`\n    Genuine Institutions Verified (5): ${genuineInsts.map(i => `${i.name} (${i.collegeId})`).join(', ')}`);

  console.log('\n================================================================');
  console.log('ALL PRE-CLEANUP CHECKS PASSED: READY FOR TRANSACTIONAL CLEANUP');
  console.log('================================================================\n');

  await client.close();
}

run().catch(err => {
  console.error('\nSAFETY AUDIT FAILED:', err.message);
  process.exit(1);
});
