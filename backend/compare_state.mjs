import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

const backupDir = 'C:/Users/GOKUL/OneDrive/Desktop/hi/unified-aicte-portal/backend/backups/aicte_unified_backup_1793012498951';
const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf-8'));

console.log('=== BACKUP VS CURRENT MONGODB STATE ===\n');

for (const colName of Object.keys(manifest.collections)) {
  const currentCount = await db.collection(colName).countDocuments();
  console.log(`${colName.padEnd(25)} Backup: ${String(manifest.collections[colName]).padStart(4)} | Current: ${String(currentCount).padStart(4)}`);
}

// Check payments in MongoDB currently:
const currentPayments = await db.collection('payments').find().toArray();
console.log('\n--- Current Payments in DB ---');
currentPayments.forEach(p => {
  console.log(`_id: ${p._id} | fdr: ${p.fdrNumber || p.paymentId} | amount: ${p.amount} | bank: ${p.bankName} | docs: ${p.documents?.length}`);
});

// Check backup payments:
const backupPayments = JSON.parse(fs.readFileSync(path.join(backupDir, 'payments.json'), 'utf-8'));
console.log('\n--- Backup Payments ---');
backupPayments.forEach(p => {
  console.log(`_id: ${p._id['$oid'] || p._id} | fdr: ${p.fdrNumber || p.paymentId} | amount: ${p.amount} | bank: ${p.bankName} | docs: ${p.documents?.length}`);
});

// Check current institutions:
const currentInsts = await db.collection('institutions').find().toArray();
console.log('\n--- Current Institutions in DB ---');
currentInsts.forEach(i => console.log(`_id: ${i._id} | name: ${i.name} | email: ${i.email}`));

await client.close();
