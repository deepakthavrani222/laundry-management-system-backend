const express = require('express');
const router = express.Router();
const Tenancy = require('../models/Tenancy');

// Get tenancy branding by subdomain/slug (public - no auth required)
router.get('/branding/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Find tenancy by slug, subdomain, or custom domain
    const tenancy = await Tenancy.findOne({
      $or: [
        { slug: identifier },
        { subdomain: identifier },
        { customDomain: identifier }
      ],
      status: 'active',
      isDeleted: false
    }).select('name slug subdomain customDomain branding contact businessHours settings.currency settings.language');
    
    if (!tenancy) {
      return res.status(404).json({
        success: false,
        message: 'Laundry not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        name: tenancy.name,
        slug: tenancy.slug,
        subdomain: tenancy.subdomain,
        customDomain: tenancy.customDomain,
        branding: tenancy.branding,
        contact: {
          email: tenancy.contact?.email,
          phone: tenancy.contact?.phone,
          whatsapp: tenancy.contact?.whatsapp
        },
        businessHours: tenancy.businessHours,
        currency: tenancy.settings?.currency,
        language: tenancy.settings?.language
      }
    });
  } catch (error) {
    console.error('Get tenancy branding error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch branding' });
  }
});

// Check if subdomain is available
router.get('/check-subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    
    // Reserved subdomains
    const reserved = ['www', 'api', 'admin', 'superadmin', 'app', 'mail', 'ftp', 'cdn'];
    
    if (reserved.includes(subdomain.toLowerCase())) {
      return res.json({
        success: true,
        data: { available: false, reason: 'reserved' }
      });
    }
    
    const existing = await Tenancy.findOne({
      $or: [
        { slug: subdomain },
        { subdomain: subdomain }
      ]
    });
    
    res.json({
      success: true,
      data: { available: !existing }
    });
  } catch (error) {
    console.error('Check subdomain error:', error);
    res.status(500).json({ success: false, message: 'Failed to check subdomain' });
  }
});

// List all active tenancies (for discovery/marketplace - optional)
router.get('/list', async (req, res) => {
  try {
    const { city, limit = 20 } = req.query;
    
    const query = { status: 'active', isDeleted: false };
    
    if (city) {
      query['contact.address.city'] = { $regex: city, $options: 'i' };
    }
    
    const tenancies = await Tenancy.find(query)
      .select('name slug subdomain branding.logo branding.theme.primaryColor contact.address.city')
      .limit(parseInt(limit))
      .lean();
    
    res.json({
      success: true,
      data: { tenancies }
    });
  } catch (error) {
    console.error('List tenancies error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tenancies' });
  }
});

module.exports = router;
