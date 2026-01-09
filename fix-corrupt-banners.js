const mongoose = require('mongoose');
require('dotenv').config();

const Banner = require('./src/models/Banner');

async function fixCorruptBanners() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find banners with invalid data
    const corruptBanners = await Banner.find({
      $or: [
        { position: { $nin: [
          'HOME_HERO_TOP', 'HOME_SLIDER_MID', 'HOME_STRIP_TOP', 'HOME_STRIP_BOTTOM', 'HOME_CARD_SIDEBAR',
          'SERVICES_HERO_TOP', 'SERVICES_SLIDER_MID', 'SERVICES_CARD_GRID',
          'OFFERS_HERO_TOP', 'OFFERS_SLIDER_MID', 'OFFERS_CARD_GRID',
          'CHECKOUT_STRIP_TOP', 'CHECKOUT_CARD_SIDEBAR',
          'DASHBOARD_HERO_TOP', 'DASHBOARD_CARD_GRID',
          'LOGIN_HERO_SIDE', 'LOGIN_STRIP_TOP',
          'GLOBAL_STRIP_TOP', 'GLOBAL_MODAL_CENTER', 'GLOBAL_FLOATING_CORNER'
        ]}},
        { 'content.title': { $exists: false } },
        { template: { $exists: false } },
        { templateType: { $exists: false } }
      ]
    });

    console.log(`\n🔍 Found ${corruptBanners.length} corrupt banners`);

    for (const banner of corruptBanners) {
      console.log(`\n❌ Corrupt Banner: ${banner._id}`);
      console.log(`   Position: ${banner.position}`);
      console.log(`   Title: ${banner.content?.title || 'MISSING'}`);
      console.log(`   Template: ${banner.template || 'MISSING'}`);
      
      // Delete corrupt banner
      await Banner.deleteOne({ _id: banner._id });
      console.log(`   ✅ Deleted`);
    }

    console.log(`\n✅ Cleanup complete! Deleted ${corruptBanners.length} corrupt banners`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCorruptBanners();
