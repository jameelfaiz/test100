import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const db = mongoose.connection.db;

  console.log('=== COMPLAINTS (48) ===');
  const complaints = await db.collection('complaints').find().toArray();
  complaints.forEach((c, i) => {
    console.log(`Complaint [${i}]: id=${c.complaintId || c._id}, collegeId=${c.collegeId}, subject=${c.subject || c.title}, status=${c.status}, created=${c.createdAt}`);
  });

  console.log('\n=== RELEASE REQUESTS (37) ===');
  const rrs = await db.collection('releaserequests').find().toArray();
  rrs.forEach((r, i) => {
    console.log(`Release [${i}]: id=${r.releaseRequestId}, collegeId=${r.collegeId}, fdr=${r.fdrNumber}, status=${r.status}, created=${r.createdAt}`);
  });

  await mongoose.disconnect();
}
run().catch(console.error);
