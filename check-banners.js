require('dotenv').config();
const mongoose = require('mongoose');
const Banner = require('./src/models/Banner');

async function checkBanners() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all banners
    const allBanners = await Banner.find({});
    console.log(`📊 Total banners in database: ${allBanners.length}\n`);

    if (allBanners.length === 0) {
      console.log('❌ No banners found in database');
      process.exit(0);
    }

    // Show details of each banner
    allBanners.forEach((banner, index) => {
      console.log(`\n🎯 Banner ${index + 1}:`);
      console.log(`   ID: ${banner._id}`);
      console.log(`   Title: ${banner.title}`);
      console.log(`   Scope: ${banner.bannerScope}`);
      console.log(`   Tenancy: ${banner.tenancy}`);
      console.log(`   Status: ${banner.status}`);
      console.log(`   Created By: ${banner.createdBy}`);
      console.log(`   Created By Model: ${banner.createdByModel}`);
    });

    // Check specific banner
    const bannerId = '695e9e38ae6f777c7bca3cb7';
    console.log(`\n\n🔍 Searching for banner: ${bannerId}`);
    const specificBanner = await Banner.findById(bannerId);
    
    if (specificBanner) {
      console.log('✅ Banner found!');
      console.log(JSON.stringify(specificBanner, null, 2));
    } else {
      console.log('❌ Banner not found in database');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBanners();
