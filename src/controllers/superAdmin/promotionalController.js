const Discount = require('../../models/Discount');
const { ReferralProgram } = require('../../models/Referral');
const { LoyaltyProgram } = require('../../models/LoyaltyProgram');
const Coupon = require('../../models/Coupon');
const Tenancy = require('../../models/Tenancy');
const { validationResult } = require('express-validator');

// ============ GLOBAL DISCOUNTS ============

// Get all global discounts
const getGlobalDiscounts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, type } = req.query;
    
    // Build filter for global discounts
    const filter = { isGlobal: true };
    
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
      .populate('applicableTenancies', 'name slug')
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
    console.error('Get global discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global discounts'
    });
  }
};

// Create global discount
const createGlobalDiscount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const {
      name, description, rules, priority,
      canStackWithCoupons, canStackWithOtherDiscounts,
      startDate, endDate, usageLimit, perUserLimit,
      isActive, applicableTenancies
    } = req.body;
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    const discount = new Discount({
      tenancy: null, // Global discounts don't belong to a specific tenancy
      isGlobal: true,
      applicableTenancies: applicableTenancies || [],
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
      createdByModel: 'SuperAdmin'
    });
    
    await discount.save();
    
    res.status(201).json({
      success: true,
      message: 'Global discount created successfully',
      data: { discount }
    });
  } catch (error) {
    console.error('Create global discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global discount'
    });
  }
};

// Update global discount
const updateGlobalDiscount = async (req, res) => {
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
    
    const discount = await Discount.findOne({
      _id: discountId,
      isGlobal: true
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Global discount not found'
      });
    }
    
    const {
      name, description, rules, priority,
      canStackWithCoupons, canStackWithOtherDiscounts,
      startDate, endDate, usageLimit, perUserLimit,
      isActive, applicableTenancies
    } = req.body;
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
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
    if (applicableTenancies !== undefined) discount.applicableTenancies = applicableTenancies;
    
    discount.updatedBy = req.user._id;
    discount.updatedByModel = 'SuperAdmin';
    
    await discount.save();
    
    res.json({
      success: true,
      message: 'Global discount updated successfully',
      data: { discount }
    });
  } catch (error) {
    console.error('Update global discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global discount'
    });
  }
};

// Delete global discount
const deleteGlobalDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;
    
    const discount = await Discount.findOne({
      _id: discountId,
      isGlobal: true
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Global discount not found'
      });
    }
    
    await Discount.findByIdAndDelete(discountId);
    
    res.json({
      success: true,
      message: 'Global discount deleted successfully'
    });
  } catch (error) {
    console.error('Delete global discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete global discount'
    });
  }
};

// ============ GLOBAL COUPONS ============

// Get all global coupons
const getGlobalCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, type } = req.query;
    
    // Build filter for global coupons
    const filter = { isGlobal: true };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      filter.isActive = status === 'active';
    }
    
    if (type) {
      filter.type = type;
    }
    
    const coupons = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('applicableTenancies', 'name slug')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    const total = await Coupon.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        coupons,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get global coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global coupons'
    });
  }
};

// Create global coupon
const createGlobalCoupon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const {
      code, name, description, type, value, minOrderValue, maxDiscount,
      usageLimit, perUserLimit, startDate, endDate, isActive,
      applicableServices, applicableTenancies
    } = req.body;
    
    // Check if code already exists globally
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isGlobal: true
    });
    
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'A global coupon with this code already exists'
      });
    }
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    const coupon = new Coupon({
      isGlobal: true,
      applicableTenancies: applicableTenancies || [],
      code: code.toUpperCase(),
      name,
      description,
      type,
      value,
      minOrderValue: minOrderValue || 0,
      maxDiscount: maxDiscount || 0,
      usageLimit: usageLimit || 0,
      perUserLimit: perUserLimit || 1,
      startDate,
      endDate,
      isActive: isActive !== false,
      applicableServices: applicableServices || ['all'],
      createdBy: req.user._id,
      createdByModel: 'SuperAdmin'
    });
    
    await coupon.save();
    
    res.status(201).json({
      success: true,
      message: 'Global coupon created successfully',
      data: { coupon }
    });
  } catch (error) {
    console.error('Create global coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global coupon'
    });
  }
};

