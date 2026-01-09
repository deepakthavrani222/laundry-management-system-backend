const mongoose = require('mongoose');
const Banner = require('./src/models/Banner');
require('dotenv').config();

const fixBannerImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Update all banners with old default image paths
    const oldPaths = [
      '/uploads/banners/default-campaign.webp',
      '/uploads/banners/default-coupon.webp',
      '/uploads/banners/default-discount.webp',
      '/uploads/banners/default-banner.webp'
    ];

    for (const oldPath of oldPaths) {
      const banners = await Banner.find({ imageUrl: oldPath });
      
      if (banners.length > 0) {
        console.log(`\nFound ${banners.length} banners with path: ${oldPath}`);
        
        for (const banner of banners) {
          // Generate new placeholder URL based on banner type
          let placeholderText = 'Special Offer';
          
          if (banner.linkedPromotion) {
            switch (banner.linkedPromotion.type) {
              case 'CAMPAIGN':
                placeholderText = 'Campaign Offer';
                break;
              case 'COUPON':
                placeholderText = 'Coupon Offer';
                break;
              case 'DISCOUNT':
                placeholderText = 'Special Discount';
                break;
            }
          }
          
          const newImageUrl = `https://via.placeholder.com/1200x400/4F46E5/FFFFFF?text=${encodeURIComponent(placeholderText)}`;
          
          banner.imageUrl = newImageUrl;
          await banner.save();
          
          console.log(`  ✅ Updated banner: ${banner.title}`);
        }
      }
    }

    console.log('\n✅ All banners updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing banner images:', error);
    process.exit(1);
  }
};

fixBannerImages();
