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
  const Notification = mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));

  // Find users
  const fdUser = await User.findOne({ role: 'AICTE_FD_EMPLOYEE' });
  const inst1User = await User.findOne({ collegeId: 'CLG-2026-000009' }); // Bannari Amman
  const inst2User = await User.findOne({ collegeId: 'CLG-2026-000010' }); // Sakthi

  if (!fdUser || !inst1User || !inst2User) {
    console.error('Missing required test users:', { fdUser: !!fdUser, inst1User: !!inst1User, inst2User: !!inst2User });
    process.exit(1);
  }

  const app = await Application.findOne({ collegeId: 'CLG-2026-000009', 'documentItems.0': { $exists: true } });
  if (!app) {
    console.error('No application with documents found for Bannari Amman');
    process.exit(1);
  }

  const fs = await import('fs');
  const path = await import('path');
  const uploadDir = path.resolve('backend', 'uploads', 'evidence');
  const targetDoc = app.documentItems.find(d => d.fileName && fs.existsSync(path.join(uploadDir, d.fileName))) || app.documentItems[0];
  console.log(`Testing with App: ${app.applicationId}, Doc: ${targetDoc.id} (${targetDoc.name}), File: ${targetDoc.fileName}`);

  const sessionsColl = mongoose.connection.collection('sessions');

  const fdSessionId = 'test_fd_sess_' + Date.now();
  const inst1SessionId = 'test_inst1_sess_' + Date.now();
  const inst2SessionId = 'test_inst2_sess_' + Date.now();
  const csrfToken = 'test_csrf_token_xyz';

  const expireDate = new Date(Date.now() + 3600000);

  await sessionsColl.insertOne({
    _id: fdSessionId,
    session: JSON.stringify({
      cookie: { originalMaxAge: 3600000, expires: expireDate },
      userId: fdUser.userId,
      role: 'AICTE_FD_EMPLOYEE',
      userObjectId: fdUser._id.toString(),
      csrfToken,
    }),
    expires: expireDate,
  });

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

  await sessionsColl.insertOne({
    _id: inst2SessionId,
    session: JSON.stringify({
      cookie: { originalMaxAge: 3600000, expires: expireDate },
      userId: inst2User.userId,
      role: 'INSTITUTION',
      userObjectId: inst2User._id.toString(),
      csrfToken,
    }),
    expires: expireDate,
  });

  const fdCookie = `connect.sid=${encodeURIComponent(signCookie(fdSessionId, SESSION_SECRET))}`;
  const inst1Cookie = `connect.sid=${encodeURIComponent(signCookie(inst1SessionId, SESSION_SECRET))}`;
  const inst2Cookie = `connect.sid=${encodeURIComponent(signCookie(inst2SessionId, SESSION_SECRET))}`;

  console.log('\n--- TEST 1: Mandatory FD rejection remark ---');
  // Attempt reject without remarks
  const rejectEmptyRes = await fetch(`http://localhost:5000/api/fd/application/${app.applicationId}/verify-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: fdCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({
      docId: targetDoc.id,
      status: 'Not Verified',
      remarks: '   ',
    }),
  });
  const emptyBody = await rejectEmptyRes.json();
  if (rejectEmptyRes.status === 400 && emptyBody.message.includes('mandatory')) {
    console.log('PASS: Mandatory FD rejection remark enforced (HTTP 400):', emptyBody.message);
  } else {
    console.error('FAIL: Expected 400 with mandatory remarks message, got:', rejectEmptyRes.status, emptyBody);
  }

  console.log('\n--- TEST 2: Save decision with non-empty remark & MongoDB persistence ---');
  const testRemark = 'Audited statement signature is missing on page 3. Please upload signed copy.';
  const rejectValidRes = await fetch(`http://localhost:5000/api/fd/application/${app.applicationId}/verify-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: fdCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({
      docId: targetDoc.id,
      status: 'Not Verified',
      remarks: testRemark,
    }),
  });
  const validBody = await rejectValidRes.json();
  if (rejectValidRes.status === 200) {
    console.log('PASS: Successfully saved Not Verified decision:', validBody.message);
  } else {
    console.error('FAIL: Failed to save decision:', rejectValidRes.status, validBody);
  }

  // Check MongoDB DocumentVerification
  const docVerif = await DocumentVerification.findOne({
    applicationId: app._id,
    $or: [{ documentId: targetDoc.id }, { documentPath: targetDoc.fileName }],
  });
  if (docVerif && docVerif.status === 'NOT_VERIFIED' && docVerif.remarks === testRemark) {
    console.log('PASS: DocumentVerification saved in MongoDB:');
    console.log({
      institutionId: docVerif.institutionId,
      applicationRef: docVerif.applicationRef,
      documentName: docVerif.documentName,
      status: docVerif.status,
      remarks: docVerif.remarks,
      decisionDate: docVerif.decisionDate,
      employeeUserId: docVerif.employeeUserId,
    });
  } else {
    console.error('FAIL: DocumentVerification record not found or incorrect:', docVerif);
  }

  console.log('\n--- TEST 3: Duplicate avoidance on repeated action ---');
  const countBefore = await DocumentVerification.countDocuments({
    applicationId: app._id,
    $or: [{ documentId: targetDoc.id }, { documentPath: targetDoc.fileName }],
  });
  const notifBefore = await Notification.countDocuments({
    collegeId: app.collegeId,
    type: 'DOCUMENT_NOT_VERIFIED',
    'metadata.docId': targetDoc.id,
  });

  // Re-save with same remark
  await fetch(`http://localhost:5000/api/fd/application/${app.applicationId}/verify-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: fdCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({
      docId: targetDoc.id,
      status: 'Not Verified',
      remarks: testRemark,
    }),
  });

  const countAfter = await DocumentVerification.countDocuments({
    applicationId: app._id,
    $or: [{ documentId: targetDoc.id }, { documentPath: targetDoc.fileName }],
  });
  const notifAfter = await Notification.countDocuments({
    collegeId: app.collegeId,
    type: 'DOCUMENT_NOT_VERIFIED',
    'metadata.docId': targetDoc.id,
  });

  if (countBefore === countAfter && notifBefore === notifAfter) {
    console.log('PASS: No duplicate records created on repeated action.');
  } else {
    console.error('FAIL: Duplicate records detected. Doc count:', countBefore, '->', countAfter, 'Notif count:', notifBefore, '->', notifAfter);
  }

  console.log('\n--- TEST 4: Institution-specific retrieval for CLG-2026-000009 ---');
  const inst1Res = await fetch('http://localhost:5000/api/institution/receive/document-deficiencies', {
    headers: { Cookie: inst1Cookie },
  });
  const inst1Data = await inst1Res.json();
  const foundDeficiency = (inst1Data.deficiencies || []).find(d => d.documentId === targetDoc.id || d.documentName === targetDoc.name);

  if (inst1Res.status === 200 && foundDeficiency) {
    console.log('PASS: Institution retrieved its rejected document:');
    console.log({
      applicationRef: foundDeficiency.applicationRef,
      applicationType: foundDeficiency.applicationType,
      documentName: foundDeficiency.documentName,
      verificationStatus: foundDeficiency.verificationStatus,
      remarks: foundDeficiency.remarks,
      decisionDate: foundDeficiency.decisionDate,
      fileUrl: foundDeficiency.fileUrl,
    });
  } else {
    console.error('FAIL: Institution failed to retrieve deficiency:', inst1Res.status, inst1Data);
  }

  console.log('\n--- TEST 5: Cross-institution isolation (tenant isolation) ---');
  const inst2Res = await fetch('http://localhost:5000/api/institution/receive/document-deficiencies', {
    headers: { Cookie: inst2Cookie },
  });
  const inst2Data = await inst2Res.json();
  const leakedDeficiency = (inst2Data.deficiencies || []).find(d => d.applicationRef === app.applicationId);

  if (inst2Res.status === 200 && !leakedDeficiency) {
    console.log('PASS: Other institution (Sakthi) cannot see Bannari Amman deficiency remarks.');
  } else {
    console.error('FAIL: Leak detected! Sakthi saw:', leakedDeficiency);
  }

  console.log('\n--- TEST 6: Submitted document preview & access control ---');
  if (targetDoc.fileName) {
    // Institution 1 (owner) preview
    const previewOwnerRes = await fetch(`http://localhost:5000/api/institution/files/${targetDoc.fileName}`, {
      headers: { Cookie: inst1Cookie },
    });
    console.log('Owner preview status:', previewOwnerRes.status, `(Expected 200)`);

    // Institution 2 (non-owner) access attempt
    const previewOtherRes = await fetch(`http://localhost:5000/api/institution/files/${targetDoc.fileName}`, {
      headers: { Cookie: inst2Cookie },
    });
    console.log('Other institution preview status:', previewOtherRes.status, `(Expected 403 Forbidden)`);

    if (previewOwnerRes.status === 200 && previewOtherRes.status === 403) {
      console.log('PASS: Document preview authorized for owner and denied (403) for other institution.');
    } else {
      console.error('FAIL: Preview authorization discrepancy.');
    }
  }

  console.log('\n--- TEST 7: Notification synchronization ---');
  const notifRes = await fetch('http://localhost:5000/api/institution/notifications', {
    headers: { Cookie: inst1Cookie },
  });
  const notifData = await notifRes.json();
  const matchedNotif = (notifData.notifications || []).find(n => n.type === 'DOCUMENT_NOT_VERIFIED' && n.metadata?.docId === targetDoc.id);

  if (matchedNotif) {
    console.log('PASS: Institution received notification:', {
      title: matchedNotif.title,
      message: matchedNotif.message,
      link: matchedNotif.link,
      read: matchedNotif.read,
    });
  } else {
    console.error('FAIL: Notification not found in institution notification feed.');
  }

  console.log('\n--- TEST 8: Existing Complaint Outcome Letters preservation ---');
  const lettersRes = await fetch('http://localhost:5000/api/institution/receive/complaint-letters', {
    headers: { Cookie: inst1Cookie },
  });
  const lettersData = await lettersRes.json();
  if (lettersRes.status === 200 && Array.isArray(lettersData.letters)) {
    console.log(`PASS: Complaint letters API operational. Returned ${lettersData.letters.length} outcome letters.`);
  } else {
    console.error('FAIL: Complaint letters endpoint failed:', lettersRes.status, lettersData);
  }

  // Cleanup test session keys
  await sessionsColl.deleteMany({ _id: { $in: [fdSessionId, inst1SessionId, inst2SessionId] } });
  await mongoose.disconnect();
  console.log('\nEnd-to-End Test Completed Successfully!');
}

run().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