// Update global coupon
const updateGlobalCoupon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { couponId } = req.params;
    
    const coupon = await Coupon.findOne({
      _id: couponId,
      isGlobal: true
    });
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Global coupon not found'
      });
    }
    
    const {
      code, name, description, type, value, minOrderValue, maxDiscount,
      usageLimit, perUserLimit, startDate, endDate, isActive,
      applicableServices, applicableTenancies
    } = req.body;
    
    // Check if code already exists (excluding current coupon)
    if (code && code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: code.toUpperCase(),
        isGlobal: true,
        _id: { $ne: couponId }
      });
      
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'A global coupon with this code already exists'
        });
      }
    }
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    // Update fields
    if (code !== undefined) coupon.code = code.toUpperCase();
    if (name !== undefined) coupon.name = name;
    if (description !== undefined) coupon.description = description;
    if (type !== undefined) coupon.type = type;
    if (value !== undefined) coupon.value = value;
    if (minOrderValue !== undefined) coupon.minOrderValue = minOrderValue;
    if (maxDiscount !== undefined) coupon.maxDiscount = maxDiscount;
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
    if (perUserLimit !== undefined) coupon.perUserLimit = perUserLimit;
    if (startDate !== undefined) coupon.startDate = startDate;
    if (endDate !== undefined) coupon.endDate = endDate;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (applicableServices !== undefined) coupon.applicableServices = applicableServices;
    if (applicableTenancies !== undefined) coupon.applicableTenancies = applicableTenancies;
    
    coupon.updatedBy = req.user._id;
    coupon.updatedByModel = 'SuperAdmin';
    
    await coupon.save();
    
    res.json({
      success: true,
      message: 'Global coupon updated successfully',
      data: { coupon }
    });
  } catch (error) {
    console.error('Update global coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global coupon'
    });
  }
};

// Delete global coupon
const deleteGlobalCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    
    const coupon = await Coupon.findOne({
      _id: couponId,
      isGlobal: true
    });
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Global coupon not found'
      });
    }
    
    await Coupon.findByIdAndDelete(couponId);
    
    res.json({
      success: true,
      message: 'Global coupon deleted successfully'
    });
  } catch (error) {
    console.error('Delete global coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete global coupon'
    });
  }
};

// ============ GLOBAL REFERRAL PROGRAMS ============

// Get all global referral programs
const getGlobalReferralPrograms = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    // Build filter for global programs
    const filter = { isGlobal: true };
    
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
      .populate('applicableTenancies', 'name slug')
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
    console.error('Get global referral programs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global referral programs'
    });
  }
};

// Create global referral program
const createGlobalReferralProgram = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const {
      name, description, referrerReward, refereeReward,
      minOrderValue, maxReferralsPerUser, referralCodeExpiry,
      enableMultiLevel, maxLevels, levelRewards,
      startDate, endDate, isActive, applicableTenancies
    } = req.body;
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    const program = new ReferralProgram({
      tenancy: null, // Global programs don't belong to a specific tenancy
      isGlobal: true,
      applicableTenancies: applicableTenancies || [],
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
      createdByModel: 'SuperAdmin'
    });
    
    await program.save();
    
    res.status(201).json({
      success: true,
      message: 'Global referral program created successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Create global referral program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global referral program'
    });
  }
};

// Update global referral program
const updateGlobalReferralProgram = async (req, res) => {
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
    
    const program = await ReferralProgram.findOne({
      _id: programId,
      isGlobal: true
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Global referral program not found'
      });
    }
    
    const {
      name, description, referrerReward, refereeReward,
      minOrderValue, maxReferralsPerUser, referralCodeExpiry,
      enableMultiLevel, maxLevels, levelRewards,
      startDate, endDate, isActive, applicableTenancies
    } = req.body;
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    // Update fields
    if (name !== undefined) program.name = name;
    if (description !== undefined) program.description = description;
    if (referrerReward !== undefined) program.referrerReward = referrerReward;
    if (refereeReward !== undefined) program.refereeReward = refereeReward;
    if (minOrderValue !== undefined) program.minOrderValue = minOrderValue;
    if (maxReferralsPerUser !== undefined) program.maxReferralsPerUser = maxReferralsPerUser;
    if (referralCodeExpiry !== undefined) program.referralCodeExpiry = referralCodeExpiry;
    if (enableMultiLevel !== undefined) program.enableMultiLevel = enableMultiLevel;
    if (maxLevels !== undefined) program.maxLevels = maxLevels;
    if (levelRewards !== undefined) program.levelRewards = levelRewards;
    if (startDate !== undefined) program.startDate = startDate;
    if (endDate !== undefined) program.endDate = endDate;
    if (isActive !== undefined) program.isActive = isActive;
    if (applicableTenancies !== undefined) program.applicableTenancies = applicableTenancies;
    
    await program.save();
    
    res.json({
      success: true,
      message: 'Global referral program updated successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Update global referral program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global referral program'
    });
  }
};

// Delete global referral program
const deleteGlobalReferralProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    
    const program = await ReferralProgram.findOne({
      _id: programId,
      isGlobal: true
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Global referral program not found'
      });
    }
    
    await ReferralProgram.findByIdAndDelete(programId);
    
    res.json({
      success: true,
      message: 'Global referral program deleted successfully'
    });
  } catch (error) {
    console.error('Delete global referral program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete global referral program'
    });
  }
};

