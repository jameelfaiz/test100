import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://127.0.0.1:27017/aicte_unified');
await client.connect();
const db = client.db('aicte_unified');

// Check remaining complaints
const comps = await db.collection('complaints').find({}).toArray();
console.log('=== REMAINING COMPLAINTS ===');
comps.forEach(c => console.log(JSON.stringify(c, null, 2)));

// Check remaining payment in detail (FDR)  
const pays = await db.collection('payments').find({}).toArray();
console.log('\n=== REMAINING PAYMENTS ===');
pays.forEach(p => console.log(JSON.stringify({
  _id: p._id,
  fdrNumber: p.fdrNumber,
  institutionId: p.institutionId,
  institutionName: p.institutionName,
  bankName: p.bankName,
  branchName: p.branchName,
  ifscCode: p.ifscCode,
  bankEmployeeName: p.bankEmployeeName,
  bankEmployeeId: p.bankEmployeeId,
  bankEmployeeDesignation: p.bankEmployeeDesignation,
  bankEmployeeContact: p.bankEmployeeContact,
  amount: p.amount,
  maturityDate: p.maturityDate,
  documents: p.documents,
  status: p.status,
  createdAt: p.createdAt
}, null, 2)));

await client.close();
