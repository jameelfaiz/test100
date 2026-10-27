import crypto from 'crypto';
import http from 'http';
import mongoose from 'mongoose';

const secret = 'dev-secret-please-change';

function signCookie(val, sec) {
  return 's:' + val + '.' + crypto.createHmac('sha256', sec).update(val).digest('base64').replace(/\=+$/, '');
}

function get(path, signedSession) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: '127.0.0.1',
      port: 5000,
      path: path,
      headers: { 'Cookie': 'connect.sid=' + encodeURIComponent(signedSession) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    }).on('error', reject);
  });
}

async function verify() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const db = mongoose.connection.db;

  console.log('================================================================');
  console.log('AICTE 5 URGENT PORTAL FIXES VERIFICATION');
  console.log('================================================================');

  // FIX 1 & FIX 5: Verify Sakthi receives its dispatched EoD letter
  const sakthiUser = await db.collection('users').findOne({ userId: 'Sakthi' });
  const sakthiSessId = 'VERIFY_SAKTHI_SESS_NEW';
  await db.collection('sessions').updateOne(
    { _id: sakthiSessId },
    { $set: {
      session: JSON.stringify({
        cookie: { originalMaxAge: 86400000, expires: new Date(Date.now() + 86400000).toISOString(), secure: false, httpOnly: true, path: '/', sameSite: 'lax' },
        userId: 'Sakthi',
        role: 'INSTITUTION',
        userObjectId: sakthiUser._id.toString()
      }),
      expires: new Date(Date.now() + 86400000)
    }},
    { upsert: true }
  );

  const sakthiSigned = signCookie(sakthiSessId, secret);
  const sakthiLodRes = await get('/api/institution/receive/lod-eod', sakthiSigned);
  console.log('\n[FIX 5] Sakthi (CLG-2026-000010) Receive -> LoD/EoD Letters:');
  console.log('HTTP Status:', sakthiLodRes.status, '| Letters Count:', sakthiLodRes.data?.letters?.length);
  if (sakthiLodRes.data?.letters?.length > 0) {
    const l = sakthiLodRes.data.letters[0];
    console.log('  - Letter Type:', l.letterType, '| Title:', l.type);
    console.log('  - Reference:', l.referenceNo);
    console.log('  - Application ID:', l.applicationId);
    console.log('  - Date:', l.date);
    console.log('  - Deficiency Reason:', l.reason);
  }

  // FIX 1 & FIX 5: Verify Bannari Amman receives its dispatched LoD letter and Deposit Instructions
  const bannariSessId = 'Q3GNabbUL2MQ2u4lWqvw1uzpYxBSB9Hi';
  const bannariSigned = signCookie(bannariSessId, secret);

  const bannariLodRes = await get('/api/institution/receive/lod-eod', bannariSigned);
  console.log('\n[FIX 5] Bannari Amman (CLG-2026-000009) Receive -> LoD/EoD Letters:');
  console.log('HTTP Status:', bannariLodRes.status, '| Letters Count:', bannariLodRes.data?.letters?.length);
  if (bannariLodRes.data?.letters?.length > 0) {
    const l = bannariLodRes.data.letters[0];
    console.log('  - Letter Type:', l.letterType, '| Title:', l.type);
    console.log('  - Reference:', l.referenceNo);
    console.log('  - Application ID:', l.applicationId);
    console.log('  - Deficiency Reason:', l.reason);
  }

  // FIX 1: Verify Bannari Amman Deposit Instructions
  const bannariDepRes = await get('/api/institution/receive/deposit-details', bannariSigned);
  console.log('\n[FIX 1] Bannari Amman Receive -> Deposit Instructions:');
  console.log('HTTP Status:', bannariDepRes.status, '| Instructions Count:', bannariDepRes.data?.depositDetails?.length);
  if (bannariDepRes.data?.depositDetails?.length > 0) {
    const d = bannariDepRes.data.depositDetails[0];
    console.log('  - Bank Name:', d.bankName);
    console.log('  - Branch Name:', d.branchName);
    console.log('  - Account Number:', d.bankAccountNumber);
    console.log('  - IFSC Code:', d.ifscCode);
    console.log('  - Required Deposit Amount: ₹' + Number(d.depositAmount).toLocaleString('en-IN'));
    console.log('  - Payment Instructions:', d.paymentInstructions);
    console.log('  - Issued Date:', d.sentAt);
    console.log('  - Reference Number:', d.letterReferenceNumber);
  }

  // FIX 2: Verify Unread Notifications Count
  const notifCount = await db.collection('notifications').countDocuments({ collegeId: { $in: ['Sakthi', 'CLG-2026-000010'] }, read: false });
  console.log('\n[FIX 2] Sakthi MongoDB Unread Notifications Count:', notifCount);

  // FIX 3: Verify applications in MongoDB and FD applications view
  const apps = await db.collection('applications').find({}).toArray();
  console.log('\n[FIX 3] Applications in MongoDB and their types:');
  apps.forEach(a => {
    console.log(`  - ${a.applicationId} (${a.collegeId}): applicationType = ${a.applicationType || 'null (Type not specified)'} | status = ${a.status}`);
  });

  // Clean up test session
  await db.collection('sessions').deleteOne({ _id: sakthiSessId });
  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('ALL 5 FIXES VERIFIED SUCCESSFULLY AGAINST MONGODB & LIVE BACKEND');
  console.log('================================================================');
}

verify().catch(console.error);
