// reset_inst_password.mjs — Uses only mongoose + bcrypt directly
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
let MONGO_URI = 'mongodb://127.0.0.1:27017/aicte_unified';
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^MONGODB_URI=(.+)$/);
    if (m) MONGO_URI = m[1].trim();
  }
} catch {}

console.log('Connecting to:', MONGO_URI);

await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;
const hash = await bcrypt.hash('TestPass@123', 12);
const result = await db.collection('users').updateMany(
  { $or: [{ userId: { $in: ['Bannari Amman', 'Sakthi', 'CLG-2026-000001'] } }, { collegeId: { $in: ['CLG-2026-000009', 'CLG-2026-000010'] } }] },
  { $set: { passwordHash: hash, accountStatus: 'ACTIVE' } }
);
console.log('Updated:', result.modifiedCount, 'document(s)');
await mongoose.disconnect();
console.log('Done.');
