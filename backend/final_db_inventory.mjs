import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

const backupDir = 'C:/Users/GOKUL/OneDrive/Desktop/hi/unified-aicte-portal/backend/backups/aicte_unified_backup_1793012498951';
const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf-8'));

console.log('=== EXACT BEFORE AND AFTER RECORD COUNTS PER COLLECTION ===\n');
console.log('Collection'.padEnd(25) + 'Before (Backup)'.padStart(16) + 'After (Current)'.padStart(16) + 'Difference'.padStart(14));
console.log('-'.repeat(71));

const counts = {};

for (const colName of Object.keys(manifest.collections)) {
  const before = manifest.collections[colName];
  const after = await db.collection(colName).countDocuments();
  counts[colName] = { before, after, diff: after - before };
  console.log(`${colName.padEnd(25)}${String(before).padStart(16)}${String(after).padStart(16)}${String(after - before).padStart(14)}`);
}

console.log('\n=== PRESERVED RECORDS SUMMARY ===');

// Preserved institutions
const insts = await db.collection('institutions').find().toArray();
console.log(`\nPreserved Institutions (${insts.length}):`);
insts.forEach(i => console.log(`  - _id: ${i._id} | name: ${i.name} | email: ${i.email}`));

// Preserved applications
const apps = await db.collection('applications').find().toArray();
console.log(`\nPreserved Applications (${apps.length}):`);
apps.forEach(a => console.log(`  - _id: ${a._id} | appId: ${a.applicationId} | status: ${a.status}`));

// Preserved payments
const pays = await db.collection('payments').find().toArray();
console.log(`\nPreserved Payments / FDRs (${pays.length}):`);
pays.forEach(p => console.log(`  - _id: ${p._id} | fdr: ${p.fdrNumber || p.paymentId || p.referenceNumber} | amount: ₹${p.amount} | docs: ${p.documents?.length}`));

// Preserved complaints
const comps = await db.collection('complaints').find().toArray();
console.log(`\nPreserved Complaints (${comps.length}):`);
comps.forEach(c => console.log(`  - _id: ${c._id} | instId: ${c.institutionId} | status: ${c.status}`));

// Preserved users
const users = await db.collection('users').find().toArray();
console.log(`\nPreserved Users (${users.length}):`);
users.forEach(u => console.log(`  - _id: ${u._id} | userId: ${u.userId} | username: ${u.username || '—'} | role: ${u.role}`));

await client.close();
