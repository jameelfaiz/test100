const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('./src/models/User');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';
const NEW_PASSWORD = 'Password123!';

(async () => {
  await mongoose.connect(uri);
  const user = await User.findOne({ userId: 'fd_emp' }).exec();
  if (!user) {
    console.error('FD user not found');
    process.exit(1);
  }
  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  user.passwordHash = hash;
  await user.save();
  console.log('FD password reset to', NEW_PASSWORD);
  process.exit(0);
})();
