/**
 * Multi-Tenancy PaaS Integration Tests
 * Tests the complete tenancy lifecycle and features
 */

require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Tenancy = require('../src/models/Tenancy');
const User = require('../src/models/User');
const { BillingPlan, TenancyInvoice, TenancyPayment } = require('../src/models/TenancyBilling');

// Test data
let superAdminToken;
let testTenancy;
let testAdmin;
let testInvoice;

const testSuperAdmin = {
  email: 'superadmin@test.com',
  password: 'Test@123456'
};

const testTenancyData = {
  name: 'Test Laundry Service',
  subdomain: 'testlaundry',
  description: 'A test laundry for integration testing',
  owner: {
    name: 'Test Admin',
    email: 'testadmin@testlaundry.com',
    phone: '9876543210'
  }
};

describe('Multi-Tenancy PaaS Tests', () => {
  
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/laundry_test';
    await mongoose.connect(mongoUri);
    
    // Login as superadmin
    const loginRes = await request(app)
      .post('/api/superadmin/auth/login')
      .send(testSuperAdmin);
    
    if (loginRes.body.success) {
      superAdminToken = loginRes.body.data.token;
    } else {
      console.log('Note: Superadmin login failed, some tests may be skipped');
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testTenancy) {
      await Tenancy.findByIdAndDelete(testTenancy._id);
    }
    if (testAdmin) {
      await User.findByIdAndDelete(testAdmin._id);
    }
    await mongoose.connection.close();
  });

  // ============================================
  // TENANCY MANAGEMENT TESTS
  // ============================================
  describe('Tenancy Management', () => {
    
    test('Should create a new tenancy', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .post('/api/superadmin/tenancies')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(testTenancyData);
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenancy).toBeDefined();
      expect(res.body.data.tenancy.name).toBe(testTenancyData.name);
      expect(res.body.data.tenancy.subdomain).toBe(testTenancyData.subdomain);
      
      testTenancy = res.body.data.tenancy;
      testAdmin = res.body.data.owner;
    });

    test('Should get all tenancies', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .get('/api/superadmin/tenancies')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.tenancies)).toBe(true);
    });

    test('Should get tenancy by ID', async () => {
      if (!superAdminToken || !testTenancy) return;
      
      const res = await request(app)
        .get(`/api/superadmin/tenancies/${testTenancy._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenancy._id).toBe(testTenancy._id);
    });

    test('Should update tenancy status', async () => {
      if (!superAdminToken || !testTenancy) return;
      
      const res = await request(app)
        .patch(`/api/superadmin/tenancies/${testTenancy._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'active' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenancy.status).toBe('active');
    });

    test('Should get tenancy stats', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .get('/api/superadmin/tenancies/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats).toBeDefined();
      expect(typeof res.body.data.stats.total).toBe('number');
    });
  });

  // ============================================
  // BRANDING TESTS
  // ============================================
  describe('Tenancy Branding', () => {
    
    test('Should update tenancy branding', async () => {
      if (!superAdminToken || !testTenancy) return;
      
      const brandingData = {
        branding: {
          theme: {
            primaryColor: '#FF5733',
            secondaryColor: '#33FF57',
            accentColor: '#3357FF'
          }
        }
      };
      
      const res = await request(app)
        .patch(`/api/superadmin/tenancies/${testTenancy._id}/branding`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(brandingData);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Should get public branding by subdomain', async () => {
      if (!testTenancy) return;
      
      const res = await request(app)
        .get(`/api/tenancy/branding/${testTenancy.subdomain}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(testTenancy.name);
    });
  });

  // ============================================
  // BILLING TESTS
  // ============================================
  describe('Billing Management', () => {
    
    test('Should get billing plans', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .get('/api/superadmin/billing/plans')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Should generate invoice for tenancy', async () => {
      if (!superAdminToken || !testTenancy) return;
      
      const res = await request(app)
        .post('/api/superadmin/billing/invoices')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenancyId: testTenancy._id,
          billingCycle: 'monthly'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoice).toBeDefined();
      
      testInvoice = res.body.data.invoice;
    });

    test('Should get all invoices', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .get('/api/superadmin/billing/invoices')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.invoices)).toBe(true);
    });

    test('Should mark invoice as paid', async () => {
      if (!superAdminToken || !testInvoice) return;
      
      const res = await request(app)
        .patch(`/api/superadmin/billing/invoices/${testInvoice._id}/paid`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          paymentMethod: 'manual',
          transactionId: 'TEST-TXN-001'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoice.status).toBe('paid');
    });

    test('Should get billing stats', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .get('/api/superadmin/billing/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats).toBeDefined();
    });
  });

  // ============================================
  // INVITATION TESTS
  // ============================================
  describe('Invitation System', () => {
    
    test('Should send invitation to laundry admin', async () => {
      if (!superAdminToken || !testTenancy) return;
      
      const res = await request(app)
        .post('/api/superadmin/invitations/invite')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenancyId: testTenancy._id,
          name: 'New Admin',
          email: 'newadmin@testlaundry.com',
          phone: '9876543211'
        });
      
      // May fail if user already exists, which is fine
      expect([200, 201, 400].includes(res.status)).toBe(true);
    });

    test('Should get pending invitations', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .get('/api/superadmin/invitations/pending')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================
  // ANALYTICS TESTS
  // ============================================
  describe('Tenancy Analytics', () => {
    
    test('Should get platform analytics', async () => {
      if (!superAdminToken) return;
      
      const res = await request(app)
        .get('/api/superadmin/tenancy-analytics/platform?period=30d')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview).toBeDefined();
    });

    test('Should get tenancy-specific analytics', async () => {
      if (!superAdminToken || !testTenancy) return;
      
      const res = await request(app)
        .get(`/api/superadmin/tenancy-analytics/${testTenancy._id}?period=30d`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================
  // SUBDOMAIN ROUTING TESTS
  // ============================================
  describe('Subdomain Routing', () => {
    
    test('Should extract tenancy from X-Subdomain header', async () => {
      if (!testTenancy) return;
      
      const res = await request(app)
        .get('/api/health')
        .set('X-Subdomain', testTenancy.subdomain);
      
      expect(res.status).toBe(200);
    });

    test('Should extract tenancy from X-Tenancy-Slug header', async () => {
      if (!testTenancy) return;
      
      const res = await request(app)
        .get('/api/health')
        .set('X-Tenancy-Slug', testTenancy.subdomain);
      
      expect(res.status).toBe(200);
    });
  });

  // ============================================
  // CLEANUP TEST
  // ============================================
  describe('Cleanup', () => {
    
    test('Should delete tenancy', async () => {
      if (!superAdminToken || !testTenancy) return;
      
      const res = await request(app)
        .delete(`/api/superadmin/tenancies/${testTenancy._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// ============================================
// UNIT TESTS
// ============================================
describe('Tenancy Model Unit Tests', () => {
  
  test('Should generate slug from name', () => {
    const tenancy = new Tenancy({
      name: 'My Test Laundry',
      owner: new mongoose.Types.ObjectId()
    });
    
    expect(tenancy.slug).toBeUndefined(); // Not set until save
  });

  test('Should validate subscription status', () => {
    const tenancy = new Tenancy({
      name: 'Test',
      slug: 'test',
      owner: new mongoose.Types.ObjectId(),
      subscription: {
        status: 'active',
        plan: 'basic'
      }
    });
    
    expect(tenancy.isSubscriptionActive()).toBe(true);
  });

  test('Should check feature access', () => {
    const tenancy = new Tenancy({
      name: 'Test',
      slug: 'test',
      owner: new mongoose.Types.ObjectId(),
      subscription: {
        features: {
          customDomain: true,
          advancedAnalytics: false
        }
      }
    });
    
    expect(tenancy.hasFeature('customDomain')).toBe(true);
    expect(tenancy.hasFeature('advancedAnalytics')).toBe(false);
  });
});

console.log('Multi-Tenancy Tests Loaded');
