const mongoose = require('mongoose');

const discountRuleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'tiered', 'conditional'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  // For tiered discounts
  tiers: [{
    minQuantity: { type: Number, default: 0 },
    minValue: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 }
  }],
  // Conditions for conditional discounts
  conditions: {
    timeOfDay: {
      startTime: { type: String }, // "09:00"
      endTime: { type: String }    // "17:00"
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sunday, 6=Saturday
    userType: {
      type: String,
      enum: ['all', 'new', 'returning', 'vip', 'senior']
    },
    minOrderValue: { type: Number, default: 0 },
    maxOrderValue: { type: Number, default: 0 },
    applicableServices: [{ type: String }],
    excludeServices: [{ type: String }],
    location: {
      branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
      radius: { type: Number }, // in km
      coordinates: {
        lat: { type: Number },
        lng: { type: Number }
      }
    }
  }
}, { _id: false });

const discountSchema = new mongoose.Schema({
  // Multi-tenancy support
  tenancy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy',
    required: true,
    index: true
  },
  
  // Global discounts (created by superadmin)
  isGlobal: {
    type: Boolean,
    default: false
  },
  
  // Applicable tenancies for global discounts
  applicableTenancies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenancy'
  }],
  
  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Discount Rules
  rules: [discountRuleSchema],
  
  // Priority (higher number = higher priority)
  priority: {
    type: Number,
    default: 0
  },
  
  // Stacking rules
  canStackWithCoupons: {
    type: Boolean,
    default: true
  },
  canStackWithOtherDiscounts: {
    type: Boolean,
    default: false
  },
  
  // Validity
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Usage limits
  usageLimit: {
    type: Number,
    default: 0 // 0 = unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  perUserLimit: {
    type: Number,
    default: 0 // 0 = unlimited per user
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Analytics
  totalSavings: {
    type: Number,
    default: 0
  },
  totalOrders: {
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
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'updatedByModel'
  },
  updatedByModel: {
    type: String,
    enum: ['User', 'SuperAdmin']
  }
}, {
  timestamps: true
});

// Indexes
discountSchema.index({ tenancy: 1, isActive: 1 });
discountSchema.index({ isGlobal: 1, isActive: 1 });
discountSchema.index({ startDate: 1, endDate: 1 });
discountSchema.index({ priority: -1 });

// Methods
discountSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startDate && 
         now <= this.endDate &&
         (this.usageLimit === 0 || this.usedCount < this.usageLimit);
};

discountSchema.methods.canApplyToOrder = function(order, user) {
  if (!this.isValid()) return false;
  
  // Check per-user limit
  if (this.perUserLimit > 0) {
    // This would need to be checked against order history
    // Implementation depends on how you track user discount usage
  }
  
  // Check each rule
  return this.rules.some(rule => this.checkRule(rule, order, user));
};

discountSchema.methods.checkRule = function(rule, order, user) {
  const now = new Date();
  
  // Check conditions
  if (rule.conditions) {
    const { conditions } = rule;
    
    // Time of day check
    if (conditions.timeOfDay && conditions.timeOfDay.startTime && conditions.timeOfDay.endTime) {
      const currentTime = now.toTimeString().slice(0, 5);
      if (currentTime < conditions.timeOfDay.startTime || currentTime > conditions.timeOfDay.endTime) {
        return false;
      }
    }
    
    // Day of week check
    if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
      if (!conditions.daysOfWeek.includes(now.getDay())) {
        return false;
      }
    }
    
    // User type check
    if (conditions.userType && conditions.userType !== 'all') {
      // Implementation depends on how you determine user types
      // This would need to be implemented based on your user classification logic
    }
    
    // Order value checks
    if (conditions.minOrderValue && order.totalAmount < conditions.minOrderValue) {
      return false;
    }
    
    if (conditions.maxOrderValue && order.totalAmount > conditions.maxOrderValue) {
      return false;
    }
    
    // Service checks
    if (conditions.applicableServices && conditions.applicableServices.length > 0) {
      const orderServices = order.items.map(item => item.service);
      const hasApplicableService = orderServices.some(service => 
        conditions.applicableServices.includes(service.toString())
      );
      if (!hasApplicableService) return false;
    }
    
    if (conditions.excludeServices && conditions.excludeServices.length > 0) {
      const orderServices = order.items.map(item => item.service);
      const hasExcludedService = orderServices.some(service => 
        conditions.excludeServices.includes(service.toString())
      );
      if (hasExcludedService) return false;
    }
  }
  
  return true;
};

discountSchema.methods.calculateDiscount = function(order, rule) {
  let discount = 0;
  
  switch (rule.type) {
    case 'percentage':
      discount = (order.totalAmount * rule.value) / 100;
      break;
      
    case 'fixed_amount':
      discount = Math.min(rule.value, order.totalAmount);
      break;
      
    case 'tiered':
      // Find applicable tier
      const applicableTier = rule.tiers
        .filter(tier => 
          order.totalAmount >= tier.minValue && 
          order.items.length >= tier.minQuantity
        )
        .sort((a, b) => b.minValue - a.minValue)[0];
      
      if (applicableTier) {
        if (applicableTier.discountPercentage > 0) {
          discount = (order.totalAmount * applicableTier.discountPercentage) / 100;
        } else if (applicableTier.discountAmount > 0) {
          discount = Math.min(applicableTier.discountAmount, order.totalAmount);
        }
      }
      break;
      
    case 'conditional':
      // Same as percentage for now, but could be more complex
      discount = (order.totalAmount * rule.value) / 100;
      break;
  }
  
  return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

discountSchema.methods.recordUsage = async function(order, discountAmount) {
  this.usedCount += 1;
  this.totalSavings += discountAmount;
  this.totalOrders += 1;
  await this.save();
};

module.exports = mongoose.model('Discount', discountSchema);