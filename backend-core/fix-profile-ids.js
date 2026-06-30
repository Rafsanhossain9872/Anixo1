
import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const fixProfileIds = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find users without profileId
    const usersWithoutProfileId = await User.find({ profileId: { $exists: false } });
    console.log(`Found ${usersWithoutProfileId.length} users without profileId`);

    for (const user of usersWithoutProfileId) {
      let generatedId;
      let isUnique = false;
      while (!isUnique) {
        generatedId = crypto.randomBytes(4).toString('hex');
        const existing = await User.findOne({ profileId: generatedId });
        isUnique = !existing;
      }
      await User.findOneAndUpdate(
        { _id: user._id },
        { $set: { profileId: generatedId } },
        { new: true }
      );
      console.log(`Generated profileId for ${user.username}: ${generatedId}`);
    }

    console.log('All users have profileId now!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing profile IDs:', error);
    process.exit(1);
  }
};

fixProfileIds();
