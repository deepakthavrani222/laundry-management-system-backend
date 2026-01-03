const Tenancy = require('../models/Tenancy');

/**
 * Middleware to handle subdomain-based routing
 * Extracts tenancy from subdomain and attaches to request
 */
const subdomainRouter = async (req, res, next) => {
  try {
    const host = req.get('host') || '';
    const origin = req.get('origin') || '';
    
    // Skip for API-only requests or admin/superadmin portals
    if (host.startsWith('api.') || host.startsWith('admin.') || host.startsWith('superadmin.')) {
      return next();
    }

    // Extract subdomain
    let subdomain = null;
    const hostParts = host.split('.');
    
    // Handle different domain patterns
    // e.g., quickwash.laundry-platform.com -> quickwash
    // e.g., quickwash.localhost:3000 -> quickwash
    if (hostParts.length >= 2) {
      const potentialSubdomain = hostParts[0].toLowerCase();
      
      // Skip common non-tenant subdomains
      const skipSubdomains = ['www', 'api', 'admin', 'superadmin', 'localhost', 'app'];
      if (!skipSubdomains.includes(potentialSubdomain)) {
        subdomain = potentialSubdomain;
      }
    }

    // Also check X-Subdomain header (for development/testing)
    if (!subdomain && req.headers['x-subdomain']) {
      subdomain = req.headers['x-subdomain'].toLowerCase();
    }

    if (subdomain) {
      // Find tenancy by subdomain
      const tenancy = await Tenancy.findOne({
        $or: [
          { subdomain: subdomain },
          { slug: subdomain }
        ],
        status: { $in: ['active', 'trial'] }
      });

      if (tenancy) {
        req.tenancy = tenancy;
        req.tenancyId = tenancy._id;
        req.tenancySubdomain = subdomain;
        
        // Set response header for client-side detection
        res.setHeader('X-Tenancy-ID', tenancy._id.toString());
        res.setHeader('X-Tenancy-Name', tenancy.name);
      } else {
        // Tenancy not found - could redirect to main site or show error
        // For now, continue without tenancy
        console.log(`Tenancy not found for subdomain: ${subdomain}`);
      }
    }

    next();
  } catch (error) {
    console.error('Subdomain routing error:', error);
    next();
  }
};

/**
 * Middleware to require valid subdomain/tenancy
 * Use this for routes that must have a tenancy context
 */
const requireSubdomain = (req, res, next) => {
  if (!req.tenancy) {
    return res.status(400).json({
      success: false,
      message: 'Please access this service through your laundry portal',
      code: 'TENANCY_REQUIRED'
    });
  }
  next();
};

/**
 * Get tenancy info for frontend
 */
const getTenancyInfo = async (req, res) => {
  try {
    const { subdomain } = req.params;
    
    const tenancy = await Tenancy.findOne({
      $or: [
        { subdomain: subdomain },
        { slug: subdomain }
      ],
      status: { $in: ['active', 'trial'] }
    }).select('name subdomain branding contact businessHours status');

    if (!tenancy) {
      return res.status(404).json({
        success: false,
        message: 'Laundry service not found'
      });
    }

    res.json({
      success: true,
      data: {
        name: tenancy.name,
        subdomain: tenancy.subdomain,
        branding: tenancy.branding,
        contact: tenancy.contact,
        businessHours: tenancy.businessHours,
        portalUrl: tenancy.portalUrl
      }
    });
  } catch (error) {
    console.error('Get tenancy info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenancy information'
    });
  }
};

module.exports = {
  subdomainRouter,
  requireSubdomain,
  getTenancyInfo
};
