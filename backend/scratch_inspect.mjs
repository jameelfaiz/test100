import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const dbs = await mongoose.connection.db.admin().listDatabases();
  console.log('Databases:', dbs.databases.map(d => d.name));
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections in aicte_unified:', collections.map(c => c.name));
  
  const apps = await mongoose.connection.db.collection('applications').find().toArray();
  console.log('Total applications count:', apps.length);
  apps.forEach((a, i) => {
    console.log(`App ${i}: id=${a._id}, appId=${a.applicationId}, collegeId=${a.collegeId}, title=${a.title}, type=${a.type}, status=${a.status}, docsCount=${a.documents?.length}, docItemsCount=${a.documentItems?.length}, categoryDocs=${a.categoryDocuments?.length}`);
    console.log('  documents:', JSON.stringify(a.documents));
    console.log('  documentItems:', JSON.stringify(a.documentItems));
    console.log('  categoryDocuments:', JSON.stringify(a.categoryDocuments));
  });

  const insts = await mongoose.connection.db.collection('institutions').find().toArray();
  console.log('Total institutions count:', insts.length);
  insts.forEach((ins, i) => {
    console.log(`Inst ${i}: id=${ins._id}, collegeId=${ins.collegeId}, name=${ins.name}, regStatus=${ins.registrationStatus}`);
  });

  const users = await mongoose.connection.db.collection('users').find().toArray();
  console.log('Total users count:', users.length);
  users.forEach((u, i) => {
    console.log(`User ${i}: id=${u._id}, userId=${u.userId}, email=${u.email}, role=${u.role}`);
  });

  const docVers = await mongoose.connection.db.collection('documentverifications').find().toArray();
  console.log('Total documentverifications count:', docVers.length);
  docVers.forEach((dv, i) => {
    console.log(`DocVer ${i}: id=${dv._id}, appId=${dv.applicationId}, docPath=${dv.documentPath}, verified=${dv.verified}, remarks=${dv.remarks}`);
  });
  
  await mongoose.disconnect();
}
run().catch(console.error);
