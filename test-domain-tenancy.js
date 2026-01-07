#!/usr/bin/env node

/**
 * Test Domain-Based Tenancy Setup
 * This script helps test domain-based tenancy using free services
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Free domain testing options
const FREE_DOMAIN_OPTIONS = {
  // Option 1: Use ngrok for local testing with custom domains
  ngrok: {
    description: 'Tunnel local server with custom subdomains',
    setup: [
      '1. Install ngrok: npm install -g ngrok',
      '2. Sign up for free account at ngrok.com',
      '3. Get auth token and run: ngrok authtoken YOUR_TOKEN',
      '4. Start tunnel: ngrok http 5000 --subdomain=your-laundry-name',
      '5. Access via: https://your-laundry-name.ngrok.io'
    ],
    cost: 'Free with limitations'
  },

  // Option 2: Use Cloudflare Tunnel (free)
  cloudflare: {
    description: 'Free tunnel with custom domains',
    setup: [
      '1. Install cloudflared',
      '2. Login: cloudflared tunnel login',
      '3. Create tunnel: cloudflared tunnel create laundry-test',
      '4. Configure DNS and routing',
      '5. Run: cloudflared tunnel run laundry-test'
    ],
    cost: 'Free'
  },

  // Option 3: Use free DNS services
  freeDNS: {
    description: 'Free subdomains from various providers',
    providers: [
      'freedns.afraid.org - Free subdomains',
      'noip.com - Free dynamic DNS',
      'duckdns.org - Free subdomains',
      'freenom.com - Free domains (.tk, .ml, .ga, .cf)'
    ],
    cost: 'Free'
  },

  // Option 4: Use localhost with hosts file
  localhost: {
    description: 'Local testing with custom domains',
    setup: [
      '1. Edit hosts file:',
      '   Windows: C:\\Windows\\System32\\drivers\\etc\\hosts',
      '   Mac/Linux: /etc/hosts',
      '2. Add entries:',
      '   127.0.0.1 quickwash.local',
      '   127.0.0.1 cleanpro.local',
      '   127.0.0.1 laundryking.local',
      '3. Access via: http://quickwash.local:5000'
    ],
    cost: 'Free'
  }
};

// Test tenancy data for domain-based setup
const TEST_TENANCIES = [
  {
    name: 'QuickWash Laundry',
    slug: 'quickwash',
    subdomain: 'quickwash',
    customDomain: 'quickwash.local', // or quickwash.ngrok.io
    status: 'active',
    subscription: {
      plan: 'trial',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }
  },
  {
    name: 'CleanPro Services',
    slug: 'cleanpro',
    subdomain: 'cleanpro',
    customDomain: 'cleanpro.local',
    status: 'active',
    subscription: {
      plan: 'trial',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  }
];

async function setupDomainTesting() {
  try {
    console.log('🚀 Setting up Domain-Based Tenancy Testing\n');

    // Display options
    console.log('📋 Free Domain Testing Options:\n');
    Object.entries(FREE_DOMAIN_OPTIONS).forEach(([key, option]) => {
      console.log(`${key.toUpperCase()}:`);
      console.log(`  Description: ${option.description}`);
      console.log(`  Cost: ${option.cost}`);
      if (option.setup) {
        console.log('  Setup:');
        option.setup.forEach(step => console.log(`    ${step}`));
      }
      if (option.providers) {
        console.log('  Providers:');
        option.providers.forEach(provider => console.log(`    - ${provider}`));
      }
      console.log('');
    });

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import Tenancy model
    const Tenancy = require('./src/models/Tenancy');

    // Create test tenancies
    console.log('🏗️  Creating test tenancies...');
    for (const tenancyData of TEST_TENANCIES) {
      const existing = await Tenancy.findOne({ slug: tenancyData.slug });
      if (!existing) {
        const tenancy = new Tenancy(tenancyData);
        await tenancy.save();
        console.log(`✅ Created tenancy: ${tenancyData.name} (${tenancyData.customDomain})`);
      } else {
        console.log(`⚠️  Tenancy already exists: ${tenancyData.name}`);
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Choose a domain option above');
    console.log('2. Set up your chosen domain service');
    console.log('3. Update your domain middleware');
    console.log('4. Test with: npm run test:domain');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupDomainTesting();
}

module.exports = { FREE_DOMAIN_OPTIONS, TEST_TENANCIES };