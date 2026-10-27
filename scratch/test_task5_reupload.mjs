import mongoose from 'mongoose';
import crypto from 'crypto';

const SESSION_SECRET = 'dev-secret-please-change';

function signCookie(val, secret) {
  const signed = crypto.createHmac('sha256', secret).update(val).digest('base64').replace(/\=+$/, '');
  return `s:${val}.${signed}`;
}

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  console.log('Connected to MongoDB.');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Application = mongoose.model('Application', new mongoose.Schema({}, { strict: false }));
  const DocumentVerification = mongoose.model('DocumentVerification', new mongoose.Schema({}, { strict: false }));

  const inst1User = await User.findOne({ collegeId: 'CLG-2026-000009' });
  const app = await Application.findOne({ collegeId: 'CLG-2026-000009' });

  const sessionsColl = mongoose.connection.collection('sessions');
  const inst1SessionId = 'test_t5_sess_' + Date.now();
  const csrfToken = 'test_csrf_t5';
  const expireDate = new Date(Date.now() + 3600000);

  await sessionsColl.insertOne({
    _id: inst1SessionId,
    session: JSON.stringify({
      cookie: { originalMaxAge: 3600000, expires: expireDate },
      userId: inst1User.userId,
      role: 'INSTITUTION',
      userObjectId: inst1User._id.toString(),
      csrfToken,
    }),
    expires: expireDate,
  });

  const inst1Cookie = `connect.sid=${encodeURIComponent(signCookie(inst1SessionId, SESSION_SECRET))}`;

  console.log('\n--- Checking initial state of rejected document ---');
  const initialDef = await DocumentVerification.findOne({
    applicationId: app._id,
    status: 'NOT_VERIFIED',
  });
  console.log('Initial rejected doc:', {
    category: initialDef.category,
    status: initialDef.status,
    remarks: initialDef.remarks,
    historyLen: initialDef.history?.length || 0,
  });

  console.log('\n--- Simulating corrected document upload & save by institution ---');
  // Institution saves updated application with corrected document for this category
  const updatedDocs = (app.categoryDocuments || []).map(d => {
    if (d.category === initialDef.category || d.code === initialDef.category) {
      return {
        ...d,
        fileName: 'corrected_' + Date.now() + '.pdf',
        originalName: 'Corrected_Signed_Document.pdf',
      };
    }
    return d;
  });

  const saveRes = await fetch('http://localhost:5000/api/institution/approval/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: inst1Cookie,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({
      applicationId: app.applicationId,
      applicationType: app.applicationType || 'LOA',
      title: app.title,
      description: app.description,
      documents: updatedDocs,
      isDraft: false,
    }),
  });

  const saveBody = await saveRes.json();
  console.log('Save response status:', saveRes.status, saveBody.message);

  console.log('\n--- Verifying DocumentVerification state after re-upload ---');
  const afterVerif = await DocumentVerification.findOne({
    applicationId: app._id,
    category: initialDef.category,
  });

  console.log('After re-upload doc state:', {
    status: afterVerif.status,
    verified: afterVerif.verified,
    remarks: afterVerif.remarks,
    history: afterVerif.history,
  });

  const historySaved = afterVerif.history && afterVerif.history.length > 0 && afterVerif.history[0].remarks === initialDef.remarks;
  const isPending = afterVerif.status === 'PENDING' && afterVerif.verified === false;
  const remarksCleared = !afterVerif.remarks;

  if (historySaved && isPending && remarksCleared) {
    console.log('PASS: Historical rejection preserved in audit history, status is PENDING (not auto-verified), active remarks cleared.');
  } else {
    console.error('FAIL: Task 5 verification failed.');
  }

  console.log('\n--- Verifying Institution Receive Deficiencies list ---');
  const defRes = await fetch('http://localhost:5000/api/institution/receive/document-deficiencies', {
    headers: { Cookie: inst1Cookie },
  });
  const defData = await defRes.json();
  const stillListed = (defData.deficiencies || []).find(d => d.documentId === initialDef.documentId && d.documentPath === afterVerif.documentPath);

  if (!stillListed) {
    console.log('PASS: Re-uploaded document is removed from active deficiency list while in PENDING verification state.');
  } else {
    console.error('FAIL: Document is still in active deficiency list despite re-upload:', stillListed);
  }

  // Clean up session
  await sessionsColl.deleteOne({ _id: inst1SessionId });
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
