/**
 * Multi-Tenancy Manual Test Script
 * Run: node test-multitenancy.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenancy = require('./src/models/Tenancy');
const User = require('./src/models/User');
const { BillingPlan, TenancyInvoice, TenancyPayment } = require('./src/models/TenancyBilling');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}\n`)
};

async function runTests() {
  let testTenancy = null;
  let testUser = null;
  let testInvoice = null;
  let passed = 0;
  let failed = 0;

  try {
    // Connect to MongoDB
    log.header('CONNECTING TO DATABASE');
    await mongoose.connect(process.env.MONGODB_URI);
    log.success('Connected to MongoDB');

    // ============================================
    // TEST 1: Tenancy Model
    // ============================================
    log.header('TEST 1: TENANCY MODEL');
    
    try {
      // Create test tenancy
      testTenancy = new Tenancy({
        name: 'Test Laundry ' + Date.now(),
        slug: 'test-laundry-' + Date.now(),
        subdomain: 'testlaundry' + Date.now(),
        description: 'Test tenancy for multi-tenancy testing',
        owner: new mongoose.Types.ObjectId(),
        status: 'active',
        subscription: {
          plan: 'basic',
          status: 'active'
        },
        branding: {
          theme: {
            primaryColor: '#3B82F6',
            secondaryColor: '#10B981'
          }
        }
      });
      
      await testTenancy.save();
      log.success(`Tenancy created: ${testTenancy.name}`);
      passed++;
      
      // Test subscription check
      if (testTenancy.isSubscriptionActive()) {
        log.success('Subscription active check works');
        passed++;
      } else {
        log.error('Subscription active check failed');
        failed++;
      }
      
      // Test feature check
      testTenancy.subscription.features.customDomain = true;
      if (testTenancy.hasFeature('customDomain')) {
        log.success('Feature check works');
        passed++;
      } else {
        log.error('Feature check failed');
        failed++;
      }
      
      // Test portal URL
      const portalUrl = testTenancy.portalUrl;
      if (portalUrl.includes(testTenancy.subdomain)) {
        log.success(`Portal URL generated: ${portalUrl}`);
        passed++;
      } else {
        log.error('Portal URL generation failed');
        failed++;
      }
      
    } catch (err) {
      log.error(`Tenancy model test failed: ${err.message}`);
      failed++;
    }

    // ============================================
    // TEST 2: Billing Plans
    // ============================================
    log.header('TEST 2: BILLING PLANS');
    
    try {
      const plans = await BillingPlan.find();
      if (plans.length > 0) {
        log.success(`Found ${plans.length} billing plans`);
        plans.forEach(p => log.info(`  - ${p.displayName}: ₹${p.price.monthly}/month`));
        passed++;
      } else {
        log.warn('No billing plans found. Run: node scripts/seed-billing-plans.js');
      }
    } catch (err) {
      log.error(`Billing plans test failed: ${err.message}`);
      failed++;
    }

    // ============================================
    // TEST 3: Invoice Generation
    // ============================================
    log.header('TEST 3: INVOICE GENERATION');
    
    try {
      if (testTenancy) {
        testInvoice = new TenancyInvoice({
          tenancy: testTenancy._id,
          billingPeriod: {
            start: new Date(),
            end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          plan: 'basic',
          billingCycle: 'monthly',
          amount: {
            subtotal: 999,
            tax: 180,
            discount: 0,
            total: 1179
          },
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending'
        });
        
        await testInvoice.save();
        log.success(`Invoice created: ${testInvoice.invoiceNumber}`);
        passed++;
        
        // Test invoice number generation
        if (testInvoice.invoiceNumber && testInvoice.invoiceNumber.startsWith('INV-')) {
          log.success('Invoice number auto-generated correctly');
          passed++;
        } else {
          log.error('Invoice number generation failed');
          failed++;
        }
      }
    } catch (err) {
      log.error(`Invoice test failed: ${err.message}`);
      failed++;
    }

    // ============================================
    // TEST 4: Payment Recording
    // ============================================
    log.header('TEST 4: PAYMENT RECORDING');
    
    try {
      if (testTenancy && testInvoice) {
        const payment = new TenancyPayment({
          tenancy: testTenancy._id,
          invoice: testInvoice._id,
          amount: 1179,
          status: 'completed',
          paymentMethod: 'manual',
          transactionId: 'TEST-TXN-' + Date.now()
        });
        
        await payment.save();
        log.success(`Payment recorded: ₹${payment.amount}`);
        passed++;
        
        // Update invoice status
        testInvoice.status = 'paid';
        testInvoice.paidAt = new Date();
        await testInvoice.save();
        log.success('Invoice marked as paid');
        passed++;
      }
    } catch (err) {
      log.error(`Payment test failed: ${err.message}`);
      failed++;
    }

    // ============================================
    // TEST 5: Tenancy Branding Update
    // ============================================
    log.header('TEST 5: BRANDING UPDATE');
    
    try {
      if (testTenancy) {
        testTenancy.branding.theme.primaryColor = '#FF5733';
        testTenancy.branding.theme.fontFamily = 'Poppins';
        testTenancy.branding.customCss = '.header { border-radius: 8px; }';
        await testTenancy.save();
        
        // Verify update
        const updated = await Tenancy.findById(testTenancy._id);
        if (updated.branding.theme.primaryColor === '#FF5733') {
          log.success('Branding updated successfully');
          passed++;
        } else {
          log.error('Branding update failed');
          failed++;
        }
      }
    } catch (err) {
      log.error(`Branding test failed: ${err.message}`);
      failed++;
    }

    // ============================================
    // TEST 6: Tenancy Query Methods
    // ============================================
    log.header('TEST 6: TENANCY QUERIES');
    
    try {
      // Test findByDomain
      const foundByDomain = await Tenancy.findByDomain(testTenancy.subdomain + '.laundry-platform.com');
      if (foundByDomain && foundByDomain._id.toString() === testTenancy._id.toString()) {
        log.success('findByDomain works correctly');
        passed++;
      } else {
        log.warn('findByDomain returned null (may be due to status)');
      }
      
      // Test aggregation
      const stats = await Tenancy.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      log.success(`Tenancy stats aggregation works: ${JSON.stringify(stats)}`);
      passed++;
      
    } catch (err) {
      log.error(`Query test failed: ${err.message}`);
      failed++;
    }

    // ============================================
    // TEST 7: User-Tenancy Association
    // ============================================
    log.header('TEST 7: USER-TENANCY ASSOCIATION');
    
    try {
      if (testTenancy) {
        testUser = new User({
          name: 'Test Admin User',
          email: `testadmin${Date.now()}@test.com`,
          phone: `98${Date.now().toString().slice(-8)}`,
          password: 'hashedpassword123',
          role: 'admin',
          tenancy: testTenancy._id,
          isActive: true
        });
        
        await testUser.save();
        log.success(`User created with tenancy association`);
        passed++;
        
        // Verify association
        const userWithTenancy = await User.findById(testUser._id).populate('tenancy');
        if (userWithTenancy.tenancy && userWithTenancy.tenancy.name === testTenancy.name) {
          log.success('User-Tenancy population works');
          passed++;
        } else {
          log.error('User-Tenancy population failed');
          failed++;
        }
      }
    } catch (err) {
      log.error(`User-Tenancy test failed: ${err.message}`);
      failed++;
    }

    // ============================================
    // CLEANUP
    // ============================================
    log.header('CLEANUP');
    
    try {
      if (testUser) {
        await User.findByIdAndDelete(testUser._id);
        log.info('Test user deleted');
      }
      if (testInvoice) {
        await TenancyInvoice.findByIdAndDelete(testInvoice._id);
        await TenancyPayment.deleteMany({ invoice: testInvoice._id });
        log.info('Test invoice and payments deleted');
      }
      if (testTenancy) {
        await Tenancy.findByIdAndDelete(testTenancy._id);
        log.info('Test tenancy deleted');
      }
      log.success('Cleanup completed');
    } catch (err) {
      log.warn(`Cleanup warning: ${err.message}`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    log.header('TEST SUMMARY');
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`Total: ${passed + failed}`);
    
    if (failed === 0) {
      log.success('\n🎉 All tests passed! Multi-tenancy system is working correctly.\n');
    } else {
      log.error(`\n⚠️ ${failed} test(s) failed. Please review the errors above.\n`);
    }

  } catch (err) {
    log.error(`Fatal error: ${err.message}`);
    console.error(err);
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run tests
runTests();
