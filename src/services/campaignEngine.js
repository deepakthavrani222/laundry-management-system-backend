const Campaign = require('../models/Campaign');
const User = require('../models/User');
const Order = require('../models/Order');

class CampaignEngine {
  /**
   * Main method to evaluate and select best campaign for a user
   * Implements the logic from campaign.md Step 11-12
   */
  static async evaluateCampaigns(userId, tenancyId, triggerType = 'ORDER_CHECKOUT', orderData = {}) {
    try {
      // Step 1: Find all active campaigns for this tenancy and trigger
      const activeCampaigns = await Campaign.findActiveCampaigns(tenancyId, triggerType);
      
      if (activeCampaigns.length === 0) {
        return {
          success: true,
          selectedCampaign: null,
          message: 'No active campaigns found'
        };
      }
      
      // Step 2: Get user data for eligibility checks
      const user = await User.findById(userId).select('orderCount totalSpent createdAt');
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }
      
      // Step 3: Filter campaigns by user eligibility
      const eligibleCampaigns = [];
      
      for (const campaign of activeCampaigns) {
        if (await this.isUserEligibleForCampaign(campaign, user, orderData)) {
          const benefit = campaign.calculateBenefit(orderData);
          eligibleCampaigns.push({
            campaign,
            benefit,
            cost: this.calculateCampaignCost(campaign, orderData)
          });
        }
      }
      
      if (eligibleCampaigns.length === 0) {
        return {
          success: true,
          selectedCampaign: null,
          message: 'No eligible campaigns found for user'
        };
      }
      
      // Step 4: Select best campaign using campaign.md logic
      const selectedCampaign = this.selectBestCampaign(eligibleCampaigns);
      
      return {
        success: true,
        selectedCampaign: selectedCampaign.campaign,
        benefit: selectedCampaign.benefit,
        cost: selectedCampaign.cost,
        message: `Campaign selected: ${selectedCampaign.campaign.name}`
      };
      
    } catch (error) {
      console.error('Campaign evaluation error:', error);
      return {
        success: false,
        message: 'Failed to evaluate campaigns',
        error: error.message
      };
    }
  }
  
  /**
   * Check if user is eligible for a specific campaign
   */
  static async isUserEligibleForCampaign(campaign, user, orderData) {
    // Basic eligibility check from campaign model
    if (!campaign.isUserEligible(user, orderData)) {
      return false;
    }
    
    // Check per-user usage limits
    if (campaign.limits.perUserLimit > 0) {
      const userUsageCount = await this.getUserCampaignUsage(campaign._id, user._id);
      if (userUsageCount >= campaign.limits.perUserLimit) {
        return false;
      }
    }
    
    // Check daily limits
    if (campaign.limits.dailyLimit > 0) {
      const todayUsage = await this.getCampaignDailyUsage(campaign._id);
      if (todayUsage >= campaign.limits.dailyLimit) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Select best campaign based on campaign.md Step 12 logic
   */
  static selectBestCampaign(eligibleCampaigns) {
    // Sort by scope priority (Tenant > Global as per campaign.md)
    eligibleCampaigns.sort((a, b) => {
      // First by scope (TENANT campaigns have priority)
      if (a.campaign.campaignScope !== b.campaign.campaignScope) {
        if (a.campaign.campaignScope === 'TENANT') return -1;
        if (b.campaign.campaignScope === 'TENANT') return 1;
      }
      
      // Then by campaign priority
      if (a.campaign.priority !== b.campaign.priority) {
        return b.campaign.priority - a.campaign.priority;
      }
      
      // Then by highest user benefit
      if (a.benefit !== b.benefit) {
        return b.benefit - a.benefit;
      }
      
      // Finally by lowest platform cost
      return a.cost - b.cost;
    });
    
    return eligibleCampaigns[0];
  }
  
  /**
   * Apply selected campaign to order
   */
  static async applyCampaign(campaignId, userId, orderData) {
    try {
      const campaign = await Campaign.findById(campaignId).populate('promotions.promotionId');
      if (!campaign) {
        return {
          success: false,
          message: 'Campaign not found'
        };
      }
      
      let totalDiscount = 0;
      const appliedPromotions = [];
      
      // Apply each promotion in the campaign
      for (const promotion of campaign.promotions) {
        const result = await this.applyPromotion(promotion, orderData);
        if (result.success) {
          totalDiscount += result.discount;
          appliedPromotions.push({
            type: promotion.type,
            promotionId: promotion.promotionId._id,
            discount: result.discount,
            description: result.description
          });
        }
      }
      
      // Update campaign analytics and budget
      await this.updateCampaignUsage(campaign, totalDiscount, orderData.total);
      
      // Log campaign usage for user
      await this.logCampaignUsage(campaignId, userId, totalDiscount);
      
      return {
        success: true,
        totalDiscount,
        appliedPromotions,
        campaignName: campaign.name,
        campaignScope: campaign.campaignScope,
        message: `Campaign Applied: ${campaign.name} ${campaign.campaignScope === 'TENANT' ? '(Local Offer)' : '(Platform Offer)'} – You saved $${totalDiscount.toFixed(2)}`
      };
      
    } catch (error) {
      console.error('Apply campaign error:', error);
      return {
        success: false,
        message: 'Failed to apply campaign',
        error: error.message
      };
    }
  }
  
  /**
   * Apply individual promotion within a campaign
   */
  static async applyPromotion(promotion, orderData) {
    try {
      let discount = 0;
      let description = '';
      
      switch (promotion.type) {
        case 'DISCOUNT':
          const discountResult = this.calculateDiscountValue(promotion, orderData);
          discount = discountResult.discount;
          description = discountResult.description;
          break;
          
        case 'COUPON':
          const couponResult = this.calculateCouponValue(promotion, orderData);
          discount = couponResult.discount;
          description = couponResult.description;
          break;
          
        case 'WALLET_CREDIT':
          // Wallet credit doesn't reduce order total but adds to user wallet
          const creditAmount = promotion.overrides?.value || 10;
          description = `$${creditAmount} wallet credit`;
          // Note: Actual wallet credit would be added in order completion
          break;
          
        case 'LOYALTY_POINTS':
          const points = promotion.overrides?.value || 100;
          description = `${points} loyalty points`;
          // Note: Actual points would be added in order completion
          break;
      }
      
      return {
        success: true,
        discount,
        description
      };
      
    } catch (error) {
      return {
        success: false,
        discount: 0,
        description: 'Failed to apply promotion'
      };
    }
  }
  
  /**
   * Calculate discount value from discount promotion
   */
  static calculateDiscountValue(promotion, orderData) {
    const discount = promotion.promotionId;
    const rule = discount.rules[0]; // Use first rule for simplicity
    
    if (!rule) {
      return { discount: 0, description: 'No discount rules found' };
    }
    
    let discountAmount = 0;
    const value = promotion.overrides?.value || rule.value;
    
    switch (rule.type) {
      case 'percentage':
        discountAmount = (orderData.total * value) / 100;
        break;
      case 'fixed_amount':
        discountAmount = value;
        break;
      default:
        discountAmount = 0;
    }
    
    // Apply max discount limit
    const maxDiscount = promotion.overrides?.maxDiscount || discount.maxDiscount || Infinity;
    discountAmount = Math.min(discountAmount, maxDiscount);
    
    return {
      discount: discountAmount,
      description: `${rule.type === 'percentage' ? value + '%' : '$' + value} off`
    };
  }
  
  /**
   * Calculate coupon value
   */
  static calculateCouponValue(promotion, orderData) {
    const coupon = promotion.promotionId;
    let discountAmount = 0;
    const value = promotion.overrides?.value || coupon.value;
    
    if (coupon.type === 'percentage') {
      discountAmount = (orderData.total * value) / 100;
    } else {
      discountAmount = value;
    }
    
    // Apply max discount limit
    const maxDiscount = promotion.overrides?.maxDiscount || coupon.maxDiscount || Infinity;
    discountAmount = Math.min(discountAmount, maxDiscount);
    
    return {
      discount: discountAmount,
      description: `Coupon: ${coupon.code} (${coupon.type === 'percentage' ? value + '%' : '$' + value} off)`
    };
  }
  
  /**
   * Calculate campaign cost for platform
   */
  static calculateCampaignCost(campaign, orderData) {
    // Simple cost calculation - in reality this would be more complex
    return campaign.calculateBenefit(orderData);
  }
  
  /**
   * Update campaign usage statistics
   */
  static async updateCampaignUsage(campaign, discountAmount, orderTotal) {
    campaign.limits.usedCount += 1;
    campaign.budget.spentAmount += discountAmount;
    campaign.analytics.conversions += 1;
    campaign.analytics.totalSavings += discountAmount;
    campaign.analytics.totalRevenue += orderTotal;
    
    await campaign.save();
  }
  
  /**
   * Log campaign usage for a specific user
   */
  static async logCampaignUsage(campaignId, userId, discountAmount) {
    // This would typically be stored in a separate CampaignUsage collection
    // For now, we'll just log it
    console.log(`Campaign Usage: Campaign ${campaignId}, User ${userId}, Discount $${discountAmount}`);
  }
  
  /**
   * Get user's usage count for a specific campaign
   */
  static async getUserCampaignUsage(campaignId, userId) {
    // This would query a CampaignUsage collection
    // For now, return 0 (implement based on your usage tracking needs)
    return 0;
  }
  
  /**
   * Get campaign's daily usage count
   */
  static async getCampaignDailyUsage(campaignId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // This would query usage records for today
    // For now, return 0 (implement based on your usage tracking needs)
    return 0;
  }
  
  /**
   * Get campaigns created from template
   */
  static async createCampaignFromTemplate(templateId, tenancyId, customizations = {}) {
    try {
      const template = await Campaign.findOne({
        _id: templateId,
        campaignScope: 'TEMPLATE'
      }).populate('promotions.promotionId');
      
      if (!template) {
        return {
          success: false,
          message: 'Template not found'
        };
      }
      
      // Create new campaign from template
      const campaignData = {
        ...template.toObject(),
        _id: undefined,
        campaignScope: 'TENANT',
        tenancy: tenancyId,
        status: 'DRAFT',
        isTemplate: false,
        templateCategory: undefined,
        ...customizations
      };
      
      const newCampaign = new Campaign(campaignData);
      await newCampaign.save();
      
      return {
        success: true,
        campaign: newCampaign,
        message: 'Campaign created from template successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create campaign from template',
        error: error.message
      };
    }
  }
}

module.exports = CampaignEngine;