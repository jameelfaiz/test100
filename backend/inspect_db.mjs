import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

// Get all collections
const cols = await db.listCollections().toArray();
console.log('Collections:', cols.map(c => c.name).join(', '));

// Check institutions
const insts = await db.collection('institutions').find({}, {projection: {_id:1, institutionId:1, name:1, createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== INSTITUTIONS ===');
insts.forEach(i => console.log(JSON.stringify({_id: i._id.toString(), id: i.institutionId, name: i.name, created: i.createdAt})));

// Check applications  
const apps = await db.collection('applications').find({}, {projection: {_id:1, applicationId:1, institutionId:1, institutionName:1, createdAt:1, status:1}}).sort({createdAt:1}).toArray();
console.log('\n=== APPLICATIONS ===');
apps.forEach(a => console.log(JSON.stringify({_id: a._id.toString(), appId: a.applicationId, instId: a.institutionId, name: a.institutionName, status: a.status, created: a.createdAt})));

// Check payments
const pays = await db.collection('payments').find({}, {projection: {_id:1, paymentId:1, institutionId:1, fdrNumber:1, amount:1, createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== PAYMENTS/FDR ===');
pays.forEach(p => console.log(JSON.stringify({_id: p._id.toString(), payId: p.paymentId, instId: p.institutionId, fdr: p.fdrNumber, amount: p.amount, created: p.createdAt})));

// Check release requests
const rels = await db.collection('releaserequests').find({}, {projection: {_id:1, releaseId:1, institutionId:1, institutionName:1, createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== RELEASE REQUESTS ===');
rels.forEach(r => console.log(JSON.stringify({_id: r._id.toString(), relId: r.releaseId, instId: r.institutionId, name: r.institutionName, created: r.createdAt})));

// Check complaints
const comps = await db.collection('complaints').find({}, {projection: {_id:1, complaintId:1, institutionId:1, institutionName:1, createdAt:1}}).sort({createdAt:1}).toArray();
console.log('\n=== COMPLAINTS ===');
comps.forEach(c => console.log(JSON.stringify({_id: c._id.toString(), compId: c.complaintId, instId: c.institutionId, name: c.institutionName, created: c.createdAt})));

console.log('\n=== COUNTS ===');
console.log('Institutions:', insts.length);
console.log('Applications:', apps.length);
console.log('Payments:', pays.length);
console.log('Release Requests:', rels.length);
console.log('Complaints:', comps.length);

await client.close();
