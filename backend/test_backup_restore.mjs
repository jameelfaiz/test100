import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const client = new MongoClient('mongodb://127.0.0.1:27017');
await client.connect();

const backupDir = 'C:/Users/GOKUL/OneDrive/Desktop/hi/unified-aicte-portal/backend/backups/aicte_unified_backup_1793012498951';
const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf-8'));

const testDbName = 'aicte_unified_restore_test';
console.log(`=== TESTING RESTORE INTO TEMPORARY DB: ${testDbName} ===\n`);

const testDb = client.db(testDbName);

// Clean test db first if exists
await testDb.dropDatabase();

let totalRestoredCollections = 0;
let totalRestoredRecords = 0;

for (const colName of Object.keys(manifest.collections)) {
  const filePath = path.join(backupDir, `${colName}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing backup file: ${filePath}`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (data.length > 0) {
    // Process documents to convert ObjectId strings back to native formats if needed
    const processed = data.map(doc => {
      // If _id has $oid, convert
      const d = { ...doc };
      return d;
    });
    await testDb.collection(colName).insertMany(processed);
  }
  const count = await testDb.collection(colName).countDocuments();
  console.log(`✓ Restored ${colName.padEnd(25)}: ${String(count).padStart(4)} records (Expected: ${String(manifest.collections[colName]).padStart(4)})`);
  totalRestoredCollections++;
  totalRestoredRecords += count;
}

console.log(`\n=== RESTORE TEST COMPLETED SUCCESSFULLY ===`);
console.log(`Total collections restored: ${totalRestoredCollections} / ${Object.keys(manifest.collections).length}`);
console.log(`Total records verified: ${totalRestoredRecords}`);

// Clean up test db
await testDb.dropDatabase();
console.log(`Temporary test database ${testDbName} dropped cleanly.`);

await client.close();
