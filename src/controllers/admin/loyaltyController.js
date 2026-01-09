const { LoyaltyProgram, LoyaltyMember, LoyaltyTransaction } = require('../../models/LoyaltyProgram');
const User = require('../../models/User');
const { validationResult } = require('express-validator');

// Get all loyalty programs for tenancy
const getLoyaltyPrograms = async (req, res) => {
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
      filter.type = type;
    }
    
    const programs = await LoyaltyProgram.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');
    
    const total = await LoyaltyProgram.countDocuments(filter);
    
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
    console.error('Get loyalty programs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty programs'
    });
  }
};

// Get single loyalty program
const getLoyaltyProgramById = async (req, res) => {
  try {
    const { programId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const program = await LoyaltyProgram.findOne({ 
      _id: programId, 
      tenancy: tenancyId 
    }).populate('createdBy', 'name email');
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }
    
    res.json({
      success: true,
      data: { program }
    });
  } catch (error) {
    console.error('Get loyalty program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty program'
    });
  }
};

// Create loyalty program
const createLoyaltyProgram = async (req, res) => {
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
      name, description, type, pointsConfig, tiers, tierResetPeriod,
      punchCardConfig, cashbackConfig, subscriptionConfig,
      autoEnrollment, welcomeBonus, startDate, endDate, isActive
    } = req.body;
    
    // Validate subscription config if type is subscription
    if (type === 'subscription' && (!subscriptionConfig || !subscriptionConfig.monthlyFee)) {
      return res.status(400).json({
        success: false,
        message: 'Monthly fee is required for subscription type programs'
      });
    }
    
    const program = new LoyaltyProgram({
      tenancy: tenancyId,
      name,
      description,
      type,
      pointsConfig,
      tiers,
      tierResetPeriod,
      punchCardConfig,
      cashbackConfig,
      subscriptionConfig: type === 'subscription' ? subscriptionConfig : undefined,
      autoEnrollment: autoEnrollment !== false,
      welcomeBonus,
      startDate,
      endDate,
      isActive: isActive !== false,
      createdBy: req.user._id,
      createdByModel: 'User'
    });
    
    await program.save();
    
    res.status(201).json({
      success: true,
      message: 'Loyalty program created successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Create loyalty program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create loyalty program'
    });
  }
};

// Update loyalty program
const updateLoyaltyProgram = async (req, res) => {
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
    
    const program = await LoyaltyProgram.findOne({
      _id: programId,
      tenancy: tenancyId
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }
    
    const updateFields = [
      'name', 'description', 'type', 'pointsConfig', 'tiers', 'tierResetPeriod',
      'punchCardConfig', 'cashbackConfig', 'subscriptionConfig',
      'autoEnrollment', 'welcomeBonus', 'startDate', 'endDate', 'isActive'
    ];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        program[field] = req.body[field];
      }
    });
    
    await program.save();
    
    res.json({
      success: true,
      message: 'Loyalty program updated successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Update loyalty program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update loyalty program'
    });
  }
};

// Delete loyalty program
const deleteLoyaltyProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const tenancyId = req.user.tenancy;
    
    // Check if program has active members
    const memberCount = await LoyaltyMember.countDocuments({
      program: programId,
      isActive: true
    });
    
    if (memberCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete program with active members. Deactivate the program instead.'
      });
    }
    
    const program = await LoyaltyProgram.findOneAndDelete({
      _id: programId,
      tenancy: tenancyId
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Loyalty program deleted successfully'
    });
  } catch (error) {
    console.error('Delete loyalty program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete loyalty program'
    });
  }
};

// Get loyalty members
const getLoyaltyMembers = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { page = 1, limit = 10, programId, tier, search } = req.query;
    
    // Build filter
    const filter = { tenancy: tenancyId };
    
    if (programId) {
      filter.program = programId;
    }
    
    if (tier) {
      filter['currentTier.name'] = tier;
    }
    
    // Build aggregation pipeline
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $lookup: {
          from: 'loyaltyprograms',
          localField: 'program',
          foreignField: '_id',
          as: 'programDetails'
        }
      },
      { $unwind: '$programDetails' }
    ];
    
    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'userDetails.name': { $regex: search, $options: 'i' } },
            { 'userDetails.email': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }
    
    // Add sorting and pagination
    pipeline.push(
      { $sort: { pointsBalance: -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit * 1 }
    );
    
    const members = await LoyaltyMember.aggregate(pipeline);
    
    // Get total count
    const totalPipeline = [...pipeline.slice(0, -3)]; // Remove sort, skip, limit
    totalPipeline.push({ $count: 'total' });
    const totalResult = await LoyaltyMember.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;
    
    res.json({
      success: true,
      data: {
        members,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get loyalty members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty members'
    });
  }
};

// Get single loyalty member
const getLoyaltyMemberById = async (req, res) => {
  try {
    const { memberId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const member = await LoyaltyMember.findOne({
      _id: memberId,
      tenancy: tenancyId
    })
    .populate('user', 'name email phone')
    .populate('program', 'name type');
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty member not found'
      });
    }
    
    // Get recent transactions
    const transactions = await LoyaltyTransaction.find({
      member: memberId,
      tenancy: tenancyId
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('order', 'orderNumber totalAmount');
    
    res.json({
      success: true,
      data: {
        member,
        transactions
      }
    });
  } catch (error) {
    console.error('Get loyalty member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty member'
    });
  }
};

