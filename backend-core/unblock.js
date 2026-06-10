import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

async function unblock() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");
    const res = await User.updateMany({}, { 
      $set: { aiInsultStrikes: 0, aiBanUntil: null },
      $unset: { isAiBlocked: "" } // Also unset the old field just in case
    });
    console.log(`Successfully reset strikes and unblocked ${res.modifiedCount} users!`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

unblock();
