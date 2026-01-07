const { ReferralProgram, Referral } = require('../../models/Referral');
const User = require('../../models/User');
const { validationResult } = require('express-validator');

// Get all referral programs for tenancy
const getReferralPrograms = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { page = 1, limit = 10, search, status } = req.query;
    
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
    
    const programs = await ReferralProgram.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');
    
    const total = await ReferralProgram.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        programs,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get referral programs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral programs'
    });
  }
};

// Get single referral program
const getReferralProgramById = async (req, res) => {
  try {
    const { programId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const program = await ReferralProgram.findOne({ 
      _id: programId, 
      tenancy: tenancyId 
    }).populate('createdBy', 'name email');
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Referral program not found'
      });
    }
    
    res.json({
      success: true,
      data: { program }
    });
  } catch (error) {
    console.error('Get referral program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral program'
    });
  }
};

// Create referral program
const createReferralProgram = async (req, res) => {
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
      name, description, referrerReward, refereeReward,
      minOrderValue, maxReferralsPerUser, referralCodeExpiry,
      enableMultiLevel, maxLevels, levelRewards,
      startDate, endDate, isActive
    } = req.body;
    
    const program = new ReferralProgram({
      tenancy: tenancyId,
      name,
      description,
      referrerReward,
      refereeReward,
      minOrderValue: minOrderValue || 0,
      maxReferralsPerUser: maxReferralsPerUser || 0,
      referralCodeExpiry: referralCodeExpiry || 30,
      enableMultiLevel: enableMultiLevel || false,
      maxLevels: maxLevels || 1,
      levelRewards: levelRewards || [],
      startDate,
      endDate,
      isActive: isActive !== false,
      createdBy: req.user._id,
      createdByModel: 'User'
    });
    
    await program.save();
    
    res.status(201).json({
      success: true,
      message: 'Referral program created successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Create referral program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create referral program'
    });
  }
};

// Update referral program
const updateReferralProgram = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { programId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const program = await ReferralProgram.findOne({
      _id: programId,
      tenancy: tenancyId
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Referral program not found'
      });
    }
    
    const updateFields = [
      'name', 'description', 'referrerReward', 'refereeReward',
      'minOrderValue', 'maxReferralsPerUser', 'referralCodeExpiry',
      'enableMultiLevel', 'maxLevels', 'levelRewards',
      'startDate', 'endDate', 'isActive'
    ];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        program[field] = req.body[field];
      }
    });
    
    await program.save();
    
    res.json({
      success: true,
      message: 'Referral program updated successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Update referral program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update referral program'
    });
  }
};

// Delete referral program
const deleteReferralProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const program = await ReferralProgram.findOneAndDelete({
      _id: programId,
      tenancy: tenancyId
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Referral program not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Referral program deleted successfully'
    });
  } catch (error) {
    console.error('Delete referral program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete referral program'
    });
  }
};

// Get all referrals for tenancy
const getReferrals = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { page = 1, limit = 10, status, programId } = req.query;
    
    // Build filter
    const filter = { tenancy: tenancyId };
    
    if (status) {
      filter.status = status;
    }
    
    if (programId) {
      filter.program = programId;
    }
    
    const referrals = await Referral.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('referrer', 'name email phone')
      .populate('referee', 'name email phone')
      .populate('program', 'name')
      .populate('firstOrderId', 'orderNumber totalAmount');
    
    const total = await Referral.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        referrals,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referrals'
    });
  }
};

// Create referral for user
const createReferral = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { programId, userId } = req.body;
    
    // Validate program
    const program = await ReferralProgram.findOne({
      _id: programId,
      tenancy: tenancyId,
      isActive: true
    });
    
    if (!program || !program.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive referral program'
      });
    }
    
    // Validate user
    const user = await User.findOne({
      _id: userId,
      tenancy: tenancyId
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user has reached max referrals
    if (program.maxReferralsPerUser > 0) {
      const existingReferrals = await Referral.countDocuments({
        tenancy: tenancyId,
        program: programId,
        referrer: userId,
        status: { $in: ['pending', 'completed'] }
      });
      
      if (existingReferrals >= program.maxReferralsPerUser) {
        return res.status(400).json({
          success: false,
          message: 'Maximum referrals limit reached for this user'
        });
      }
    }
    
    // Create referral
    const referral = new Referral({
      tenancy: tenancyId,
      program: programId,
      referrer: userId,
      expiresAt: new Date(Date.now() + program.referralCodeExpiry * 24 * 60 * 60 * 1000)
    });
    
    await referral.save();
    
    res.status(201).json({
      success: true,
      message: 'Referral created successfully',
      data: { referral }
    });
  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create referral'
    });
  }
};

