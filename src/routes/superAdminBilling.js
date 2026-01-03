const express = require('express');
const router = express.Router();
const billingController = require('../controllers/superAdmin/billingController');
const { authenticateSuperAdmin, requirePermission } = require('../middlewares/superAdminAuth');

// All routes require superadmin authentication
router.use(authenticateSuperAdmin);

// Billing Plans
router.get('/plans', billingController.getPlans);
router.post('/plans', requirePermission('settings'), billingController.upsertPlan);

// Invoices
router.get('/invoices', requirePermission('finances'), billingController.getInvoices);
router.post('/invoices', requirePermission('finances'), billingController.generateInvoice);
router.patch('/invoices/:invoiceId/paid', requirePermission('finances'), billingController.markInvoicePaid);

// Payments
router.get('/payments', requirePermission('finances'), billingController.getPayments);

// Stats
router.get('/stats', requirePermission('finances'), billingController.getBillingStats);

// Tenancy subscription
router.patch('/tenancies/:tenancyId/plan', requirePermission('settings'), billingController.updateTenancyPlan);

module.exports = router;
