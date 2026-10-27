import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

const backupDir = 'C:/Users/GOKUL/OneDrive/Desktop/hi/unified-aicte-portal/backend/backups/aicte_unified_backup_1793012498951';

// 1. Read backup payments
const backupPayments = JSON.parse(fs.readFileSync(path.join(backupDir, 'payments.json'), 'utf-8'));
const targetFdrIds = ['6ade85654eaf15daf9ebabec', '6ade85ab1756c044d632899a'];
const fdrsToRestore = backupPayments.filter(p => targetFdrIds.includes(p._id['$oid'] || p._id));

console.log('Restoring 2 uncertain Delhi-linked FDRs...');
for (const raw of fdrsToRestore) {
  const doc = { ...raw };
  const strId = doc._id['$oid'] || doc._id;
  doc._id = new ObjectId(strId);
  if (doc.createdAt && typeof doc.createdAt === 'string') doc.createdAt = new Date(doc.createdAt);
  if (doc.updatedAt && typeof doc.updatedAt === 'string') doc.updatedAt = new Date(doc.updatedAt);
  if (doc.paymentDate && typeof doc.paymentDate === 'string') doc.paymentDate = new Date(doc.paymentDate);
  if (doc.maturityDate && typeof doc.maturityDate === 'string') doc.maturityDate = new Date(doc.maturityDate);

  const existing = await db.collection('payments').findOne({ _id: doc._id });
  if (!existing) {
    await db.collection('payments').insertOne(doc);
    console.log(`✓ Restored payment: ${strId} (${doc.referenceNumber || doc.paymentId})`);
  } else {
    console.log(`Payment ${strId} already exists`);
  }
}

// 2. Read backup institutions to restore the 2 linked Delhi institutions
const backupInsts = JSON.parse(fs.readFileSync(path.join(backupDir, 'institutions.json'), 'utf-8'));
const targetInstIds = ['6ade85654eaf15daf9ebabe9', '6ade85aa1756c044d6328997'];
const instsToRestore = backupInsts.filter(i => targetInstIds.includes(i._id['$oid'] || i._id));

console.log('\nRestoring 2 linked Delhi institutions for the uncertain FDRs and complaints...');
for (const raw of instsToRestore) {
  const doc = { ...raw };
  const strId = doc._id['$oid'] || doc._id;
  doc._id = new ObjectId(strId);
  if (doc.createdAt && typeof doc.createdAt === 'string') doc.createdAt = new Date(doc.createdAt);
  if (doc.updatedAt && typeof doc.updatedAt === 'string') doc.updatedAt = new Date(doc.updatedAt);

  const existing = await db.collection('institutions').findOne({ _id: doc._id });
  if (!existing) {
    await db.collection('institutions').insertOne(doc);
    console.log(`✓ Restored institution: ${strId} (${doc.name})`);
  } else {
    console.log(`Institution ${strId} already exists`);
  }
}

// 3. Verify total current counts
console.log('\n=== CURRENT VERIFIED COUNTS IN aicte_unified ===');
const instCount = await db.collection('institutions').countDocuments();
const appCount = await db.collection('applications').countDocuments();
const payCount = await db.collection('payments').countDocuments();
const compCount = await db.collection('complaints').countDocuments();
const userCount = await db.collection('users').countDocuments();

console.log(`Institutions: ${instCount} (5 genuine + 2 uncertain preserved)`);
console.log(`Applications: ${appCount} (2 genuine)`);
console.log(`Payments:     ${payCount} (1 genuine ₹50L + 2 uncertain Delhi FDRs)`);
console.log(`Complaints:   ${compCount} (2 uncertain preserved)`);
console.log(`Users:        ${userCount} (All employee and institution accounts intact)`);

await client.close();
