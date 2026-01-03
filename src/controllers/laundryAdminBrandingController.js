const Tenancy = require('../models/Tenancy');

const brandingController = {
  // Get current branding
  getBranding: async (req, res) => {
    try {
      const tenancy = await Tenancy.findById(req.user.tenancy);
      
      if (!tenancy) {
        return res.status(404).json({
          success: false,
          message: 'Tenancy not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          branding: tenancy.branding,
          name: tenancy.name,
          subdomain: tenancy.subdomain,
          customDomain: tenancy.customDomain
        }
      });
    } catch (error) {
      console.error('Get branding error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch branding' });
    }
  },

  // Update branding
  updateBranding: async (req, res) => {
    try {
      const { branding } = req.body;
      
      const tenancy = await Tenancy.findById(req.user.tenancy);
      
      if (!tenancy) {
        return res.status(404).json({
          success: false,
          message: 'Tenancy not found'
        });
      }
      
      // Merge branding updates
      if (branding.logo) {
        tenancy.branding.logo = { ...tenancy.branding.logo, ...branding.logo };
      }
      if (branding.favicon) {
        tenancy.branding.favicon = { ...tenancy.branding.favicon, ...branding.favicon };
      }
      if (branding.theme) {
        tenancy.branding.theme = { ...tenancy.branding.theme, ...branding.theme };
      }
      if (branding.customCss !== undefined) {
        tenancy.branding.customCss = branding.customCss;
      }
      
      await tenancy.save();
      
      res.json({
        success: true,
        message: 'Branding updated successfully',
        data: { branding: tenancy.branding }
      });
    } catch (error) {
      console.error('Update branding error:', error);
      res.status(500).json({ success: false, message: 'Failed to update branding' });
    }
  },

  // Update logo
  updateLogo: async (req, res) => {
    try {
      const { url, publicId } = req.body;
      
      const tenancy = await Tenancy.findById(req.user.tenancy);
      
      if (!tenancy) {
        return res.status(404).json({
          success: false,
          message: 'Tenancy not found'
        });
      }
      
      tenancy.branding.logo = { url, publicId };
      await tenancy.save();
      
      res.json({
        success: true,
        message: 'Logo updated successfully',
        data: { logo: tenancy.branding.logo }
      });
    } catch (error) {
      console.error('Update logo error:', error);
      res.status(500).json({ success: false, message: 'Failed to update logo' });
    }
  },

  // Update theme
  updateTheme: async (req, res) => {
    try {
      const { theme } = req.body;
      
      const tenancy = await Tenancy.findById(req.user.tenancy);
      
      if (!tenancy) {
        return res.status(404).json({
          success: false,
          message: 'Tenancy not found'
        });
      }
      
      tenancy.branding.theme = { ...tenancy.branding.theme, ...theme };
      await tenancy.save();
      
      res.json({
        success: true,
        message: 'Theme updated successfully',
        data: { theme: tenancy.branding.theme }
      });
    } catch (error) {
      console.error('Update theme error:', error);
      res.status(500).json({ success: false, message: 'Failed to update theme' });
    }
  },

  // Get tenancy settings
  getSettings: async (req, res) => {
    try {
      const tenancy = await Tenancy.findById(req.user.tenancy);
      
      if (!tenancy) {
        return res.status(404).json({
          success: false,
          message: 'Tenancy not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          settings: tenancy.settings,
          businessHours: tenancy.businessHours,
          contact: tenancy.contact
        }
      });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
  },

  // Update tenancy settings
  updateSettings: async (req, res) => {
    try {
      const { settings, businessHours, contact } = req.body;
      
      const tenancy = await Tenancy.findById(req.user.tenancy);
      
      if (!tenancy) {
        return res.status(404).json({
          success: false,
          message: 'Tenancy not found'
        });
      }
      
      if (settings) {
        tenancy.settings = { ...tenancy.settings, ...settings };
      }
      if (businessHours) {
        tenancy.businessHours = { ...tenancy.businessHours, ...businessHours };
      }
      if (contact) {
        tenancy.contact = { ...tenancy.contact, ...contact };
      }
      
      await tenancy.save();
      
      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: {
          settings: tenancy.settings,
          businessHours: tenancy.businessHours,
          contact: tenancy.contact
        }
      });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
  },

  // Get tenancy dashboard stats
  getDashboardStats: async (req, res) => {
    try {
      const tenancy = await Tenancy.findById(req.user.tenancy);
      
      if (!tenancy) {
        return res.status(404).json({
          success: false,
          message: 'Tenancy not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          stats: tenancy.stats,
          subscription: tenancy.subscription,
          status: tenancy.status
        }
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
  }
};

module.exports = brandingController;
