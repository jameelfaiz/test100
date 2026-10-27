import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../../src/models/User';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';
const NEW_PASSWORD = 'fd_test_pass';
const BCRYPT_ROUNDS = 12;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const user = await User.findOne({ userId: 'fd_emp' }).exec();
    if (!user) {
      console.error('FD employee user not found');
      process.exit(1);
    }
    const hash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_ROUNDS);
    user.passwordHash = hash;
    await user.save();
    console.log('FD employee password reset to known test password');
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error resetting FD password:', e);
    process.exit(1);
  }
})();
