import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  profileId: {
    type: String,
    unique: true,
    sparse: true
  },
  displayName: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  watchlist: [{
    animeId: { type: String, required: true },
    title: { type: String, required: true },
    coverImage: { type: String },
    status: { type: String, default: 'Planning' }, // Watching, Completed, On-Hold, Dropped, Planning
    progress: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    addedAt: { type: Date, default: Date.now }
  }],
  continueWatching: [{
    animeId: { type: String, required: true },
    episode: { type: Number, required: true },
    time: { type: Number, required: true },
    totalTime: { type: Number },
    title: { type: String },
    coverImage: { type: String },
    lastUpdated: { type: Date, default: Date.now }
  }],
  lastActive: {
    type: Date,
    default: Date.now
  },
  anilist: {
    id: Number,
    username: String,
    accessToken: String
  },
  banUntil: {
    type: Date,
    default: null
  },
  bannedByRole: {
    type: String,
    default: null
  },
  aiInsultStrikes: {
    type: Number,
    default: 0
  },
  aiBanUntil: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Generate profileId if it's missing
  if (!this.profileId) {
    let generatedId;
    let isUnique = false;
    while (!isUnique) {
      generatedId = crypto.randomBytes(4).toString('hex');
      const existing = await mongoose.models.User.findOne({ profileId: generatedId });
      isUnique = !existing;
    }
    this.profileId = generatedId;
  }
  
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
