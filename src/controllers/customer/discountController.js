const Discount = require('../../models/Discount');
const CampaignIntegration = require('../../services/campaignIntegration');

// Get all active discounts for display
const getActiveDiscounts = async (req, res) => {
  try {
    const tenancyId = req.user?.tenancy || req.tenancyId;
    
    if (!tenancyId) {
      return res.status(400).json({
        success: false,
        message: 'Tenancy not found'
      });
    }
    
    const discounts = await Discount.find({
      tenancy: tenancyId,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).select('name description rules startDate endDate');
    
    res.json({
      success: true,
      data: { discounts }
    });
  } catch (error) {
    console.error('Get active discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active discounts'
    });
  }
};

// Get applicable discounts for an order
const getApplicableDiscounts = async (req, res) => {
  try {
    const tenancyId = req.user?.tenancy || req.tenancyId;
    const userId = req.user?._id;
    const { orderValue, serviceType, items } = req.body;
    
    if (!tenancyId) {
      return res.status(400).json({
        success: false,
        message: 'Tenancy not found'
      });
    }
    
    console.log('========================================');
    console.log('CHECKING APPLICABLE PROMOTIONS (Preview)');
    console.log('Tenancy:', tenancyId);
    console.log('Order Value:', orderValue);
    console.log('Service Type:', serviceType);
    console.log('========================================');
    
    // STEP 1: Check Campaigns First (Higher Priority)
    let campaignDiscount = 0;
    let applicableCampaign = null;
    
    if (userId) {
      console.log('\n🎯 Checking Campaigns...');
      const campaignPreview = await CampaignIntegration.previewCampaignBenefits(
        userId,
        tenancyId,
        { total: orderValue, items: items || [], serviceType }
      );
      
      if (campaignPreview.success && campaignPreview.preview) {
        applicableCampaign = {
          type: 'campaign',
          campaignId: campaignPreview.preview.campaignId,
          name: campaignPreview.preview.campaignName,
          scope: campaignPreview.preview.campaignScope,
          amount: campaignPreview.preview.estimatedDiscount,
          description: campaignPreview.preview.description
        };
        campaignDiscount = campaignPreview.preview.estimatedDiscount;
        console.log(`✅ Campaign Found: ${applicableCampaign.name} - ₹${campaignDiscount}`);
      } else {
        console.log('ℹ️ No applicable campaigns');
      }
    }
    
    // STEP 2: Check Automatic Discounts
    console.log('\n💰 Checking Automatic Discounts...');
    const discounts = await Discount.find({
      tenancy: tenancyId,
      isActive: true
    }).sort({ priority: -1 });
    
    console.log(`Found ${discounts.length} active discounts`);
    
    const applicableDiscounts = [];
    let totalDiscount = 0;
    
    // Create temporary order object for evaluation
    const tempOrder = {
      totalAmount: orderValue || 0,
      items: items || [],
      customer: req.user?._id
    };
    
    for (const discount of discounts) {
      console.log(`\nEvaluating: ${discount.name}`);
      console.log(`  - Is Valid: ${discount.isValid()}`);
      console.log(`  - Can Apply: ${discount.canApplyToOrder(tempOrder, req.user)}`);
      
      if (discount.isValid() && discount.canApplyToOrder(tempOrder, req.user)) {
        for (const rule of discount.rules) {
          console.log(`  - Checking rule: ${rule.type}`);
          const ruleCheck = discount.checkRule(rule, tempOrder, req.user);
          console.log(`  - Rule passes: ${ruleCheck}`);
          
          if (ruleCheck) {
            const discountAmount = discount.calculateDiscount(tempOrder, rule);
            console.log(`  - Discount amount: ₹${discountAmount}`);
            
            applicableDiscounts.push({
              discountId: discount._id,
              name: discount.name,
              type: rule.type,
              amount: discountAmount,
              description: discount.description
            });
            
            totalDiscount += discountAmount;
            
            console.log(`✅ Applicable: ${discount.name} - ₹${discountAmount}`);
            
            // If discount doesn't stack with others, break
            if (!discount.canStackWithOtherDiscounts) {
              console.log(`  - No stacking allowed, stopping`);
              break;
            }
          }
        }
        
        // If we found a non-stacking discount, stop checking others
        if (applicableDiscounts.length > 0) {
          const lastDiscount = discounts.find(d => 
            d._id.toString() === applicableDiscounts[applicableDiscounts.length - 1].discountId.toString()
          );
          if (lastDiscount && !lastDiscount.canStackWithOtherDiscounts) {
            break;
          }
        }
      }
    }
    
    console.log(`\nTotal Applicable Discounts: ${applicableDiscounts.length}`);
    console.log(`Total Discount Amount: ₹${totalDiscount}`);
    
    // STEP 3: Combine Campaign and Discounts
    const allPromotions = [];
    let finalDiscount = 0;
    
    // Add campaign if found
    if (applicableCampaign) {
      allPromotions.push(applicableCampaign);
      finalDiscount += campaignDiscount;
    }
    
    // Add discounts (check stacking rules)
    if (applicableDiscounts.length > 0) {
      // If campaign exists, check if discounts can stack
      if (applicableCampaign) {
        console.log('\n⚠️ Campaign found - checking discount stacking rules');
        // For now, allow stacking. You can add stacking logic here
        applicableDiscounts.forEach(discount => {
          allPromotions.push({
            type: 'discount',
            ...discount
          });
          finalDiscount += discount.amount;
        });
      } else {
        // No campaign, add all discounts
        applicableDiscounts.forEach(discount => {
          allPromotions.push({
            type: 'discount',
            ...discount
          });
          finalDiscount += discount.amount;
        });
      }
    }
    
    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`Total Promotions: ${allPromotions.length}`);
    console.log(`  - Campaigns: ${applicableCampaign ? 1 : 0}`);
    console.log(`  - Discounts: ${applicableDiscounts.length}`);
    console.log(`Total Savings: ₹${Math.round(finalDiscount * 100) / 100}`);
    console.log('========================================\n');
    
    res.json({
      success: true,
      data: {
        promotions: allPromotions,
        campaign: applicableCampaign,
        discounts: applicableDiscounts,
        totalDiscount: Math.round(finalDiscount * 100) / 100
      }
    });
  } catch (error) {
    console.error('Get applicable discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applicable discounts'
    });
  }
};

module.exports = {
  getActiveDiscounts,
  getApplicableDiscounts
};
