import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../src/models/User';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';
const TEST_USER_ID = 'fd_test_user';
const TEST_PASSWORD = 'fd_test_pass';
const BCRYPT_ROUNDS = 12;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const existing = await User.findOne({ userId: TEST_USER_ID }).exec();
    if (existing) {
      console.log('Test FD user already exists.');
      await mongoose.disconnect();
      return;
    }
    const hash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
    await User.create({
      userId: TEST_USER_ID,
      passwordHash: hash,
      role: 'AICTE_FD_EMPLOYEE',
      accountStatus: 'ACTIVE',
      employeeId: TEST_USER_ID,
    });
    console.log('Created test FD user.');
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error creating test FD user:', e);
    process.exit(1);
  }
})();
