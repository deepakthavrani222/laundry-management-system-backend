const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  // Ownership
  tenancy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenancy', 
    required: function() { return this.bannerScope === 'TENANT'; }
  },
  bannerScope: { 
    type: String, 
    enum: ['TENANT', 'GLOBAL'], 
    required: true,
    default: 'TENANT'
  },
  
  // Basic Info
  title: { 
    type: String, 
    required: true, 
    maxlength: 100,
    trim: true
  },
  description: { 
    type: String, 
    maxlength: 500,
    trim: true
  },
  
  // Visual Content
  imageUrl: { 
    type: String, 
    required: true 
  },
  imageAlt: { 
    type: String,
    default: 'Banner Image'
  },
  mobileImageUrl: { 
    type: String 
  }, // Optional mobile-specific image
  
  // Banner Type
  type: { 
    type: String, 
    enum: ['PROMOTIONAL', 'REFERRAL', 'ANNOUNCEMENT', 'LOYALTY'],
    required: true,
    default: 'PROMOTIONAL'
  },
  
  // Linked Promotion (Optional)
  linkedPromotion: {
    type: { 
      type: String, 
      enum: ['CAMPAIGN', 'COUPON', 'DISCOUNT', 'REFERRAL', 'LOYALTY', 'NONE'],
      default: 'NONE'
    },
    promotionId: { 
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'linkedPromotion.promotionModel'
    },
    promotionModel: {
      type: String,
      enum: ['Campaign', 'Coupon', 'Discount', 'ReferralProgram', 'LoyaltyProgram']
    }
  },
  
  // Call to Action
  ctaText: { 
    type: String, 
    maxlength: 50,
    default: 'Learn More'
  },
  ctaLink: { 
    type: String 
  }, // Internal link or external URL
  
  // Display Settings
  targetPages: [{ 
    type: String, 
    enum: ['HOME', 'SERVICES', 'PRICING', 'CHECKOUT', 'DASHBOARD', 'ALL'],
    default: 'HOME'
  }],
  position: { 
    type: String, 
    enum: ['TOP', 'HERO', 'MIDDLE', 'BOTTOM', 'POPUP', 'STICKY'],
    default: 'TOP'
  },
  priority: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100
  }, // Higher = shown first
  
  // Scheduling
  startDate: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  
  // Status & Approval
  status: { 
    type: String, 
    enum: ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED'],
    default: 'DRAFT'
  },
  requiresApproval: { 
    type: Boolean, 
    default: false 
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'SuperAdmin' 
  },
  approvedAt: { 
    type: Date 
  },
  rejectionReason: { 
    type: String,
    maxlength: 500
  },
  
  // Analytics
  analytics: {
    impressions: { 
      type: Number, 
      default: 0,
      min: 0
    },
    clicks: { 
      type: Number, 
      default: 0,
      min: 0
    },
    conversions: { 
      type: Number, 
      default: 0,
      min: 0
    }, // Orders from banner
    revenue: { 
      type: Number, 
      default: 0,
      min: 0
    }
  },
  
  // Metadata
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'createdByModel',
    required: true
  },
  createdByModel: { 
    type: String, 
    enum: ['Admin', 'SuperAdmin', 'User'],
    required: true
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'updatedByModel' 
  },
  updatedByModel: { 
    type: String, 
    enum: ['Admin', 'SuperAdmin', 'User']
  }
}, { 
  timestamps: true 
});

// Indexes for performance
BannerSchema.index({ tenancy: 1, status: 1, startDate: 1, endDate: 1 });
BannerSchema.index({ bannerScope: 1, status: 1 });
BannerSchema.index({ priority: -1 });
BannerSchema.index({ targetPages: 1, status: 1 });
BannerSchema.index({ startDate: 1, endDate: 1 });

// Virtual for CTR (Click-Through Rate)
BannerSchema.virtual('ctr').get(function() {
  if (this.analytics.impressions === 0) return 0;
  return ((this.analytics.clicks / this.analytics.impressions) * 100).toFixed(2);
});

// Virtual for Conversion Rate
BannerSchema.virtual('conversionRate').get(function() {
  if (this.analytics.clicks === 0) return 0;
  return ((this.analytics.conversions / this.analytics.clicks) * 100).toFixed(2);
});

// Methods
BannerSchema.methods.isValid = function() {
  const now = new Date();
  return this.status === 'ACTIVE' && 
         this.isActive && 
         this.startDate <= now && 
         this.endDate >= now;
};

BannerSchema.methods.canDisplay = function(page) {
  if (!this.isValid()) return false;
  
  // Check if banner targets this page
  if (this.targetPages.includes('ALL')) return true;
  if (this.targetPages.includes(page)) return true;
  
  return false;
};

BannerSchema.methods.recordImpression = async function() {
  this.analytics.impressions += 1;
  await this.save();
  return this.analytics.impressions;
};

BannerSchema.methods.recordClick = async function() {
  this.analytics.clicks += 1;
  await this.save();
  return this.analytics.clicks;
};

BannerSchema.methods.recordConversion = async function(orderValue = 0) {
  this.analytics.conversions += 1;
  this.analytics.revenue += orderValue;
  await this.save();
  return {
    conversions: this.analytics.conversions,
    revenue: this.analytics.revenue
  };
};

BannerSchema.methods.checkApprovalRequired = function() {
  // Auto-approval rules
  if (this.bannerScope === 'GLOBAL') return true;
  if (this.linkedPromotion.type !== 'NONE') {
    // Check if linked promotion has high discount
    // This would need to query the linked promotion
    // For now, require approval for all linked promotions
    return true;
  }
  return false;
};

// Static methods
BannerSchema.statics.getActiveBanners = async function(tenancyId, page = 'ALL') {
  const now = new Date();
  
  // Get tenant banners
  const tenantBanners = await this.find({
    tenancy: tenancyId,
    bannerScope: 'TENANT',
    status: 'ACTIVE',
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { targetPages: 'ALL' },
      { targetPages: page }
    ]
  }).sort({ priority: -1 });
  
  // Get global banners
  const globalBanners = await this.find({
    bannerScope: 'GLOBAL',
    status: 'ACTIVE',
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { targetPages: 'ALL' },
      { targetPages: page }
    ]
  }).sort({ priority: -1 });
  
  // Merge and sort by priority
  const allBanners = [...tenantBanners, ...globalBanners]
    .sort((a, b) => {
      // First by priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then tenant banners before global
      if (a.bannerScope === 'TENANT' && b.bannerScope === 'GLOBAL') return -1;
      if (a.bannerScope === 'GLOBAL' && b.bannerScope === 'TENANT') return 1;
      // Then by creation date (newer first)
      return b.createdAt - a.createdAt;
    });
  
  return allBanners;
};

// Pre-save middleware
BannerSchema.pre('save', function(next) {
  // Check if approval is required
  if (this.isNew || this.isModified('linkedPromotion') || this.isModified('bannerScope')) {
    this.requiresApproval = this.checkApprovalRequired();
    if (this.requiresApproval && this.status === 'DRAFT') {
      this.status = 'PENDING_APPROVAL';
    }
  }
  
  // Auto-expire if end date passed
  if (this.endDate < new Date() && this.status === 'ACTIVE') {
    this.status = 'EXPIRED';
  }
  
  next();
});

// Ensure virtuals are included in JSON
BannerSchema.set('toJSON', { virtuals: true });
BannerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Banner', BannerSchema);
