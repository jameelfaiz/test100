import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const apps = await mongoose.connection.db.collection('applications').find().toArray();
  console.log('Total applications count:', apps.length);
  apps.forEach((a, i) => {
    console.log(`\n=== APP ${i} ===`);
    console.log(`_id: ${a._id}`);
    console.log(`applicationId: ${a.applicationId}`);
    console.log(`collegeId: ${a.collegeId}`);
    console.log(`title: ${a.title}`);
    console.log(`type: ${a.type}`);
    console.log(`status: ${a.status}`);
    console.log(`documents:`, a.documents);
    console.log(`documentItems:`, a.documentItems);
    console.log(`categoryDocuments:`, a.categoryDocuments);
    console.log(`submissionDate: ${a.submissionDate}`);
    console.log(`createdAt: ${a.createdAt}`);
  });
  await mongoose.disconnect();
}
run().catch(console.error);
