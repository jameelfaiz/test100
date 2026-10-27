const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';
const NEW_PASSWORD = 'fd_test_pass';
const SALT_ROUNDS = 12;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const Users = mongoose.connection.collection('users'); // collection name derived from model
    const hash = await bcrypt.hash(NEW_PASSWORD, SALT_ROUNDS);
    const result = await Users.updateOne({ userId: 'fd_emp' }, { $set: { passwordHash: hash } });
    console.log('Password reset result:', result.modifiedCount);
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error resetting password:', e);
    process.exit(1);
  }
})();
