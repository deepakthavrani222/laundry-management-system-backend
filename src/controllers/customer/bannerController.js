const Banner = require('../../models/Banner');
const Campaign = require('../../models/Campaign');
const Coupon = require('../../models/Coupon');
const Discount = require('../../models/Discount');
const Referral = require('../../models/Referral');
const LoyaltyProgram = require('../../models/LoyaltyProgram');

/**
 * Get active banners for a specific page
 * @route GET /api/customer/banners
 * @access Public
 */
exports.getActiveBanners = async (req, res) => {
  try {
    const { page, limit = 10 } = req.query;
    const tenancyId = req.tenancyId;

    if (!page) {
      return res.status(400).json({
        success: false,
        message: 'Page parameter is required'
      });
    }

    // Get active banners for this tenancy and page
    const banners = await Banner.getActiveBanners(tenancyId, page, parseInt(limit));

    // Populate linked promotion details
    const bannersWithDetails = await Promise.all(
      banners.map(async (banner) => {
        const bannerObj = banner.toObject();
        
        if (banner.linkedPromotion?.promotionType && banner.linkedPromotion?.promotionId) {
          try {
            let promotionDetails = null;
            
            switch (banner.linkedPromotion.promotionType) {
              case 'Campaign':
                promotionDetails = await Campaign.findById(banner.linkedPromotion.promotionId)
                  .select('name description startDate endDate discountType discountValue');
                break;
              case 'Coupon':
                promotionDetails = await Coupon.findById(banner.linkedPromotion.promotionId)
                  .select('code description discountType discountValue validFrom validUntil');
                break;
              case 'Discount':
                promotionDetails = await Discount.findById(banner.linkedPromotion.promotionId)
                  .select('name description discountType discountValue startDate endDate');
                break;
              case 'Referral':
                promotionDetails = await Referral.findById(banner.linkedPromotion.promotionId)
                  .select('name description referrerReward refereeReward');
                break;
              case 'LoyaltyProgram':
                promotionDetails = await LoyaltyProgram.findById(banner.linkedPromotion.promotionId)
                  .select('name description programType pointsPerRupee');
                break;
            }
            
            if (promotionDetails) {
              bannerObj.linkedPromotion.details = promotionDetails;
            }
          } catch (error) {
            console.error('Error fetching promotion details:', error);
          }
        }
        
        return bannerObj;
      })
    );

    res.status(200).json({
      success: true,
      count: bannersWithDetails.length,
      data: bannersWithDetails
    });
  } catch (error) {
    console.error('Error fetching active banners:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banners',
      error: error.message
    });
  }
};

/**
 * Record banner impression
 * @route POST /api/customer/banners/:id/impression
 * @access Public
 */
exports.recordBannerImpression = async (req, res) => {
  try {
    const { id } = req.params;
    const tenancyId = req.tenancyId;

    const banner = await Banner.findOne({
      _id: id,
      $or: [
        { bannerScope: 'GLOBAL' },
        { tenancyId, bannerScope: 'TENANT' }
      ],
      isActive: true
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Increment impressions
    banner.analytics.impressions += 1;
    await banner.save();

    res.status(200).json({
      success: true,
      message: 'Impression recorded'
    });
  } catch (error) {
    console.error('Error recording banner impression:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording impression',
      error: error.message
    });
  }
};

/**
 * Record banner click
 * @route POST /api/customer/banners/:id/click
 * @access Public
 */
exports.recordBannerClick = async (req, res) => {
  try {
    const { id } = req.params;
    const tenancyId = req.tenancyId;

    const banner = await Banner.findOne({
      _id: id,
      $or: [
        { bannerScope: 'GLOBAL' },
        { tenancyId, bannerScope: 'TENANT' }
      ],
      isActive: true
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Increment clicks
    banner.analytics.clicks += 1;
    
    // Calculate CTR
    if (banner.analytics.impressions > 0) {
      banner.analytics.ctr = (banner.analytics.clicks / banner.analytics.impressions) * 100;
    }
    
    await banner.save();

    // Return linked promotion details for navigation
    let promotionDetails = null;
    if (banner.linkedPromotion?.promotionType && banner.linkedPromotion?.promotionId) {
      promotionDetails = {
        type: banner.linkedPromotion.promotionType,
        id: banner.linkedPromotion.promotionId
      };
    }

    res.status(200).json({
      success: true,
      message: 'Click recorded',
      data: {
        actionType: banner.actionType,
        actionUrl: banner.actionUrl,
        linkedPromotion: promotionDetails
      }
    });
  } catch (error) {
    console.error('Error recording banner click:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording click',
      error: error.message
    });
  }
};
