import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

console.log('=== AICTE Portal — Approved Cleanup Script ===\n');
console.log('Rules:');
console.log(' - PRESERVE: Bharatiya Institute of Technology (both)');
console.log(' - PRESERVE: Kongu College, Bannari Amman, Sakthi');
console.log(' - DELETE: Delhi Institute of Technology (all 4 variants)');
console.log(' - DELETE: Apex/Zenith Engineering (3 batches)');
console.log(' - DELETE: Alpha-Omega batches (3 × 13 institutions)');
console.log(' - DELETE: Logout Test Institute');
console.log(' - DELETE: All related applications, payments, complaints, release requests, investigations');
console.log('');

// =========================================================
// 1. DUMMY INSTITUTION IDs TO DELETE
// =========================================================
const dummyInstitutionIds = [
  // Delhi Institute of Technology (4)
  '6ade84ed4eaf15daf9ebabe3', // Delhi 6253
  '6ade85194eaf15daf9ebabe6', // Delhi 7029
  '6ade85654eaf15daf9ebabe9', // Delhi 9805
  '6ade85aa1756c044d6328997', // Delhi 7655
  
  // Apex + Zenith Engineering (3 batches × 2)
  '6ade8ed4d1b4546dd3d8f790', // Apex 1
  '6ade8ed4d1b4546dd3d8f792', // Zenith 1
  '6ade8f3eb79b160c4e45a322', // Apex 2
  '6ade8f3eb79b160c4e45a324', // Zenith 2
  '6ade8fc0d23c5fca3163f6cd', // Apex 3
  '6ade8fc0d23c5fca3163f6cf', // Zenith 3
  
  // Alpha-Omega batch 1 (13)
  '6adea27ac65ac314db2384b2',
  '6adea27ac65ac314db2384b4',
  '6adea27ac65ac314db2384b7',
  '6adea27ac65ac314db2384ba',
  '6adea27ac65ac314db2384bd',
  '6adea27ac65ac314db2384c0',
  '6adea27ac65ac314db2384c3',
  '6adea27ac65ac314db2384c7',
  '6adea27ac65ac314db2384cb',
  '6adea27ac65ac314db2384d0',
  '6adea27ac65ac314db2384d2',
  '6adea27ac65ac314db2384d4',
  '6adea27ac65ac314db2384d8',
  
  // Alpha-Omega batch 2 (13)
  '6adea2f2e57350db0fd403de',
  '6adea2f2e57350db0fd403e0',
  '6adea2f2e57350db0fd403e3',
  '6adea2f2e57350db0fd403e6',
  '6adea2f2e57350db0fd403e9',
  '6adea2f2e57350db0fd403ed',
  '6adea2f2e57350db0fd403f1',
  '6adea2f2e57350db0fd403f6',
  '6adea2f2e57350db0fd403fa',
  '6adea2f2e57350db0fd40400',
  '6adea2f2e57350db0fd40402',
  '6adea2f2e57350db0fd40404',
  '6adea2f2e57350db0fd40408',
  
  // Alpha-Omega batch 3 (13)
  '6adea35878c444d66a578631',
  '6adea35878c444d66a578633',
  '6adea35878c444d66a578636',
  '6adea35878c444d66a578639',
  '6adea35878c444d66a57863c',
  '6adea35878c444d66a578640',
  '6adea35978c444d66a578644',
  '6adea35978c444d66a578649',
  '6adea35978c444d66a57864d',
  '6adea35978c444d66a578653',
  '6adea35978c444d66a578655',
  '6adea35978c444d66a578657',
  '6adea35978c444d66a57865b',
  
  // Logout Test Institute (1)
  '6adeab1fd7e1c1cee4af0497',
];

// Convert to ObjectIds
const dummyObjIds = dummyInstitutionIds.map(id => new ObjectId(id));

// These are their _id values in MongoDB (same as institutionId in some linked records)
// Also collect their string _ids for string-based institutionId matching
const dummyIdStrings = dummyInstitutionIds; // same strings used as institutionId in related collections

// =========================================================
// 2. DUMMY APPLICATION IDs TO DELETE (direct list)
// =========================================================
const dummyApplicationIds = [
  '6ade7a909f1b999de10f9d4b', // APP-2026-001 (hardcoded seed)
  '6ade7a909f1b999de10f9d4c', // APP-2026-002 (hardcoded seed)
  '6ade8ed4d1b4546dd3d8f794', // APP-TEST batch 1
  '6ade8ed5d1b4546dd3d8f795', // APP-DEF batch 1
  '6ade8f3eb79b160c4e45a326', // APP-TEST batch 2
  '6ade8f3eb79b160c4e45a327', // APP-DEF batch 2
  '6ade8fc0d23c5fca3163f6d1', // APP-TEST batch 3
  '6ade8fc0d23c5fca3163f6d2', // APP-DEF batch 3
];