// ============ GLOBAL LOYALTY PROGRAMS ============

// Get all global loyalty programs
const getGlobalLoyaltyPrograms = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, type } = req.query;
    
    // Build filter for global programs
    const filter = { isGlobal: true };
    
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
      .populate('applicableTenancies', 'name slug')
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
    console.error('Get global loyalty programs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global loyalty programs'
    });
  }
};

// Create global loyalty program
const createGlobalLoyaltyProgram = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const {
      name, description, type, pointsConfig, tiers, tierResetPeriod,
      punchCardConfig, cashbackConfig, subscriptionConfig,
      autoEnrollment, welcomeBonus, startDate, endDate, 
      isActive, applicableTenancies
    } = req.body;
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    const program = new LoyaltyProgram({
      tenancy: null, // Global programs don't belong to a specific tenancy
      isGlobal: true,
      applicableTenancies: applicableTenancies || [],
      name,
      description,
      type,
      pointsConfig,
      tiers,
      tierResetPeriod,
      punchCardConfig,
      cashbackConfig,
      subscriptionConfig,
      autoEnrollment: autoEnrollment !== false,
      welcomeBonus,
      startDate,
      endDate,
      isActive: isActive !== false,
      createdBy: req.user._id,
      createdByModel: 'SuperAdmin'
    });
    
    await program.save();
    
    res.status(201).json({
      success: true,
      message: 'Global loyalty program created successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Create global loyalty program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global loyalty program'
    });
  }
};

// Update global loyalty program
const updateGlobalLoyaltyProgram = async (req, res) => {
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
    
    const program = await LoyaltyProgram.findOne({
      _id: programId,
      isGlobal: true
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Global loyalty program not found'
      });
    }
    
    const {
      name, description, type, pointsConfig, tiers, tierResetPeriod,
      punchCardConfig, cashbackConfig, subscriptionConfig,
      autoEnrollment, welcomeBonus, startDate, endDate, 
      isActive, applicableTenancies
    } = req.body;
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    // Update fields
    if (name !== undefined) program.name = name;
    if (description !== undefined) program.description = description;
    if (type !== undefined) program.type = type;
    if (pointsConfig !== undefined) program.pointsConfig = pointsConfig;
    if (tiers !== undefined) program.tiers = tiers;
    if (tierResetPeriod !== undefined) program.tierResetPeriod = tierResetPeriod;
    if (punchCardConfig !== undefined) program.punchCardConfig = punchCardConfig;
    if (cashbackConfig !== undefined) program.cashbackConfig = cashbackConfig;
    if (subscriptionConfig !== undefined) program.subscriptionConfig = subscriptionConfig;
    if (autoEnrollment !== undefined) program.autoEnrollment = autoEnrollment;
    if (welcomeBonus !== undefined) program.welcomeBonus = welcomeBonus;
    if (startDate !== undefined) program.startDate = startDate;
    if (endDate !== undefined) program.endDate = endDate;
    if (isActive !== undefined) program.isActive = isActive;
    if (applicableTenancies !== undefined) program.applicableTenancies = applicableTenancies;
    
    await program.save();
    
    res.json({
      success: true,
      message: 'Global loyalty program updated successfully',
      data: { program }
    });
  } catch (error) {
    console.error('Update global loyalty program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global loyalty program'
    });
  }
};

// Delete global loyalty program
const deleteGlobalLoyaltyProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    
    const program = await LoyaltyProgram.findOne({
      _id: programId,
      isGlobal: true
    });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Global loyalty program not found'
      });
    }
    
    await LoyaltyProgram.findByIdAndDelete(programId);
    
    res.json({
      success: true,
      message: 'Global loyalty program deleted successfully'
    });
  } catch (error) {
    console.error('Delete global loyalty program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete global loyalty program'
    });
  }
};

// ============ ANALYTICS & OVERVIEW ============

