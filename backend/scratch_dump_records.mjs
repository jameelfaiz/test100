import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const db = mongoose.connection.db;

  console.log('=== PAYMENTS (FDRs) ===');
  const payments = await db.collection('payments').find().toArray();
  payments.forEach((p, i) => {
    console.log(`Payment [${i}]: id=${p.paymentId}, collegeId=${p.collegeId}, ref=${p.referenceNumber}, amount=${p.amount}, status=${p.status}, docs=${JSON.stringify(p.documents?.map(d=>d.name))}, date=${p.paymentDate || p.createdAt}`);
  });

  console.log('\n=== APPLICATIONS ===');
  const apps = await db.collection('applications').find().toArray();
  apps.forEach((a, i) => {
    console.log(`App [${i}]: id=${a._id}, appId=${a.applicationId}, collegeId=${a.collegeId}, title=${a.title}, status=${a.status}, created=${a.createdAt}`);
  });

  console.log('\n=== INSTITUTIONS ===');
  const insts = await db.collection('institutions').find().toArray();
  insts.forEach((ins, i) => {
    console.log(`Inst [${i}]: id=${ins._id}, collegeId=${ins.collegeId}, name=${ins.name}, status=${ins.registrationStatus}, created=${ins.createdAt}`);
  });

  await mongoose.disconnect();
}
run().catch(console.error);
