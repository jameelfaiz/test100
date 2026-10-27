import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

// Get institutions with proper institutionId (CLG-2026-*)
const real = await db.collection('institutions').find({institutionId: {$regex: /^CLG-/}}, {projection:{_id:1,institutionId:1,name:1,email:1,createdAt:1}}).toArray();
console.log('=== GENUINE INSTITUTIONS (CLG-ID) ===');
real.forEach(i => console.log(`${i._id} | ${i.institutionId} | ${i.name} | ${i.email}`));

// Get institutions without proper institutionId (dummy)
const dummy = await db.collection('institutions').find({$or:[{institutionId:{$exists:false}},{institutionId:null},{institutionId:''}]}, {projection:{_id:1,institutionId:1,name:1,email:1,createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== INSTITUTIONS WITHOUT CLG-ID (Likely dummy) ===');
dummy.forEach(i => console.log(`${i._id} | ${i.name} | ${i.email}`));

// Check for auto-seed guard
const seeds = await db.collection('systemconfig').find({}).toArray();
console.log('\n=== SYSTEM CONFIG ===');
seeds.forEach(s => console.log(JSON.stringify(s)));

// Check investigations
const invs = await db.collection('investigations').find({}, {projection:{_id:1,institutionId:1,caseId:1,createdAt:1}}).limit(10).toArray();
console.log('\n=== INVESTIGATIONS (first 10) ===');
invs.forEach(i => console.log(`${i._id} | ${i.caseId} | ${i.institutionId} | ${i.createdAt}`));

// Final payment with institution info
const pays = await db.collection('payments').find({}).toArray();
console.log('\n=== PAYMENTS DETAIL ===');
pays.forEach(p => console.log(`${p._id} | fdr:${p.fdrNumber||p.paymentId} | inst:${p.institutionId} | name:${p.institutionName} | amt:${p.amount} | docs:${JSON.stringify(p.documents?.length)} | ${p.createdAt}`));

await client.close();