// Get promotional overview across all tenancies
const getPromotionalOverview = async (req, res) => {
  try {
    const { startDate, endDate, tenancyId } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    // Build tenancy filter
    const tenancyFilter = tenancyId ? { tenancy: tenancyId } : {};
    
    // Coupon analytics
    const couponStats = await Coupon.aggregate([
      { $match: { ...tenancyFilter, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalCoupons: { $sum: 1 },
          activeCoupons: { $sum: { $cond: ['$isActive', 1, 0] } },
          globalCoupons: { $sum: { $cond: ['$isGlobal', 1, 0] } },
          totalSavings: { $sum: '$totalSavings' },
          totalOrders: { $sum: '$totalOrders' },
          totalUsage: { $sum: '$usedCount' }
        }
      }
    ]);
    
    // Discount analytics
    const discountStats = await Discount.aggregate([
      { $match: { ...tenancyFilter, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalDiscounts: { $sum: 1 },
          activeDiscounts: { $sum: { $cond: ['$isActive', 1, 0] } },
          globalDiscounts: { $sum: { $cond: ['$isGlobal', 1, 0] } },
          totalSavings: { $sum: '$totalSavings' },
          totalOrders: { $sum: '$totalOrders' }
        }
      }
    ]);
    
    // Referral analytics
    const referralStats = await ReferralProgram.aggregate([
      { $match: { ...tenancyFilter, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalPrograms: { $sum: 1 },
          activePrograms: { $sum: { $cond: ['$isActive', 1, 0] } },
          globalPrograms: { $sum: { $cond: ['$isGlobal', 1, 0] } },
          totalReferrals: { $sum: '$totalReferrals' },
          successfulReferrals: { $sum: '$successfulReferrals' }
        }
      }
    ]);
    
    // Loyalty analytics
    const loyaltyStats = await LoyaltyProgram.aggregate([
      { $match: { ...tenancyFilter, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalPrograms: { $sum: 1 },
          activePrograms: { $sum: { $cond: ['$isActive', 1, 0] } },
          globalPrograms: { $sum: { $cond: ['$isGlobal', 1, 0] } },
          totalMembers: { $sum: '$totalMembers' },
          activeMembers: { $sum: '$activeMembers' },
          totalPointsIssued: { $sum: '$totalPointsIssued' }
        }
      }
    ]);
    
    // Tenancy performance
    const tenancyPerformance = await Discount.aggregate([
      { $match: { tenancy: { $ne: null }, ...dateFilter } },
      {
        $group: {
          _id: '$tenancy',
          discountCount: { $sum: 1 },
          totalSavings: { $sum: '$totalSavings' },
          totalOrders: { $sum: '$totalOrders' }
        }
      },
      {
        $lookup: {
          from: 'tenancies',
          localField: '_id',
          foreignField: '_id',
          as: 'tenancy'
        }
      },
      { $unwind: '$tenancy' },
      {
        $project: {
          tenancyName: '$tenancy.name',
          tenancySlug: '$tenancy.slug',
          discountCount: 1,
          totalSavings: 1,
          totalOrders: 1,
          avgSavingsPerOrder: {
            $cond: [
              { $gt: ['$totalOrders', 0] },
              { $divide: ['$totalSavings', '$totalOrders'] },
              0
            ]
          }
        }
      },
      { $sort: { totalSavings: -1 } },
      { $limit: 10 }
    ]);
    
    const overview = {
      coupons: couponStats[0] || {
        totalCoupons: 0,
        activeCoupons: 0,
        globalCoupons: 0,
        totalSavings: 0,
        totalOrders: 0,
        totalUsage: 0
      },
      discounts: discountStats[0] || {
        totalDiscounts: 0,
        activeDiscounts: 0,
        globalDiscounts: 0,
        totalSavings: 0,
        totalOrders: 0
      },
      referrals: referralStats[0] || {
        totalPrograms: 0,
        activePrograms: 0,
        globalPrograms: 0,
        totalReferrals: 0,
        successfulReferrals: 0
      },
      loyalty: loyaltyStats[0] || {
        totalPrograms: 0,
        activePrograms: 0,
        globalPrograms: 0,
        totalMembers: 0,
        activeMembers: 0,
        totalPointsIssued: 0
      },
      topTenancies: tenancyPerformance
    };
    
    res.json({
      success: true,
      data: { overview }
    });
  } catch (error) {
    console.error('Get promotional overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotional overview'
    });
  }
};

// Get tenancy list for dropdown/selection
const getTenanciesForSelection = async (req, res) => {
  try {
    const tenancies = await Tenancy.find({ status: 'active' })
      .select('name slug domain subdomain')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: { tenancies }
    });
  } catch (error) {
    console.error('Get tenancies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenancies'
    });
  }
};

module.exports = {
  // Global Discounts
  getGlobalDiscounts,
  createGlobalDiscount,
  updateGlobalDiscount,
  deleteGlobalDiscount,
  
  // Global Coupons
  getGlobalCoupons,
  createGlobalCoupon,
  updateGlobalCoupon,
  deleteGlobalCoupon,
  
  // Global Referral Programs
  getGlobalReferralPrograms,
  createGlobalReferralProgram,
  updateGlobalReferralProgram,
  deleteGlobalReferralProgram,
  
  // Global Loyalty Programs
  getGlobalLoyaltyPrograms,
  createGlobalLoyaltyProgram,
  updateGlobalLoyaltyProgram,
  deleteGlobalLoyaltyProgram,
  
  // Analytics & Overview
  getPromotionalOverview,
  getTenanciesForSelection
};