// =========================================================
// 3. DUMMY PAYMENT IDs TO DELETE (direct list)
// =========================================================
const dummyPaymentIds = [
  '6ade7a909f1b999de10f9d4d', // PAY-2026-001 (hardcoded seed)
  '6ade7a909f1b999de10f9d4e', // PAY-2026-002 (hardcoded seed)
  // Also FDRs linked to Delhi institutions
  '6ade85654eaf15daf9ebabec', // FDR linked to Delhi 9805
  '6ade85ab1756c044d632899a', // FDR linked to Delhi 7655
];

// =========================================================
// 4. EXECUTE DELETIONS
// =========================================================

// 4a. Delete dummy institutions by _id
let result = await db.collection('institutions').deleteMany({ _id: { $in: dummyObjIds } });
console.log(`✓ Institutions deleted: ${result.deletedCount}`);

// 4b. Delete dummy applications by _id
const dummyAppObjIds = dummyApplicationIds.map(id => new ObjectId(id));
result = await db.collection('applications').deleteMany({ _id: { $in: dummyAppObjIds } });
console.log(`✓ Applications deleted: ${result.deletedCount}`);

// Also delete any applications with institutionId matching dummy institution IDs
result = await db.collection('applications').deleteMany({ institutionId: { $in: dummyIdStrings } });
console.log(`✓ Applications (by institutionId) deleted: ${result.deletedCount}`);

// 4c. Delete dummy payments
const dummyPayObjIds = dummyPaymentIds.map(id => new ObjectId(id));
result = await db.collection('payments').deleteMany({ _id: { $in: dummyPayObjIds } });
console.log(`✓ Payments deleted: ${result.deletedCount}`);

// Also by institutionId
result = await db.collection('payments').deleteMany({ institutionId: { $in: dummyIdStrings } });
console.log(`✓ Payments (by institutionId) deleted: ${result.deletedCount}`);

// 4d. Delete dummy release requests
// All 36 release requests are linked to dummy institutions
result = await db.collection('releaserequests').deleteMany({ institutionId: { $in: dummyIdStrings } });
console.log(`✓ Release requests (by institutionId) deleted: ${result.deletedCount}`);

// Also the orphaned PAY-2026 linked release request
const orphanReleaseId = new ObjectId('6ade7a909f1b999de10f9d4f');
result = await db.collection('releaserequests').deleteMany({ _id: orphanReleaseId });
console.log(`✓ Orphaned release request deleted: ${result.deletedCount}`);

// 4e. Delete dummy complaints
// Delete by institutionId matching dummy strings
result = await db.collection('complaints').deleteMany({ institutionId: { $in: ['dummyInst', 'inst2', 'fake-inst', ...dummyIdStrings] } });
console.log(`✓ Complaints deleted: ${result.deletedCount}`);

// 4f. Delete ALL investigations (all had undefined institutionId and caseId)
result = await db.collection('investigations').deleteMany({});
console.log(`✓ Investigations (all test data) deleted: ${result.deletedCount}`);

// =========================================================
// 5. VERIFY REMAINING DATA
// =========================================================
console.log('\n=== REMAINING RECORDS ===');
const remInsts = await db.collection('institutions').find({}, {projection:{_id:1, institutionId:1, name:1}}).toArray();
console.log(`\nInstitutions remaining: ${remInsts.length}`);
remInsts.forEach(i => console.log(`  ${i._id} | ${i.institutionId || 'no-id'} | ${i.name}`));

const remApps = await db.collection('applications').find({}, {projection:{_id:1, applicationId:1, institutionId:1, institutionName:1}}).toArray();
console.log(`\nApplications remaining: ${remApps.length}`);
remApps.forEach(a => console.log(`  ${a._id} | ${a.applicationId} | ${a.institutionName}`));

const remPays = await db.collection('payments').find({}, {projection:{_id:1, fdrNumber:1, institutionId:1, institutionName:1, amount:1}}).toArray();
console.log(`\nPayments remaining: ${remPays.length}`);
remPays.forEach(p => console.log(`  ${p._id} | ${p.fdrNumber} | ${p.institutionName} | ${p.amount}`));

const remRels = await db.collection('releaserequests').countDocuments();
console.log(`\nRelease requests remaining: ${remRels}`);

const remComps = await db.collection('complaints').countDocuments();
console.log(`Complaints remaining: ${remComps}`);

const remInvs = await db.collection('investigations').countDocuments();
console.log(`Investigations remaining: ${remInvs}`);

console.log('\n=== CLEANUP COMPLETE ===');
await client.close();
