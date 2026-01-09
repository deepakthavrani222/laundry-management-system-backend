const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  // Basic Campaign Info
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Campaign Ownership & Scope (Key Feature from campaign.md)
  campaignScope: {
    type: String,
    enum: ['TENANT', 'GLOBAL', 'TEMPLATE'],
    required: true
  },
  
  // Creator Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'createdByModel'
  },
  createdByModel: {
    type: String,
    required: true,
    enum: ['User', 'SuperAdmin']
  },
  
  // Tenancy Association
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: function() {
      return this.campaignScope === 'TENANT';
    }
  },
  
  // For Global Campaigns - which tenancies it applies to
  applicableTenancies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy'
  }],
  
  // Campaign Timing
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Campaign Priority (for selection logic)
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Campaign Status
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT'
  },
  
  // Approval Workflow
  approvalRequired: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  approvedAt: Date,
  
  // Campaign Triggers
  triggers: {
    type: [{
      type: {
        type: String,
        enum: ['ORDER_CHECKOUT', 'USER_REGISTRATION', 'TIME_BASED', 'BEHAVIOR_BASED'],
        required: true
      },
      conditions: {
        minOrderValue: Number,
        dayOfWeek: [String], // ['monday', 'tuesday', etc.]
        timeRange: {
          start: String, // '09:00'
          end: String    // '17:00'
        },
        userSegment: String,
        behaviorType: String
      }
    }],
    default: [{ type: 'ORDER_CHECKOUT' }]
  },
  
  // Audience Targeting
  audience: {
    targetType: {
      type: String,
      enum: ['ALL_USERS', 'NEW_USERS', 'EXISTING_USERS', 'SEGMENT', 'CUSTOM'],
      default: 'ALL_USERS'
    },
    userSegments: [String],
    customFilters: {
      minOrderCount: Number,
      maxOrderCount: Number,
      minTotalSpent: Number,
      maxTotalSpent: Number,
      lastOrderDays: Number,
      registrationDays: Number
    }
  },
  
  // Attached Promotions
  promotions: [{
    type: {
      type: String,
      enum: ['DISCOUNT', 'COUPON', 'LOYALTY_POINTS', 'WALLET_CREDIT'],
      required: true
    },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'promotions.promotionModel'
    },
    promotionModel: {
      type: String,
      required: true,
      enum: ['Discount', 'Coupon', 'LoyaltyProgram']
    },
    // Override promotion settings for this campaign
    overrides: {
      value: Number,
      maxDiscount: Number,
      minOrderValue: Number
    }
  }],
  
  // Budget Management
  budget: {
    type: {
      type: String,
      enum: ['UNLIMITED', 'FIXED_AMOUNT', 'PER_USER', 'PERCENTAGE_OF_REVENUE'],
      default: 'UNLIMITED'
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    spentAmount: {
      type: Number,
      default: 0
    },
    perUserLimit: {
      type: Number,
      default: 0
    },
    budgetSource: {
      type: String,
      enum: ['TENANT_BUDGET', 'PLATFORM_BUDGET', 'SHARED_SPLIT'],
      default: function() {
        return this.campaignScope === 'TENANT' ? 'TENANT_BUDGET' : 'PLATFORM_BUDGET';
      }
    }
  },
  
  // Usage Limits
  limits: {
    totalUsageLimit: {
      type: Number,
      default: 0 // 0 = unlimited
    },
    perUserLimit: {
      type: Number,
      default: 1
    },
    dailyLimit: {
      type: Number,
      default: 0 // 0 = unlimited
    },
    usedCount: {
      type: Number,
      default: 0
    }
  },
  
  // Stacking Rules
  stacking: {
    allowStackingWithCoupons: {
      type: Boolean,
      default: false
    },
    allowStackingWithDiscounts: {
      type: Boolean,
      default: false
    },
    allowStackingWithLoyalty: {
      type: Boolean,
      default: true
    },
    stackingPriority: {
      type: Number,
      default: 0
    }
  },
  
  // Performance Tracking
  analytics: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    totalSavings: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    uniqueUsers: {
      type: Number,
      default: 0
    }
  },
  
  // Template-specific fields
  isTemplate: {
    type: Boolean,
    default: function() {
      return this.campaignScope === 'TEMPLATE';
    }
  },
  templateCategory: {
    type: String,
    enum: ['SEASONAL', 'PROMOTIONAL', 'RETENTION', 'ACQUISITION', 'LOYALTY'],
    required: function() {
      return this.campaignScope === 'TEMPLATE';
    }
  },
  
  // Auto-approval rules
  autoApprovalRules: {
    maxBudget: Number,
    maxDiscountPercentage: Number,
    requiresApproval: {
      type: Boolean,
      default: function() {
        return this.campaignScope === 'GLOBAL';
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
campaignSchema.index({ campaignScope: 1, status: 1 });
campaignSchema.index({ tenancy: 1, status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ 'triggers.type': 1 });
campaignSchema.index({ createdBy: 1, createdByModel: 1 });

// Virtual for checking if campaign is active
campaignSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'ACTIVE' && 
         this.startDate <= now && 
         this.endDate >= now;
});

// Virtual for budget utilization percentage
campaignSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.type === 'UNLIMITED' || this.budget.totalAmount === 0) {
    return 0;
  }
  return (this.budget.spentAmount / this.budget.totalAmount) * 100;
});