// Process referral (when referee makes first order)
const processReferral = async (req, res) => {
  try {
    const { referralCode, orderId } = req.body;
    const tenancyId = req.user.tenancy;
    
    // Find referral
    const referral = await Referral.findOne({
      code: referralCode.toUpperCase(),
      tenancy: tenancyId
    }).populate('program');
    
    if (!referral || !referral.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired referral code'
      });
    }
    
    // Get order details
    const Order = require('../../models/Order');
    const order = await Order.findOne({
      _id: orderId,
      tenancy: tenancyId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check minimum order value
    if (order.totalAmount < referral.program.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Order value must be at least $${referral.program.minOrderValue} for referral reward`
      });
    }
    
    // Record conversion
    await referral.recordConversion(order);
    
    // Give rewards
    await referral.giveRewards();
    
    res.json({
      success: true,
      message: 'Referral processed successfully',
      data: { referral }
    });
  } catch (error) {
    console.error('Process referral error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process referral'
    });
  }
};

// Get referral analytics
const getReferralAnalytics = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { programId, startDate, endDate } = req.query;
    
    // Build match filter
    const matchFilter = { tenancy: tenancyId };
    
    if (programId) {
      matchFilter.program = programId;
    }
    
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }
    
    // Aggregate analytics
    const analytics = await Referral.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          completedReferrals: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalClicks: { $sum: '$clicks' },
          totalSignups: { $sum: '$signups' },
          totalConversions: { $sum: '$conversions' },
          totalOrderValue: { $sum: '$firstOrderValue' },
          avgOrderValue: { $avg: '$firstOrderValue' }
        }
      }
    ]);
    
    const result = analytics[0] || {
      totalReferrals: 0,
      completedReferrals: 0,
      totalClicks: 0,
      totalSignups: 0,
      totalConversions: 0,
      totalOrderValue: 0,
      avgOrderValue: 0
    };
    
    // Calculate conversion rates
    result.clickToSignupRate = result.totalClicks > 0 ? 
      (result.totalSignups / result.totalClicks) * 100 : 0;
    result.signupToConversionRate = result.totalSignups > 0 ? 
      (result.totalConversions / result.totalSignups) * 100 : 0;
    result.overallConversionRate = result.totalReferrals > 0 ? 
      (result.completedReferrals / result.totalReferrals) * 100 : 0;
    
    // Get top referrers
    const topReferrers = await Referral.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$referrer',
          referralCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalValue: { $sum: '$firstOrderValue' }
        }
      },
      { $sort: { completedCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          referralCount: 1,
          completedCount: 1,
          totalValue: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        analytics: result,
        topReferrers
      }
    });
  } catch (error) {
    console.error('Get referral analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral analytics'
    });
  }
};

// Get referral dashboard stats
const getReferralStats = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const stats = await ReferralProgram.aggregate([
      { $match: { tenancy: tenancyId } },
      {
        $group: {
          _id: null,
          totalPrograms: { $sum: 1 },
          activePrograms: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalReferrals: { $sum: '$totalReferrals' },
          successfulReferrals: { $sum: '$successfulReferrals' },
          totalRewards: { $sum: '$totalRewardsGiven' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalPrograms: 0,
      activePrograms: 0,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalRewards: 0
    };
    
    // Get recent referrals
    const recentReferrals = await Referral.find({ tenancy: tenancyId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('referrer', 'name email')
      .populate('referee', 'name email')
      .populate('program', 'name')
      .select('code status clicks conversions createdAt');
    
    res.json({
      success: true,
      data: {
        stats: result,
        recentReferrals
      }
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral statistics'
    });
  }
};

module.exports = {
  getReferralPrograms,
  getReferralProgramById,
  createReferralProgram,
  updateReferralProgram,
  deleteReferralProgram,
  getReferrals,
  createReferral,
  processReferral,
  getReferralAnalytics,
  getReferralStats
};