// Enroll user in loyalty program
const enrollUser = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { programId, userId } = req.body;
    
    // Validate program
    const program = await LoyaltyProgram.findOne({
      _id: programId,
      tenancy: tenancyId,
      isActive: true
    });
    
    if (!program || !program.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive loyalty program'
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
    
    // Check if user is already enrolled
    const existingMember = await LoyaltyMember.findOne({
      program: programId,
      user: userId
    });
    
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already enrolled in this program'
      });
    }
    
    // Create loyalty member
    const member = new LoyaltyMember({
      tenancy: tenancyId,
      program: programId,
      user: userId,
      enrollmentSource: 'manual'
    });
    
    // Give welcome bonus if configured
    if (program.welcomeBonus) {
      if (program.welcomeBonus.points > 0) {
        member.pointsBalance = program.welcomeBonus.points;
        member.lifetimePoints = program.welcomeBonus.points;
      }
      
      if (program.welcomeBonus.credit > 0) {
        if (!user.wallet) user.wallet = { balance: 0 };
        user.wallet.balance += program.welcomeBonus.credit;
        await user.save();
      }
    }
    
    await member.save();
    
    // Update program stats
    program.totalMembers += 1;
    program.activeMembers += 1;
    await program.save();
    
    res.status(201).json({
      success: true,
      message: 'User enrolled in loyalty program successfully',
      data: { member }
    });
  } catch (error) {
    console.error('Enroll user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll user in loyalty program'
    });
  }
};

// Award points to member
const awardPoints = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { points, reason, orderId } = req.body;
    const tenancyId = req.user.tenancy;
    
    const member = await LoyaltyMember.findOne({
      _id: memberId,
      tenancy: tenancyId
    });
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty member not found'
      });
    }
    
    // Get order if provided
    let order = null;
    if (orderId) {
      const Order = require('../../models/Order');
      order = await Order.findOne({
        _id: orderId,
        tenancy: tenancyId
      });
    }
    
    await member.addPoints(points, reason || 'manual_award', order);
    
    res.json({
      success: true,
      message: 'Points awarded successfully',
      data: { member }
    });
  } catch (error) {
    console.error('Award points error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to award points'
    });
  }
};

// Redeem points
const redeemPoints = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { points, redemptionType, value } = req.body;
    const tenancyId = req.user.tenancy;
    
    const member = await LoyaltyMember.findOne({
      _id: memberId,
      tenancy: tenancyId
    });
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty member not found'
      });
    }
    
    await member.redeemPoints(points, redemptionType, value);
    
    res.json({
      success: true,
      message: 'Points redeemed successfully',
      data: { member }
    });
  } catch (error) {
    console.error('Redeem points error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to redeem points'
    });
  }
};

// Get loyalty analytics
const getLoyaltyAnalytics = async (req, res) => {
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
    
    // Member analytics
    const memberAnalytics = await LoyaltyMember.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          activeMembers: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalPoints: { $sum: '$pointsBalance' },
          totalLifetimePoints: { $sum: '$lifetimePoints' },
          totalRedeemedPoints: { $sum: '$redeemedPoints' },
          avgPointsBalance: { $avg: '$pointsBalance' },
          totalSpent: { $sum: '$totalSpent' },
          totalOrders: { $sum: '$totalOrders' }
        }
      }
    ]);
    
    // Transaction analytics
    const transactionAnalytics = await LoyaltyTransaction.aggregate([
      { $match: { ...matchFilter, type: 'earned' } },
      {
        $group: {
          _id: '$earningSource',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points' }
        }
      }
    ]);
    
    // Tier distribution
    const tierDistribution = await LoyaltyMember.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$currentTier.name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const result = {
      members: memberAnalytics[0] || {
        totalMembers: 0,
        activeMembers: 0,
        totalPoints: 0,
        totalLifetimePoints: 0,
        totalRedeemedPoints: 0,
        avgPointsBalance: 0,
        totalSpent: 0,
        totalOrders: 0
      },
      transactions: transactionAnalytics,
      tierDistribution
    };
    
    res.json({
      success: true,
      data: { analytics: result }
    });
  } catch (error) {
    console.error('Get loyalty analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty analytics'
    });
  }
};

// Get loyalty dashboard stats
const getLoyaltyStats = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const stats = await LoyaltyProgram.aggregate([
      { $match: { tenancy: tenancyId } },
      {
        $group: {
          _id: null,
          totalPrograms: { $sum: 1 },
          activePrograms: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalMembers: { $sum: '$totalMembers' },
          activeMembers: { $sum: '$activeMembers' },
          totalPointsIssued: { $sum: '$totalPointsIssued' },
          totalPointsRedeemed: { $sum: '$totalPointsRedeemed' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalPrograms: 0,
      activePrograms: 0,
      totalMembers: 0,
      activeMembers: 0,
      totalPointsIssued: 0,
      totalPointsRedeemed: 0
    };
    
    // Get recent transactions
    const recentTransactions = await LoyaltyTransaction.find({ tenancy: tenancyId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'member',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .select('type points description createdAt');
    
    res.json({
      success: true,
      data: {
        stats: result,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Get loyalty stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty statistics'
    });
  }
};

module.exports = {
  getLoyaltyPrograms,
  getLoyaltyProgramById,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
  getLoyaltyMembers,
  getLoyaltyMemberById,
  enrollUser,
  awardPoints,
  redeemPoints,
  getLoyaltyAnalytics,
  getLoyaltyStats
};