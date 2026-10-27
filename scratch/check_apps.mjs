import mongoose from 'mongoose';
import { Application } from '../backend/src/models/Application.js';
import { Institution } from '../backend/src/models/Institution.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicte_unified';

(async () => {
  try {
    await mongoose.connect(uri);
    const appCount = await Application.countDocuments();
    console.log('Total applications in DB:', appCount);
    const apps = await Application.find().limit(5).lean();
    console.log('Sample applications:', apps);
    const instCount = await Institution.countDocuments();
    console.log('Total institutions:', instCount);
    const institutions = await Institution.find().limit(5).lean();
    console.log('Sample institutions:', institutions);
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
