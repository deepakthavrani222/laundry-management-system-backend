const mongoose = require('mongoose');
const crypto = require('crypto');

const referralRewardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'coupon', 'discount', 'points', 'free_service'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  // For coupon rewards
  couponCode: { type: String },
  // For service rewards
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  // For points rewards
  pointsType: { type: String, enum: ['loyalty', 'referral'] }
}, { _id: false });

const referralProgramSchema = new mongoose.Schema({
  // Multi-tenancy support
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: true,
    index: true
  },
  
  // Global programs (created by superadmin)
  isGlobal: {
    type: Boolean,
    default: false
  },
  
  // Applicable tenancies for global programs
  applicableTenancies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy'
  }],
  
  // Program Details
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Rewards
  referrerReward: referralRewardSchema,
  refereeReward: referralRewardSchema,
  
  // Conditions
  minOrderValue: {
    type: Number,
    default: 0
  },
  maxReferralsPerUser: {
    type: Number,
    default: 0 // 0 = unlimited
  },
  referralCodeExpiry: {
    type: Number,
    default: 30 // days
  },
  
  // Multi-level referrals
  enableMultiLevel: {
    type: Boolean,
    default: false
  },
  maxLevels: {
    type: Number,
    default: 1
  },
  levelRewards: [{
    level: { type: Number, required: true },
    reward: referralRewardSchema
  }],
  
  // Validity
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Analytics
  totalReferrals: {
    type: Number,
    default: 0
  },
  successfulReferrals: {
    type: Number,
    default: 0
  },
  totalRewardsGiven: {
    type: Number,
    default: 0
  },
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByModel'
  },
  createdByModel: {
    type: String,
    enum: ['User', 'SuperAdmin']
  }
}, {
  timestamps: true
});

const referralSchema = new mongoose.Schema({
  // Multi-tenancy support
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: true,
    index: true
  },
  
  // Program reference
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReferralProgram',
    required: true
  },
  
  // Referrer (existing customer)
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Referee (new customer)
  referee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Referral Code
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Referral Link
  link: {
    type: String,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired', 'cancelled'],
    default: 'pending'
  },
  
  // Tracking
  clicks: {
    type: Number,
    default: 0
  },
  signups: {
    type: Number,
    default: 0
  },
  conversions: {
    type: Number,
    default: 0
  },
  
  // Completion details
  completedAt: { type: Date },
  firstOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  firstOrderValue: { type: Number },
  
  // Rewards given
  referrerRewardGiven: {
    type: Boolean,
    default: false
  },
  refereeRewardGiven: {
    type: Boolean,
    default: false
  },
  rewardDetails: {
    referrerReward: {
      type: { type: String },
      value: { type: Number },
      transactionId: { type: String }
    },
    refereeReward: {
      type: { type: String },
      value: { type: Number },
      transactionId: { type: String }
    }
  },
  
  // Expiry
  expiresAt: {
    type: Date,
    required: true
  },
  
  // Multi-level tracking
  parentReferral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral'
  },
  level: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes
referralProgramSchema.index({ tenancy: 1, isActive: 1 });
referralProgramSchema.index({ isGlobal: 1, isActive: 1 });
referralProgramSchema.index({ startDate: 1, endDate: 1 });

referralSchema.index({ tenancy: 1, referrer: 1 });
referralSchema.index({ code: 1 }, { unique: true });
referralSchema.index({ status: 1 });
referralSchema.index({ expiresAt: 1 });

// Methods for ReferralProgram
referralProgramSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startDate && 
         now <= this.endDate;
};

// Methods for Referral
referralSchema.methods.isValid = function() {
  const now = new Date();
  return this.status === 'pending' && now < this.expiresAt;
};

referralSchema.methods.generateCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

referralSchema.methods.generateLink = function(baseUrl) {
  return `${baseUrl}/signup?ref=${this.code}`;
};

referralSchema.methods.recordClick = async function() {
  this.clicks += 1;
  await this.save();
};

referralSchema.methods.recordSignup = async function(newUser) {
  this.signups += 1;
  this.referee = newUser._id;
  await this.save();
};

referralSchema.methods.recordConversion = async function(order) {
  this.conversions += 1;
  this.status = 'completed';
  this.completedAt = new Date();
  this.firstOrderId = order._id;
  this.firstOrderValue = order.totalAmount;
  
  // Update program stats
  const program = await mongoose.model('ReferralProgram').findById(this.program);
  if (program) {
    program.successfulReferrals += 1;
    await program.save();
  }
  
  await this.save();
};

referralSchema.methods.giveRewards = async function() {
  const program = await mongoose.model('ReferralProgram').findById(this.program);
  if (!program) return;
  
  // Give referrer reward
  if (!this.referrerRewardGiven) {
    await this.giveReward('referrer', program.referrerReward);
    this.referrerRewardGiven = true;
  }
  
  // Give referee reward
  if (!this.refereeRewardGiven && this.referee) {
    await this.giveReward('referee', program.refereeReward);
    this.refereeRewardGiven = true;
  }
  
  await this.save();
};

referralSchema.methods.giveReward = async function(recipientType, reward) {
  const User = mongoose.model('User');
  const recipient = recipientType === 'referrer' ? 
    await User.findById(this.referrer) : 
    await User.findById(this.referee);
  
  if (!recipient) return;
  
  let transactionId = null;
  
  switch (reward.type) {
    case 'credit':
      // Add to user's wallet/credit balance
      if (!recipient.wallet) recipient.wallet = { balance: 0 };
      recipient.wallet.balance += reward.value;
      await recipient.save();
      transactionId = `CREDIT_${Date.now()}`;
      break;
      
    case 'points':
      // Add loyalty points
      if (!recipient.loyaltyPoints) recipient.loyaltyPoints = 0;
      recipient.loyaltyPoints += reward.value;
      await recipient.save();
      transactionId = `POINTS_${Date.now()}`;
      break;
      
    case 'coupon':
      // Create a coupon for the user
      const Coupon = mongoose.model('Coupon');
      const coupon = new Coupon({
        tenancy: this.tenancy,
        code: reward.couponCode || `REF${Date.now()}`,
        name: `Referral Reward - ${reward.value}% Off`,
        type: 'percentage',
        value: reward.value,
        usageLimit: 1,
        perUserLimit: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true,
        applicableUsers: [recipient._id]
      });
      await coupon.save();
      transactionId = coupon._id.toString();
      break;
  }
  
  // Record reward details
  if (recipientType === 'referrer') {
    this.rewardDetails.referrerReward = {
      type: reward.type,
      value: reward.value,
      transactionId
    };
  } else {
    this.rewardDetails.refereeReward = {
      type: reward.type,
      value: reward.value,
      transactionId
    };
  }
};

// Pre-save middleware to generate code and link
referralSchema.pre('save', function(next) {
  if (this.isNew && !this.code) {
    this.code = this.generateCode();
  }
  
  if (this.isNew && !this.link) {
    // This would need to be configured based on your domain setup
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    this.link = this.generateLink(baseUrl);
  }
  
  next();
});

const ReferralProgram = mongoose.model('ReferralProgram', referralProgramSchema);
const Referral = mongoose.model('Referral', referralSchema);

module.exports = { ReferralProgram, Referral };