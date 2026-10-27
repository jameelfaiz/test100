import mongoose from 'mongoose';
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aicte_unified');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({ role: 'INSTITUTION' }, { userId: 1, collegeId: 1, username: 1, email: 1 }).lean();
  console.log('Institution users:', users);
  await mongoose.disconnect();
}
run();
