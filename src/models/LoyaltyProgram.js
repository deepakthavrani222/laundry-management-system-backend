const mongoose = require('mongoose');

const loyaltyTierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  minSpend: {
    type: Number,
    default: 0
  },
  minOrders: {
    type: Number,
    default: 0
  },
  benefits: {
    pointsMultiplier: { type: Number, default: 1 }, // 1x, 1.5x, 2x points
    discountPercentage: { type: Number, default: 0 },
    freeDelivery: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    exclusiveOffers: { type: Boolean, default: false },
    birthdayBonus: { type: Number, default: 0 }, // Extra points on birthday
    customBenefits: [{ type: String }] // Custom text benefits
  },
  color: {
    type: String,
    default: '#6B7280' // Tailwind gray-500
  },
  icon: {
    type: String,
    default: 'star'
  }
}, { _id: false });

const loyaltyProgramSchema = new mongoose.Schema({
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
  
  // Program Type
  type: {
    type: String,
    enum: ['points', 'tiered', 'punch_card', 'cashback', 'subscription'],
    required: true
  },
  
  // Points Configuration (for points-based programs)
  pointsConfig: {
    earningRate: { type: Number, default: 1 }, // Points per dollar spent
    redemptionRate: { type: Number, default: 100 }, // Points needed for $1 credit
    bonusActions: [{
      action: { 
        type: String, 
        enum: ['first_order', 'review', 'referral', 'birthday', 'social_share', 'app_download'] 
      },
      points: { type: Number, required: true },
      description: { type: String }
    }],
    pointsExpiry: { type: Number, default: 365 }, // Days until points expire
    minRedemption: { type: Number, default: 100 } // Minimum points to redeem
  },
  
  // Tier Configuration (for tiered programs)
  tiers: [loyaltyTierSchema],
  tierResetPeriod: {
    type: String,
    enum: ['never', 'annual', 'rolling_12_months'],
    default: 'annual'
  },
  
  // Punch Card Configuration
  punchCardConfig: {
    punchesRequired: { type: Number, default: 10 },
    reward: {
      type: { 
        type: String, 
        enum: ['free_service', 'discount', 'credit'] 
      },
      value: { type: Number },
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' }
    },
    punchCriteria: {
      type: String,
      enum: ['per_order', 'per_dollar', 'per_item'],
      default: 'per_order'
    },
    dollarsPerPunch: { type: Number, default: 1 },
    itemsPerPunch: { type: Number, default: 1 }
  },
  
  // Cashback Configuration
  cashbackConfig: {
    percentage: { type: Number, default: 5 },
    maxCashbackPerOrder: { type: Number, default: 0 }, // 0 = no limit
    minOrderForCashback: { type: Number, default: 0 },
    cashbackExpiry: { type: Number, default: 365 } // Days
  },
  
  // Subscription Configuration
  subscriptionConfig: {
    monthlyFee: { type: Number, required: true },
    benefits: {
      unlimitedWashes: { type: Boolean, default: false },
      maxWashesPerMonth: { type: Number, default: 0 },
      discountPercentage: { type: Number, default: 0 },
      freeDelivery: { type: Boolean, default: false },
      priorityBooking: { type: Boolean, default: false }
    }
  },
  
  // General Settings
  autoEnrollment: {
    type: Boolean,
    default: true
  },
  welcomeBonus: {
    points: { type: Number, default: 0 },
    credit: { type: Number, default: 0 }
  },
  
  // Validity
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Analytics
  totalMembers: {
    type: Number,
    default: 0
  },
  activeMembers: {
    type: Number,
    default: 0
  },
  totalPointsIssued: {
    type: Number,
    default: 0
  },
  totalPointsRedeemed: {
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

const loyaltyMemberSchema = new mongoose.Schema({
  // Multi-tenancy support
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: true,
    index: true
  },
  
  // Program and User
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoyaltyProgram',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Points Balance
  pointsBalance: {
    type: Number,
    default: 0
  },
  lifetimePoints: {
    type: Number,
    default: 0
  },
  redeemedPoints: {
    type: Number,
    default: 0
  },
  
  // Tier Information
  currentTier: {
    name: { type: String },
    level: { type: Number, default: 0 }
  },
  tierProgress: {
    currentSpend: { type: Number, default: 0 },
    currentOrders: { type: Number, default: 0 },
    nextTierSpend: { type: Number, default: 0 },
    nextTierOrders: { type: Number, default: 0 }
  },
  tierHistory: [{
    tierName: { type: String },
    achievedAt: { type: Date },
    spendAtAchievement: { type: Number },
    ordersAtAchievement: { type: Number }
  }],
  
  // Punch Card Progress
  punchCard: {
    currentPunches: { type: Number, default: 0 },
    completedCards: { type: Number, default: 0 },
    lastPunchDate: { type: Date }
  },
  
  // Cashback Balance
  cashbackBalance: {
    type: Number,
    default: 0
  },
  
  // Subscription Status (for subscription programs)
  subscription: {
    isActive: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    autoRenew: { type: Boolean, default: true },
    washesUsedThisMonth: { type: Number, default: 0 },
    lastBillingDate: { type: Date },
    nextBillingDate: { type: Date }
  },
  
  // Activity Tracking
  totalSpent: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  
  // Enrollment
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  enrollmentSource: {
    type: String,
    enum: ['auto', 'manual', 'first_order', 'referral'],
    default: 'auto'
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Preferences
  notifications: {
    pointsEarned: { type: Boolean, default: true },
    tierUpgrade: { type: Boolean, default: true },
    rewardAvailable: { type: Boolean, default: true },
    pointsExpiring: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

const loyaltyTransactionSchema = new mongoose.Schema({
  // Multi-tenancy support
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: true,
    index: true
  },
  
  // References
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoyaltyMember',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  // Transaction Details
  type: {
    type: String,
    enum: ['earned', 'redeemed', 'expired', 'adjusted', 'bonus'],
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Earning Details
  earningSource: {
    type: String,
    enum: ['purchase', 'bonus', 'referral', 'review', 'birthday', 'welcome', 'adjustment']
  },
  orderValue: { type: Number },
  
  // Redemption Details
  redemptionType: {
    type: String,
    enum: ['credit', 'discount', 'free_service', 'cashback']
  },
  redemptionValue: { type: Number },
  
  // Expiry
  expiresAt: { type: Date },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Indexes
loyaltyProgramSchema.index({ tenancy: 1, isActive: 1 });
loyaltyProgramSchema.index({ isGlobal: 1, isActive: 1 });
loyaltyProgramSchema.index({ type: 1 });

loyaltyMemberSchema.index({ tenancy: 1, user: 1 });
loyaltyMemberSchema.index({ program: 1, user: 1 }, { unique: true });
loyaltyMemberSchema.index({ 'currentTier.level': -1 });
loyaltyMemberSchema.index({ pointsBalance: -1 });

loyaltyTransactionSchema.index({ tenancy: 1, member: 1 });
loyaltyTransactionSchema.index({ type: 1, createdAt: -1 });
loyaltyTransactionSchema.index({ expiresAt: 1 });

// Methods for LoyaltyProgram
loyaltyProgramSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startDate && 
         (!this.endDate || now <= this.endDate);
};

loyaltyProgramSchema.methods.calculatePointsForOrder = function(orderValue) {
  if (this.type !== 'points') return 0;
  return Math.floor(orderValue * this.pointsConfig.earningRate);
};

loyaltyProgramSchema.methods.calculatePunchesForOrder = function(order) {
  if (this.type !== 'punch_card') return 0;
  
  const { punchCriteria, dollarsPerPunch, itemsPerPunch } = this.punchCardConfig;
  
  switch (punchCriteria) {
    case 'per_order':
      return 1;
    case 'per_dollar':
      return Math.floor(order.totalAmount / dollarsPerPunch);
    case 'per_item':
      return Math.floor(order.items.length / itemsPerPunch);
    default:
      return 0;
  }
};

// Methods for LoyaltyMember
loyaltyMemberSchema.methods.addPoints = async function(points, source, order = null) {
  this.pointsBalance += points;
  this.lifetimePoints += points;
  this.lastActivity = new Date();
  
  // Create transaction record
  const LoyaltyTransaction = mongoose.model('LoyaltyTransaction');
  await LoyaltyTransaction.create({
    tenancy: this.tenancy,
    member: this._id,
    order: order?._id,
    type: 'earned',
    points: points,
    description: `Points earned from ${source}`,
    earningSource: source,
    orderValue: order?.totalAmount,
    expiresAt: this.calculatePointsExpiry()
  });
  
  await this.save();
  await this.checkTierUpgrade();
};

loyaltyMemberSchema.methods.redeemPoints = async function(points, redemptionType, value) {
  if (this.pointsBalance < points) {
    throw new Error('Insufficient points balance');
  }
  
  this.pointsBalance -= points;
  this.redeemedPoints += points;
  this.lastActivity = new Date();
  
  // Create transaction record
  const LoyaltyTransaction = mongoose.model('LoyaltyTransaction');
  await LoyaltyTransaction.create({
    tenancy: this.tenancy,
    member: this._id,
    type: 'redeemed',
    points: -points,
    description: `Points redeemed for ${redemptionType}`,
    redemptionType: redemptionType,
    redemptionValue: value
  });
  
  await this.save();
};

loyaltyMemberSchema.methods.addPunches = async function(punches, order) {
  const program = await mongoose.model('LoyaltyProgram').findById(this.program);
  if (!program || program.type !== 'punch_card') return;
  
  this.punchCard.currentPunches += punches;
  this.punchCard.lastPunchDate = new Date();
  
  // Check if card is complete
  if (this.punchCard.currentPunches >= program.punchCardConfig.punchesRequired) {
    this.punchCard.completedCards += 1;
    this.punchCard.currentPunches = 0;
    
    // Give reward
    await this.givePunchCardReward(program.punchCardConfig.reward);
  }
  
  await this.save();
};

loyaltyMemberSchema.methods.givePunchCardReward = async function(reward) {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  
  switch (reward.type) {
    case 'credit':
      if (!user.wallet) user.wallet = { balance: 0 };
      user.wallet.balance += reward.value;
      await user.save();
      break;
      
    case 'free_service':
      // Create a coupon for free service
      const Coupon = mongoose.model('Coupon');
      await Coupon.create({
        tenancy: this.tenancy,
        code: `PUNCH${Date.now()}`,
        name: 'Punch Card Reward - Free Service',
        type: 'fixed_amount',
        value: 999999, // Large value to cover any service
        usageLimit: 1,
        perUserLimit: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        isActive: true,
        applicableUsers: [user._id],
        applicableServices: reward.serviceId ? [reward.serviceId] : []
      });
      break;
  }
};

loyaltyMemberSchema.methods.checkTierUpgrade = async function() {
  const program = await mongoose.model('LoyaltyProgram').findById(this.program);
  if (!program || program.type !== 'tiered') return;
  
  const currentTierLevel = this.currentTier.level || 0;
  let newTier = null;
  
  // Find the highest tier the user qualifies for
  for (let i = program.tiers.length - 1; i >= 0; i--) {
    const tier = program.tiers[i];
    if (this.totalSpent >= tier.minSpend && this.totalOrders >= tier.minOrders) {
      if (i > currentTierLevel) {
        newTier = { name: tier.name, level: i };
        break;
      }
    }
  }
  
  if (newTier) {
    this.currentTier = newTier;
    this.tierHistory.push({
      tierName: newTier.name,
      achievedAt: new Date(),
      spendAtAchievement: this.totalSpent,
      ordersAtAchievement: this.totalOrders
    });
    
    await this.save();
    
    // Send notification about tier upgrade
    // This would integrate with your notification system
  }
};

loyaltyMemberSchema.methods.calculatePointsExpiry = function() {
  const program = mongoose.model('LoyaltyProgram').findById(this.program);
  if (!program || !program.pointsConfig.pointsExpiry) return null;
  
  return new Date(Date.now() + program.pointsConfig.pointsExpiry * 24 * 60 * 60 * 1000);
};

loyaltyMemberSchema.methods.updateActivity = async function(order) {
  this.totalSpent += order.totalAmount;
  this.totalOrders += 1;
  this.lastActivity = new Date();
  
  // Update tier progress
  const program = await mongoose.model('LoyaltyProgram').findById(this.program);
  if (program && program.type === 'tiered') {
    this.tierProgress.currentSpend = this.totalSpent;
    this.tierProgress.currentOrders = this.totalOrders;
    
    // Find next tier requirements
    const currentLevel = this.currentTier.level || 0;
    const nextTier = program.tiers[currentLevel + 1];
    if (nextTier) {
      this.tierProgress.nextTierSpend = nextTier.minSpend;
      this.tierProgress.nextTierOrders = nextTier.minOrders;
    }
  }
  
  await this.save();
};

const LoyaltyProgram = mongoose.model('LoyaltyProgram', loyaltyProgramSchema);
const LoyaltyMember = mongoose.model('LoyaltyMember', loyaltyMemberSchema);
const LoyaltyTransaction = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);

module.exports = { LoyaltyProgram, LoyaltyMember, LoyaltyTransaction };