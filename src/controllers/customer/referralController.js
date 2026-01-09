const { ReferralProgram, Referral } = require('../../models/Referral');

// Get customer's referral code and stats
const getReferralCode = async (req, res) => {
  try {
    const userId = req.user._id;
    const tenancyId = req.user.tenancy;
    
    // Find active referral program
    const program = await ReferralProgram.findOne({
      tenancy: tenancyId,
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ]
    });
    
    if (!program || !program.isValid()) {
      return res.json({
        success: true,
        data: {
          hasProgram: false,
          message: 'No active referral program available'
        }
      });
    }
    
    // Find or create referral
    let referral = await Referral.findOne({
      tenancy: tenancyId,
      program: program._id,
      referrer: userId,
      status: { $in: ['pending', 'completed'] }
    });
    
    if (!referral) {
      // Generate unique referral code
      const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };
      
      const code = generateCode();
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      const link = `${baseUrl}/register?ref=${code}`;
      
      // Create new referral
      referral = new Referral({
        tenancy: tenancyId,
        program: program._id,
        referrer: userId,
        code: code,
        link: link,
        expiresAt: new Date(Date.now() + program.referralCodeExpiry * 24 * 60 * 60 * 1000)
      });
      
      await referral.save();
      console.log(`✅ Created new referral code: ${code} for user ${userId}`);
    }
    
    // Get referral stats
    const stats = await Referral.aggregate([
      {
        $match: {
          tenancy: tenancyId,
          referrer: userId
        }
      },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          completedReferrals: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalClicks: { $sum: '$clicks' },
          totalSignups: { $sum: '$signups' },
          totalConversions: { $sum: '$conversions' },
          totalRewards: { $sum: '$rewardsGiven.referrer.value' }
        }
      }
    ]);
    
    const referralStats = stats[0] || {
      totalReferrals: 0,
      completedReferrals: 0,
      totalClicks: 0,
      totalSignups: 0,
      totalConversions: 0,
      totalRewards: 0
    };
    
    // Generate referral link
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const referralLink = `${baseUrl}/register?ref=${referral.code}`;
    
    console.log(`✅ Returning referral code: ${referral.code} for user ${userId}`);
    
    res.json({
      success: true,
      data: {
        hasProgram: true,
        referralCode: referral.code,
        referralLink,
        program: {
          _id: program._id,
          name: program.name,
          description: program.description,
          referrerReward: program.referrerReward,
          refereeReward: program.refereeReward,
          minOrderValue: program.minOrderValue
        },
        stats: referralStats,
        expiresAt: referral.expiresAt
      }
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral code'
    });
  }
};

// Track referral share (when user shares link)
const trackReferralShare = async (req, res) => {
  try {
    const userId = req.user._id;
    const tenancyId = req.user.tenancy;
    const { platform } = req.body; // whatsapp, email, copy, etc.
    
    // Find user's referral
    const referral = await Referral.findOne({
      tenancy: tenancyId,
      referrer: userId,
      status: { $in: ['pending', 'completed'] }
    });
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }
    
    // Track share (you can add more detailed tracking if needed)
    // For now, just acknowledge the share
    
    res.json({
      success: true,
      message: 'Referral share tracked',
      data: {
        platform,
        referralCode: referral.code
      }
    });
  } catch (error) {
    console.error('Track referral share error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track referral share'
    });
  }
};

// Get referral statistics
const getReferralStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const tenancyId = req.user.tenancy;
    
    // Get all referrals by this user
    const referrals = await Referral.find({
      tenancy: tenancyId,
      referrer: userId
    })
    .populate('referee', 'name email')
    .populate('firstOrderId', 'orderNumber totalAmount')
    .sort({ createdAt: -1 });
    
    // Calculate stats
    const stats = {
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter(r => r.status === 'pending').length,
      completedReferrals: referrals.filter(r => r.status === 'completed').length,
      expiredReferrals: referrals.filter(r => r.status === 'expired').length,
      totalClicks: referrals.reduce((sum, r) => sum + r.clicks, 0),
      totalSignups: referrals.reduce((sum, r) => sum + r.signups, 0),
      totalConversions: referrals.reduce((sum, r) => sum + r.conversions, 0),
      totalRewardsEarned: referrals.reduce((sum, r) => sum + (r.rewardsGiven?.referrer?.value || 0), 0),
      conversionRate: 0
    };
    
    if (stats.totalSignups > 0) {
      stats.conversionRate = (stats.totalConversions / stats.totalSignups) * 100;
    }
    
    // Recent referrals
    const recentReferrals = referrals.slice(0, 10).map(r => ({
      _id: r._id,
      code: r.code,
      status: r.status,
      referee: r.referee ? {
        name: r.referee.name,
        email: r.referee.email
      } : null,
      firstOrder: r.firstOrderId ? {
        orderNumber: r.firstOrderId.orderNumber,
        totalAmount: r.firstOrderId.totalAmount
      } : null,
      rewardEarned: r.rewardsGiven?.referrer?.value || 0,
      createdAt: r.createdAt
    }));
    
    res.json({
      success: true,
      data: {
        stats,
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

// Apply referral code (used during registration)
const applyReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    const tenancyId = req.body.tenancyId || req.user?.tenancy;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Referral code is required'
      });
    }
    
    // Find referral
    const referral = await Referral.findOne({
      code: code.toUpperCase(),
      tenancy: tenancyId
    }).populate('program');
    
    if (!referral || !referral.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired referral code'
      });
    }
    
    // Check if program is still active
    if (!referral.program.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Referral program is no longer active'
      });
    }
    
    // Check max referrals limit
    if (referral.program.maxReferralsPerUser > 0) {
      const referralCount = await Referral.countDocuments({
        tenancy: tenancyId,
        program: referral.program._id,
        referrer: referral.referrer,
        status: { $in: ['pending', 'completed'] }
      });
      
      if (referralCount >= referral.program.maxReferralsPerUser) {
        return res.status(400).json({
          success: false,
          message: 'Referral limit reached for this code'
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        referralCode: referral.code,
        refereeReward: referral.program.refereeReward,
        minOrderValue: referral.program.minOrderValue,
        message: `You'll receive ${referral.program.refereeReward.type === 'credit' ? '₹' : ''}${referral.program.refereeReward.value}${referral.program.refereeReward.type === 'discount' ? '%' : ''} ${referral.program.refereeReward.type} on your first order!`
      }
    });
  } catch (error) {
    console.error('Apply referral code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply referral code'
    });
  }
};

module.exports = {
  getReferralCode,
  trackReferralShare,
  getReferralStats,
  applyReferralCode
};
