const Discount = require('../../models/Discount');
const { validationResult } = require('express-validator');

// Get all discounts for tenancy
const getDiscounts = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { page = 1, limit = 10, search, status, type } = req.query;
    
    // Build filter
    const filter = { tenancy: tenancyId };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      filter.isActive = status === 'active';
    }
    
    if (type) {
      filter['rules.type'] = type;
    }
    
    const discounts = await Discount.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    const total = await Discount.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        discounts,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discounts'
    });
  }
};

// Get single discount
const getDiscountById = async (req, res) => {
  try {
    const { discountId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const discount = await Discount.findOne({ 
      _id: discountId, 
      tenancy: tenancyId 
    })
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.json({
      success: true,
      data: { discount }
    });
  } catch (error) {
    console.error('Get discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount'
    });
  }
};

// Create discount
const createDiscount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const tenancyId = req.user.tenancy;
    const {
      name, description, rules, priority,
      canStackWithCoupons, canStackWithOtherDiscounts,
      startDate, endDate, usageLimit, perUserLimit,
      isActive
    } = req.body;
    
    const discount = new Discount({
      tenancy: tenancyId,
      name,
      description,
      rules,
      priority: priority || 0,
      canStackWithCoupons: canStackWithCoupons !== false,
      canStackWithOtherDiscounts: canStackWithOtherDiscounts || false,
      startDate,
      endDate,
      usageLimit: usageLimit || 0,
      perUserLimit: perUserLimit || 0,
      isActive: isActive !== false,
      createdBy: req.user._id,
      createdByModel: 'User'
    });
    
    await discount.save();
    
    res.status(201).json({
      success: true,
      message: 'Discount created successfully',
      data: { discount }
    });
  } catch (error) {
    console.error('Create discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create discount'
    });
  }
};

// Update discount
const updateDiscount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { discountId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const discount = await Discount.findOne({
      _id: discountId,
      tenancy: tenancyId
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    const {
      name, description, rules, priority,
      canStackWithCoupons, canStackWithOtherDiscounts,
      startDate, endDate, usageLimit, perUserLimit,
      isActive
    } = req.body;
    
    // Update fields
    if (name !== undefined) discount.name = name;
    if (description !== undefined) discount.description = description;
    if (rules !== undefined) discount.rules = rules;
    if (priority !== undefined) discount.priority = priority;
    if (canStackWithCoupons !== undefined) discount.canStackWithCoupons = canStackWithCoupons;
    if (canStackWithOtherDiscounts !== undefined) discount.canStackWithOtherDiscounts = canStackWithOtherDiscounts;
    if (startDate !== undefined) discount.startDate = startDate;
    if (endDate !== undefined) discount.endDate = endDate;
    if (usageLimit !== undefined) discount.usageLimit = usageLimit;
    if (perUserLimit !== undefined) discount.perUserLimit = perUserLimit;
    if (isActive !== undefined) discount.isActive = isActive;
    
    discount.updatedBy = req.user._id;
    discount.updatedByModel = 'User';
    
    await discount.save();
    
    res.json({
      success: true,
      message: 'Discount updated successfully',
      data: { discount }
    });
  } catch (error) {
    console.error('Update discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update discount'
    });
  }
};

// Delete discount
const deleteDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const discount = await Discount.findOneAndDelete({
      _id: discountId,
      tenancy: tenancyId
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });
  } catch (error) {
    console.error('Delete discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete discount'
    });
  }
};

// Toggle discount status
const toggleDiscountStatus = async (req, res) => {
  try {
    const { discountId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const discount = await Discount.findOne({
      _id: discountId,
      tenancy: tenancyId
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    discount.isActive = !discount.isActive;
    discount.updatedBy = req.user._id;
    discount.updatedByModel = 'User';
    
    await discount.save();
    
    res.json({
      success: true,
      message: `Discount ${discount.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { discount }
    });
  } catch (error) {
    console.error('Toggle discount status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle discount status'
    });
  }
};

// Get discount analytics
const getDiscountAnalytics = async (req, res) => {
  try {
    const { discountId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const discount = await Discount.findOne({
      _id: discountId,
      tenancy: tenancyId
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    // Calculate analytics
    const analytics = {
      totalUsage: discount.usedCount,
      totalSavings: discount.totalSavings,
      totalOrders: discount.totalOrders,
      averageDiscount: discount.totalOrders > 0 ? discount.totalSavings / discount.totalOrders : 0,
      usageRate: discount.usageLimit > 0 ? (discount.usedCount / discount.usageLimit) * 100 : 0,
      isActive: discount.isActive,
      daysActive: Math.ceil((new Date() - discount.startDate) / (1000 * 60 * 60 * 24)),
      daysRemaining: Math.ceil((discount.endDate - new Date()) / (1000 * 60 * 60 * 24))
    };
    
    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Get discount analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount analytics'
    });
  }
};

// Apply discounts to order (utility function for checkout)
const applyDiscountsToOrder = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { order, userId } = req.body;
    
    // Get all active discounts for tenancy
    const discounts = await Discount.find({
      tenancy: tenancyId,
      isActive: true
    }).sort({ priority: -1 });
    
    const applicableDiscounts = [];
    let totalDiscount = 0;
    
    for (const discount of discounts) {
      if (discount.canApplyToOrder(order, { _id: userId })) {
        for (const rule of discount.rules) {
          if (discount.checkRule(rule, order, { _id: userId })) {
            const discountAmount = discount.calculateDiscount(order, rule);
            
            applicableDiscounts.push({
              discountId: discount._id,
              name: discount.name,
              type: rule.type,
              amount: discountAmount,
              description: discount.description
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
        finalAmount: Math.max(0, order.totalAmount - totalDiscount)
      }
    });
  } catch (error) {
    console.error('Apply discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply discounts'
    });
  }
};

// Get discount dashboard stats
const getDiscountStats = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const stats = await Discount.aggregate([
      { $match: { tenancy: tenancyId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalSavings: { $sum: '$totalSavings' },
          totalOrders: { $sum: '$totalOrders' }
        }
      }
    ]);
    
    const result = stats[0] || {
      total: 0,
      active: 0,
      totalSavings: 0,
      totalOrders: 0
    };
    
    // Get recent discounts
    const recentDiscounts = await Discount.find({ tenancy: tenancyId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name isActive usedCount totalSavings createdAt');
    
    res.json({
      success: true,
      data: {
        stats: result,
        recentDiscounts
      }
    });
  } catch (error) {
    console.error('Get discount stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount statistics'
    });
  }
};

module.exports = {
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  toggleDiscountStatus,
  getDiscountAnalytics,
  applyDiscountsToOrder,
  getDiscountStats
};