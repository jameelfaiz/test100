import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';

(async () => {
  try {
    await mongoose.connect(uri);
    const coll = mongoose.connection.collection('applications');
    const count = await coll.countDocuments();
    console.log('Application count:', count);
    const apps = await coll.find().limit(5).toArray();
    console.log('Sample applications:', JSON.stringify(apps, null, 2));
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
