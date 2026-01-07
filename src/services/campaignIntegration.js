const CampaignEngine = require('./campaignEngine');
const Order = require('../models/Order');

/**
 * Campaign Integration Service
 * Integrates campaigns with the order checkout process
 * Implements the campaign evaluation flow from campaign.md
 */
class CampaignIntegration {
  
  /**
   * Evaluate and apply campaigns during checkout
   * This is the main integration point called from order controller
   */
  static async evaluateCheckoutCampaigns(userId, tenancyId, orderData) {
    try {
      console.log(`🎯 Evaluating campaigns for user ${userId} in tenancy ${tenancyId}`);
      
      // Step 1: Evaluate campaigns using the campaign engine
      const evaluationResult = await CampaignEngine.evaluateCampaigns(
        userId, 
        tenancyId, 
        'ORDER_CHECKOUT', 
        orderData
      );
      
      if (!evaluationResult.success) {
        console.log('❌ Campaign evaluation failed:', evaluationResult.message);
        return {
          success: false,
          message: evaluationResult.message,
          appliedCampaigns: [],
          totalDiscount: 0
        };
      }
      
      // Step 2: If no campaign selected, return early
      if (!evaluationResult.selectedCampaign) {
        console.log('ℹ️ No campaigns applicable for this checkout');
        return {
          success: true,
          message: 'No applicable campaigns found',
          appliedCampaigns: [],
          totalDiscount: 0
        };
      }
      
      // Step 3: Apply the selected campaign
      const applicationResult = await CampaignEngine.applyCampaign(
        evaluationResult.selectedCampaign._id,
        userId,
        orderData
      );
      
      if (!applicationResult.success) {
        console.log('❌ Campaign application failed:', applicationResult.message);
        return {
          success: false,
          message: applicationResult.message,
          appliedCampaigns: [],
          totalDiscount: 0
        };
      }
      
      console.log(`✅ Campaign applied successfully: ${applicationResult.campaignName}`);
      
      return {
        success: true,
        message: applicationResult.message,
        appliedCampaigns: [{
          campaignId: evaluationResult.selectedCampaign._id,
          campaignName: applicationResult.campaignName,
          campaignScope: applicationResult.campaignScope,
          appliedPromotions: applicationResult.appliedPromotions,
          discount: applicationResult.totalDiscount
        }],
        totalDiscount: applicationResult.totalDiscount,
        displayMessage: applicationResult.message
      };
      
    } catch (error) {
      console.error('Campaign integration error:', error);
      return {
        success: false,
        message: 'Failed to evaluate campaigns',
        appliedCampaigns: [],
        totalDiscount: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Handle post-order completion campaign tasks
   * Called after order is successfully created
   */
  static async handleOrderCompletion(orderId, campaignApplications) {
    try {
      if (!campaignApplications || campaignApplications.length === 0) {
        return { success: true, message: 'No campaigns to process' };
      }
      
      console.log(`📊 Processing campaign completion for order ${orderId}`);
      
      for (const application of campaignApplications) {
        await this.processCampaignCompletion(orderId, application);
      }
      
      return {
        success: true,
        message: 'Campaign completion processed successfully'
      };
      
    } catch (error) {
      console.error('Campaign completion error:', error);
      return {
        success: false,
        message: 'Failed to process campaign completion',
        error: error.message
      };
    }
  }
  
  /**
   * Process individual campaign completion
   */
  static async processCampaignCompletion(orderId, campaignApplication) {
    try {
      // Log campaign usage for analytics
      await this.logCampaignOrderCompletion(orderId, campaignApplication);
      
      // Handle budget deduction (already done in campaign application)
      // Handle wallet credits or loyalty points if applicable
      await this.processRewardFulfillment(orderId, campaignApplication);
      
      console.log(`✅ Campaign completion processed: ${campaignApplication.campaignName}`);
      
    } catch (error) {
      console.error('Individual campaign completion error:', error);
      throw error;
    }
  }
  
  /**
   * Log campaign order completion for analytics
   */
  static async logCampaignOrderCompletion(orderId, campaignApplication) {
    // This would typically create records in a CampaignUsage or OrderCampaign collection
    // For now, we'll just log it
    console.log(`📈 Campaign Analytics: Order ${orderId}, Campaign ${campaignApplication.campaignId}, Discount $${campaignApplication.discount}`);
    
    // In a real implementation, you might do:
    // await CampaignUsage.create({
    //   orderId,
    //   campaignId: campaignApplication.campaignId,
    //   userId: order.userId,
    //   tenancyId: order.tenancyId,
    //   discountAmount: campaignApplication.discount,
    //   promotionsApplied: campaignApplication.appliedPromotions
    // });
  }
  
  /**
   * Process reward fulfillment (wallet credits, loyalty points, etc.)
   */
  static async processRewardFulfillment(orderId, campaignApplication) {
    try {
      for (const promotion of campaignApplication.appliedPromotions) {
        switch (promotion.type) {
          case 'WALLET_CREDIT':
            await this.addWalletCredit(orderId, promotion);
            break;
          case 'LOYALTY_POINTS':
            await this.addLoyaltyPoints(orderId, promotion);
            break;
          // Other reward types can be handled here
        }
      }
    } catch (error) {
      console.error('Reward fulfillment error:', error);
      // Don't throw here - we don't want to fail the order for reward issues
    }
  }
  
  /**
   * Add wallet credit to user
   */
  static async addWalletCredit(orderId, promotion) {
    // Implementation would depend on your wallet system
    console.log(`💰 Adding wallet credit: Order ${orderId}, Amount $${promotion.discount}`);
    
    // Example implementation:
    // const order = await Order.findById(orderId);
    // const user = await User.findById(order.userId);
    // user.walletBalance += promotion.discount;
    // await user.save();
  }
  
  /**
   * Add loyalty points to user
   */
  static async addLoyaltyPoints(orderId, promotion) {
    // Implementation would depend on your loyalty system
    console.log(`⭐ Adding loyalty points: Order ${orderId}, Points ${promotion.discount}`);
    
    // Example implementation:
    // const order = await Order.findById(orderId);
    // await LoyaltyAccount.findOneAndUpdate(
    //   { userId: order.userId, tenancyId: order.tenancyId },
    //   { $inc: { points: promotion.discount } },
    //   { upsert: true }
    // );
  }
  
  /**
   * Get active campaigns for a user (for display purposes)
   */
  static async getActiveCampaignsForUser(userId, tenancyId) {
    try {
      const evaluationResult = await CampaignEngine.evaluateCampaigns(
        userId,
        tenancyId,
        'ORDER_CHECKOUT',
        { total: 0 } // Dummy order data for preview
      );
      
      if (!evaluationResult.success) {
        return {
          success: false,
          campaigns: [],
          message: evaluationResult.message
        };
      }
      
      return {
        success: true,
        campaigns: evaluationResult.selectedCampaign ? [evaluationResult.selectedCampaign] : [],
        message: 'Active campaigns retrieved successfully'
      };
      
    } catch (error) {
      console.error('Get active campaigns error:', error);
      return {
        success: false,
        campaigns: [],
        message: 'Failed to retrieve active campaigns',
        error: error.message
      };
    }
  }
  
  /**
   * Preview campaign benefits for an order (before checkout)
   */
  static async previewCampaignBenefits(userId, tenancyId, orderData) {
    try {
      const evaluationResult = await CampaignEngine.evaluateCampaigns(
        userId,
        tenancyId,
        'ORDER_CHECKOUT',
        orderData
      );
      
      if (!evaluationResult.success || !evaluationResult.selectedCampaign) {
        return {
          success: true,
          preview: null,
          message: 'No applicable campaigns for this order'
        };
      }
      
      const campaign = evaluationResult.selectedCampaign;
      const benefit = evaluationResult.benefit;
      
      return {
        success: true,
        preview: {
          campaignId: campaign._id,
          campaignName: campaign.name,
          campaignScope: campaign.campaignScope,
          estimatedDiscount: benefit,
          description: `${campaign.campaignScope === 'TENANT' ? 'Local' : 'Platform'} offer: ${campaign.description}`,
          displayMessage: `Estimated savings: $${benefit.toFixed(2)}`
        },
        message: 'Campaign preview generated successfully'
      };
      
    } catch (error) {
      console.error('Campaign preview error:', error);
      return {
        success: false,
        preview: null,
        message: 'Failed to preview campaign benefits',
        error: error.message
      };
    }
  }
}

module.exports = CampaignIntegration;