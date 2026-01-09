/**
 * Migration Script: Fix Campaign Admin References
 * 
 * This script updates all campaigns that have createdByModel: 'Admin'
 * to createdByModel: 'User' since Admin model doesn't exist.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/laundry-management';

async function fixCampaignReferences() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Campaign = mongoose.model('Campaign', require('./src/models/Campaign').schema);

    // Find all campaigns with createdByModel: 'Admin'
    const campaignsToFix = await Campaign.find({ createdByModel: 'Admin' });
    
    console.log(`\n📊 Found ${campaignsToFix.length} campaigns with 'Admin' reference`);

    if (campaignsToFix.length === 0) {
      console.log('✅ No campaigns need fixing!');
      process.exit(0);
    }

    console.log('\n🔧 Fixing campaigns...\n');

    let fixed = 0;
    let failed = 0;

    for (const campaign of campaignsToFix) {
      try {
        campaign.createdByModel = 'User';
        await campaign.save();
        console.log(`✅ Fixed: ${campaign.name} (${campaign._id})`);
        fixed++;
      } catch (error) {
        console.error(`❌ Failed to fix: ${campaign.name} (${campaign._id})`, error.message);
        failed++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total campaigns: ${campaignsToFix.length}`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Failed: ${failed}`);

    console.log('\n✨ Migration completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
fixCampaignReferences();
