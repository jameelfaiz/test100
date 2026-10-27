import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from './src/models/User.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';

(async () => {
  await mongoose.connect(uri);
  const user = await User.findOne({ userId: 'fd_emp' }).exec();
  if (!user) {
    console.error('FD user not found');
    process.exit(1);
  }
  const newHash = await bcrypt.hash('fdpassword123', 12);
  user.passwordHash = newHash;
  await user.save();
  console.log('Password reset for fd_emp');
  process.exit(0);
})();
