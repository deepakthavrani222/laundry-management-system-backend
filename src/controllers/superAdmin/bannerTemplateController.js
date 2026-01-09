const BannerTemplate = require('../../models/BannerTemplate');
const Banner = require('../../models/Banner');

/**
 * @route   POST /api/superadmin/banner-templates
 * @desc    Create a new banner template
 * @access  Super Admin
 */
exports.createTemplate = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      type,
      layout,
      allowedPositions,
      design,
      settings,
      responsive,
      previewImage
    } = req.body;

    // Check if template with same code exists
    const existingTemplate = await BannerTemplate.findOne({ code: code.toUpperCase() });
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Template with this code already exists'
      });
    }

    // Create template
    const template = await BannerTemplate.create({
      name,
      code: code.toUpperCase(),
      description,
      type,
      layout,
      allowedPositions,
      design,
      settings,
      responsive,
      previewImage,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Banner template created successfully',
      data: { template }
    });
  } catch (error) {
    console.error('Error creating banner template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create banner template'
    });
  }
};

/**
 * @route   GET /api/superadmin/banner-templates
 * @desc    Get all banner templates
 * @access  Super Admin
 */
exports.getAllTemplates = async (req, res) => {
  try {
    const { type, status, search } = req.query;
    
    const query = {};
    
    // Filter by type
    if (type) {
      query.type = type;
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Search by name or code
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    
    const templates = await BannerTemplate.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ type: 1, name: 1 });
    
    res.json({
      success: true,
      data: {
        templates,
        count: templates.length
      }
    });
  } catch (error) {
    console.error('Error fetching banner templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner templates'
    });
  }
};

/**
 * @route   GET /api/superadmin/banner-templates/:id
 * @desc    Get single banner template
 * @access  Super Admin
 */
exports.getTemplateById = async (req, res) => {
  try {
    const template = await BannerTemplate.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Get usage count (banners using this template)
    const bannersCount = await Banner.countDocuments({ template: template._id });
    
    res.json({
      success: true,
      data: {
        template,
        bannersCount
      }
    });
  } catch (error) {
    console.error('Error fetching banner template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner template'
    });
  }
};

/**
 * @route   PUT /api/superadmin/banner-templates/:id
 * @desc    Update banner template
 * @access  Super Admin
 */
exports.updateTemplate = async (req, res) => {
  try {
    const template = await BannerTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    const {
      name,
      description,
      layout,
      allowedPositions,
      design,
      settings,
      responsive,
      previewImage
    } = req.body;
    
    // Update fields (code and type cannot be changed)
    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (layout) template.layout = layout;
    if (allowedPositions) template.allowedPositions = allowedPositions;
    if (design) template.design = design;
    if (settings) template.settings = settings;
    if (responsive) template.responsive = responsive;
    if (previewImage !== undefined) template.previewImage = previewImage;
    
    template.updatedBy = req.user._id;
    
    await template.save();
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      data: { template }
    });
  } catch (error) {
    console.error('Error updating banner template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update banner template'
    });
  }
};

/**
 * @route   DELETE /api/superadmin/banner-templates/:id
 * @desc    Delete banner template
 * @access  Super Admin
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await BannerTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Check if any banners are using this template
    const bannersCount = await Banner.countDocuments({ template: template._id });
    
    if (bannersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete template. ${bannersCount} banner(s) are using this template.`
      });
    }
    
    await template.deleteOne();
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting banner template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner template'
    });
  }
};

/**
 * @route   PATCH /api/superadmin/banner-templates/:id/status
 * @desc    Toggle template status (ACTIVE/INACTIVE)
 * @access  Super Admin
 */
exports.toggleTemplateStatus = async (req, res) => {
  try {
    const template = await BannerTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Toggle status
    template.status = template.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    template.updatedBy = req.user._id;
    
    await template.save();
    
    res.json({
      success: true,
      message: `Template ${template.status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
      data: { template }
    });
  } catch (error) {
    console.error('Error toggling template status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle template status'
    });
  }
};

/**
 * @route   GET /api/superadmin/banner-templates/stats/usage
 * @desc    Get template usage statistics
 * @access  Super Admin
 */
exports.getTemplateStats = async (req, res) => {
  try {
    // Get all templates with usage count
    const templates = await BannerTemplate.find().select('name code type status usageCount');
    
    // Get banner counts per template
    const bannerCounts = await Banner.aggregate([
      {
        $group: {
          _id: '$template',
          totalBanners: { $sum: 1 },
          activeBanners: {
            $sum: { $cond: [{ $eq: ['$state', 'ACTIVE'] }, 1, 0] }
          }
        }
      }
    ]);
    
    // Merge data
    const stats = templates.map(template => {
      const bannerData = bannerCounts.find(bc => bc._id.toString() === template._id.toString());
      return {
        templateId: template._id,
        name: template.name,
        code: template.code,
        type: template.type,
        status: template.status,
        usageCount: template.usageCount,
        totalBanners: bannerData?.totalBanners || 0,
        activeBanners: bannerData?.activeBanners || 0
      };
    });
    
    // Overall stats
    const overall = {
      totalTemplates: templates.length,
      activeTemplates: templates.filter(t => t.status === 'ACTIVE').length,
      inactiveTemplates: templates.filter(t => t.status === 'INACTIVE').length,
      totalBanners: bannerCounts.reduce((sum, bc) => sum + bc.totalBanners, 0),
      activeBanners: bannerCounts.reduce((sum, bc) => sum + bc.activeBanners, 0)
    };
    
    res.json({
      success: true,
      data: {
        templates: stats,
        overall
      }
    });
  } catch (error) {
    console.error('Error fetching template stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template statistics'
    });
  }
};

/**
 * @route   GET /api/superadmin/banner-templates/by-type/:type
 * @desc    Get templates by type
 * @access  Super Admin
 */
exports.getTemplatesByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    const templates = await BannerTemplate.find({ 
      type: type.toUpperCase(),
      status: 'ACTIVE'
    }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: {
        templates,
        count: templates.length
      }
    });
  } catch (error) {
    console.error('Error fetching templates by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
};
