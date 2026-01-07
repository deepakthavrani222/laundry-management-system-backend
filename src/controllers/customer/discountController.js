const Discount = require('../../models/Discount');

// Get applicable discounts for customer
const getApplicableDiscounts = async (req, res) => {
  try {
    const userId = req.user._id;
    const tenancyId = req.user.tenancy;
    const { orderValue, serviceType, items } = req.body;
    
    // Get all active discounts for tenancy
    const discounts = await Discount.find({
      tenancy: tenancyId,
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ]
    }).sort({ priority: -1 });
    
    const applicableDiscounts = [];
    let totalDiscount = 0;
    
    // Mock order object for rule checking
    const mockOrder = {
      totalAmount: orderValue || 0,
      items: items || [],
      serviceType: serviceType || 'wash_fold',
      customer: userId
    };
    
    for (const discount of discounts) {
      // Check if discount can apply to order
      if (discount.canApplyToOrder(mockOrder, req.user)) {
        // Check each rule
        for (const rule of discount.rules) {
          if (discount.checkRule(rule, mockOrder, req.user)) {
            const discountAmount = discount.calculateDiscount(mockOrder, rule);
            
            applicableDiscounts.push({
              discountId: discount._id,
              name: discount.name,
              description: discount.description,
              type: rule.type,
              amount: discountAmount,
              priority: discount.priority,
              canStackWithCoupons: discount.canStackWithCoupons,
              canStackWithOtherDiscounts: discount.canStackWithOtherDiscounts
            });
            
            totalDiscount += discountAmount;
            
            // If discount doesn't stack with others, break
            if (!discount.canStackWithOtherDiscounts) {
              break;
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        applicableDiscounts,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        finalAmount: Math.max(0, (orderValue || 0) - totalDiscount)
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

// Get all active discounts (for display purposes)
const getActiveDiscounts = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const discounts = await Discount.find({
      tenancy: tenancyId,
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ]
    })
    .select('name description rules startDate endDate')
    .sort({ priority: -1 });
    
    // Format for customer display
    const formattedDiscounts = discounts.map(discount => {
      const rule = discount.rules[0]; // Show first rule for simplicity
      
      return {
        _id: discount._id,
        name: discount.name,
        description: discount.description,
        type: rule?.type || 'percentage',
        value: rule?.value || 0,
        conditions: rule?.conditions || {},
        validUntil: discount.endDate
      };
    });
    
    res.json({
      success: true,
      data: {
        discounts: formattedDiscounts
      }
    });
  } catch (error) {
    console.error('Get active discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active discounts'
    });
  }
};

module.exports = {
  getApplicableDiscounts,
  getActiveDiscounts
};
