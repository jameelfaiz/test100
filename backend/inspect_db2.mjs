import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

// Check institutions with names
const insts = await db.collection('institutions').find({}, {projection: {_id:1, institutionId:1, name:1, email:1, createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== ALL INSTITUTIONS ===');
insts.forEach(i => console.log(`${i._id.toString()} | ${i.institutionId || 'no-id'} | ${i.name || 'NO NAME'} | ${i.email || ''} | ${i.createdAt}`));

// Check applications with names
const apps = await db.collection('applications').find({}, {projection: {_id:1, applicationId:1, institutionId:1, institutionName:1, createdAt:1, status:1}}).sort({createdAt:1}).toArray();
console.log('\n=== ALL APPLICATIONS ===');
apps.forEach(a => console.log(`${a._id.toString()} | ${a.applicationId} | ${a.institutionId} | ${a.institutionName || 'NO NAME'} | ${a.status} | ${a.createdAt}`));

// Check payments
const pays = await db.collection('payments').find({}, {projection: {_id:1, paymentId:1, institutionId:1, institutionName:1, fdrNumber:1, amount:1, createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== ALL PAYMENTS/FDR ===');
pays.forEach(p => console.log(`${p._id.toString()} | ${p.paymentId || p.fdrNumber} | ${p.institutionId} | ${p.institutionName || 'NO NAME'} | ${p.amount} | ${p.createdAt}`));

// Counts of release requests and complaints by institution type
const rels = await db.collection('releaserequests').find({}, {projection: {_id:1, institutionId:1, institutionName:1, createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== RELEASE REQUESTS ===');
rels.forEach(r => console.log(`${r._id.toString()} | ${r.institutionId} | ${r.institutionName || 'NO NAME'} | ${r.createdAt}`));

await client.close();
