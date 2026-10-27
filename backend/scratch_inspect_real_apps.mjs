import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

async function inspectRealApps() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'evidence');

  const apps = await mongoose.connection.db.collection('applications').find({
    type: 'APPROVAL_SEEKING'
  }).toArray();

  console.log(`Found ${apps.length} APPROVAL_SEEKING applications:`);
  for (const app of apps) {
    console.log(`\n========================================`);
    console.log(`App ID: ${app.applicationId}`);
    console.log(`Mongo ID: ${app._id}`);
    console.log(`College ID: ${app.collegeId}`);
    console.log(`Title: ${app.title}`);
    console.log(`Status: ${app.status}`);
    console.log(`Submission Date: ${app.submissionDate}`);
    console.log(`Documents count: ${app.documents?.length}`);

    const inst = await mongoose.connection.db.collection('institutions').findOne({
      $or: [{ collegeId: app.collegeId }, { name: app.collegeId }]
    });
    console.log(`Matched Institution:`, inst ? { name: inst.name, collegeId: inst.collegeId, state: inst.state, district: inst.district } : 'NONE');

    const docVers = await mongoose.connection.db.collection('documentverifications').find({
      applicationId: app._id
    }).toArray();
    console.log(`DocumentVerifications count: ${docVers.length}`);

    if (app.documents) {
      console.log('Documents check:');
      app.documents.forEach((fileName, i) => {
        const fullPath = path.join(uploadDir, fileName);
        const exists = fs.existsSync(fullPath);
        const size = exists ? fs.statSync(fullPath).size : 0;
        const dv = docVers.find(d => d.documentPath === fileName);
        console.log(`  [${i+1}] ${fileName} | onDisk=${exists} (${size} B) | dvExists=${Boolean(dv)} | dvVerified=${dv?.verified} | remarks=${dv?.remarks}`);
      });
    }
  }

  await mongoose.disconnect();
}

inspectRealApps().catch(console.error);
