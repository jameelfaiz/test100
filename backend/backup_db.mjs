import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

async function backup() {
  const backupDir = path.resolve('./backups', `aicte_unified_backup_${Date.now()}`);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();

  console.log(`Starting database backup to: ${backupDir}`);
  const summary = {};

  for (const c of cols) {
    const docs = await db.collection(c.name).find().toArray();
    const filePath = path.join(backupDir, `${c.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    summary[c.name] = docs.length;
    console.log(`Backed up collection "${c.name}": ${docs.length} documents -> ${filePath}`);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    database: 'aicte_unified',
    collections: summary
  }, null, 2), 'utf8');

  console.log('Backup completed successfully.');
  await mongoose.disconnect();
}

backup().catch(console.error);
