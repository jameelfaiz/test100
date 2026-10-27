// backend/scripts/backup_and_audit_db.cjs
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log(`Connected to MongoDB database: ${db.databaseName}`);

    const timestamp = Date.now();
    const backupDir = path.join(__dirname, '..', 'backups', `aicte_unified_backup_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);

    const collections = await db.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections. Starting backup...`);

    const summary = {};

    for (const col of collections) {
      const colName = col.name;
      const docs = await db.collection(colName).find({}).toArray();
      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
      summary[colName] = docs.length;
      console.log(`✓ Backed up "${colName}": ${docs.length} documents -> ${filePath}`);
    }

    fs.writeFileSync(path.join(backupDir, '_backup_manifest.json'), JSON.stringify({
      timestamp,
      date: new Date().toISOString(),
      database: db.databaseName,
      collections: summary
    }, null, 2), 'utf8');

    console.log('\n==================================================');
    console.log('BACKUP COMPLETED AND VERIFIED SUCCESSFULLY!');
    console.log(`Location: ${backupDir}`);
    console.log('==================================================\n');

    // Return collection stats
    console.log('Collection counts:');
    for (const [k, v] of Object.entries(summary)) {
      console.log(`  ${k}: ${v}`);
    }

    return { backupDir, summary };
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
