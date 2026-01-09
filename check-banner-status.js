const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Banner = require('./src/models/Banner');
    
    const banners = await Banner.find({})
      .select('content.title state position imageUrl bannerScope')
      .sort({ createdAt: -1 });
    
    console.log('\n=== ALL BANNERS ===\n');
    banners.forEach(b => {
      console.log(`Title: ${b.content?.title || 'No title'}`);
      console.log(`State: ${b.state}`);
      console.log(`Position: ${b.position}`);
      console.log(`Scope: ${b.bannerScope}`);
      console.log(`Image: ${b.imageUrl}`);
      console.log('---');
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
