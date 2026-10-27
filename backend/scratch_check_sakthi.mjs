import mongoose from 'mongoose';

async function checkInsts() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const insts = await mongoose.connection.db.collection('institutions').find({
    $or: [{ name: /sakthi/i }, { name: /bannari/i }, { collegeId: /sakthi/i }, { collegeId: /bannari/i }]
  }).toArray();
  console.log('Matching institutions:');
  console.log(JSON.stringify(insts, null, 2));

  const users = await mongoose.connection.db.collection('users').find({
    $or: [{ userId: /sakthi/i }, { userId: /bannari/i }]
  }).toArray();
  console.log('Matching users:');
  console.log(JSON.stringify(users, null, 2));

  await mongoose.disconnect();
}
checkInsts();