// Virtual for conversion rate
campaignSchema.virtual('conversionRate').get(function() {
  if (this.analytics.impressions === 0) return 0;
  return (this.analytics.conversions / this.analytics.impressions) * 100;
});

// Pre-save middleware for validation
campaignSchema.pre('save', function(next) {
  // Validate date range
  if (this.startDate >= this.endDate) {
    return next(new Error('End date must be after start date'));
  }
  
  // Validate tenancy for tenant campaigns
  if (this.campaignScope === 'TENANT' && !this.tenancy) {
    return next(new Error('Tenant campaigns must have a tenancy assigned'));
  }
  
  // Validate global campaigns
  if (this.campaignScope === 'GLOBAL' && this.applicableTenancies.length === 0) {
    return next(new Error('Global campaigns must specify applicable tenancies'));
  }
  
  // Auto-set approval requirement for high-impact campaigns
  if (this.campaignScope === 'GLOBAL' || 
      (this.budget.totalAmount > 1000) || 
      (this.promotions.some(p => p.overrides && p.overrides.value > 50))) {
    this.approvalRequired = true;
  }
  
  next();
});

// Static method to find active campaigns for a user/tenancy
campaignSchema.statics.findActiveCampaigns = function(tenancyId, triggerType = 'ORDER_CHECKOUT') {
  const now = new Date();
  
  return this.find({
    $or: [
      // Tenant campaigns for this tenancy
      { 
        campaignScope: 'TENANT',
        tenancy: tenancyId
      },
      // Global campaigns that apply to this tenancy
      {
        campaignScope: 'GLOBAL',
        $or: [
          { applicableTenancies: tenancyId },
          { applicableTenancies: { $size: 0 } } // Empty array means all tenancies
        ]
      }
    ],
    status: 'ACTIVE',
    startDate: { $lte: now },
    endDate: { $gte: now },
    'triggers.type': triggerType
  }).populate('promotions.promotionId')
    .sort({ 
      campaignScope: 1, // TENANT campaigns first (as per campaign.md)
      priority: -1,     // Higher priority first
      createdAt: 1      // Older campaigns first for tie-breaking
    });
};

// Instance method to check if user is eligible
campaignSchema.methods.isUserEligible = function(user, orderData = {}) {
  // Check usage limits
  if (this.limits.totalUsageLimit > 0 && this.limits.usedCount >= this.limits.totalUsageLimit) {
    return false;
  }
  
  // Check budget
  if (this.budget.type !== 'UNLIMITED' && this.budget.spentAmount >= this.budget.totalAmount) {
    return false;
  }
  
  // Check audience targeting
  if (this.audience.targetType === 'NEW_USERS' && user.orderCount > 0) {
    return false;
  }
  
  if (this.audience.targetType === 'EXISTING_USERS' && user.orderCount === 0) {
    return false;
  }
  
  // Check custom filters
  const filters = this.audience.customFilters;
  if (filters) {
    if (filters.minOrderCount && user.orderCount < filters.minOrderCount) return false;
    if (filters.maxOrderCount && user.orderCount > filters.maxOrderCount) return false;
    if (filters.minTotalSpent && user.totalSpent < filters.minTotalSpent) return false;
    if (filters.maxTotalSpent && user.totalSpent > filters.maxTotalSpent) return false;
  }
  
  // Check trigger conditions
  const trigger = this.triggers.find(t => t.type === 'ORDER_CHECKOUT');
  if (trigger && trigger.conditions) {
    if (trigger.conditions.minOrderValue && orderData.total < trigger.conditions.minOrderValue) {
      return false;
    }
  }
  
  return true;
};

// Instance method to calculate campaign benefit for user
campaignSchema.methods.calculateBenefit = function(orderData = {}) {
  let totalBenefit = 0;
  
  this.promotions.forEach(promotion => {
    switch (promotion.type) {
      case 'DISCOUNT':
        // Calculate discount benefit based on promotion rules
        const discountValue = promotion.overrides?.value || promotion.promotionId.rules[0]?.value || 0;
        if (promotion.promotionId.rules[0]?.type === 'percentage') {
          totalBenefit += (orderData.total * discountValue / 100);
        } else {
          totalBenefit += discountValue;
        }
        break;
      case 'COUPON':
        const couponValue = promotion.overrides?.value || promotion.promotionId.value || 0;
        if (promotion.promotionId.type === 'percentage') {
          totalBenefit += (orderData.total * couponValue / 100);
        } else {
          totalBenefit += couponValue;
        }
        break;
      case 'WALLET_CREDIT':
        totalBenefit += promotion.overrides?.value || 10; // Default credit
        break;
    }
  });
  
  return totalBenefit;
};

module.exports = mongoose.model('Campaign', campaignSchema);