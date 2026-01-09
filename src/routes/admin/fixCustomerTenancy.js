const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Tenancy = require('../../models/Tenancy');
const { protect } = require('../../middlewares/auth');

// Fix customer tenancy - assign customer to current admin's tenancy
router.post('/fix-customer-tenancy', protect, async (req, res) => {
  try {
    const { customerEmail } = req.body;
    const adminTenancyId = req.user.tenancy;

    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Customer email is required'
      });
    }

    // Find the customer
    const customer = await User.findOne({
      email: customerEmail,
      role: 'customer'
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with email ${customerEmail} not found`
      });
    }

    // Get admin's tenancy info
    const tenancy = await Tenancy.findById(adminTenancyId);
    if (!tenancy) {
      return res.status(404).json({
        success: false,
        message: 'Admin tenancy not found'
      });
    }

    // Update customer's tenancy
    const oldTenancy = customer.tenancy;
    customer.tenancy = adminTenancyId;
    await customer.save();

    console.log('✅ Customer tenancy updated:');
    console.log(`   Customer: ${customer.name} (${customer.email})`);
    console.log(`   Old Tenancy: ${oldTenancy || 'undefined'}`);
    console.log(`   New Tenancy: ${adminTenancyId} (${tenancy.name})`);

    res.json({
      success: true,
      message: 'Customer tenancy updated successfully',
      data: {
        customer: {
          id: customer._id,
          name: customer.name,
          email: customer.email,
          oldTenancy: oldTenancy,
          newTenancy: adminTenancyId
        },
        tenancy: {
          id: tenancy._id,
          name: tenancy.name,
          slug: tenancy.slug
        }
      }
    });

  } catch (error) {
    console.error('Fix customer tenancy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix customer tenancy',
      error: error.message
    });
  }
});

module.exports = router;
