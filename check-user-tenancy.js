const User = require('./src/models/User');
const Tenancy = require('./src/models/Tenancy');
require('dotenv').config();

// Connect to MongoDB
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/laundry-management');

async function checkUserTenancy() {
  try {
    console.log('🔍 Checking User Tenancy Assignments...\n');
    
    // Check admin users and their tenancy assignments
    const adminUsers = await User.find({ role: 'admin' })
      .populate('tenancy', 'name slug status')
      .select('name email role tenancy isActive');
    
    console.log('👥 Admin Users and their Tenancies:');
    for (const user of adminUsers) {
      console.log(`  - ${user.name} (${user.email})`);
      console.log(`    Role: ${user.role}, Active: ${user.isActive}`);
      if (user.tenancy) {
        console.log(`    Tenancy: ${user.tenancy.name} (${user.tenancy.slug}) - Status: ${user.tenancy.status}`);
      } else {
        console.log(`    ❌ No tenancy assigned`);
      }
      console.log('');
    }
    
    // Check all tenancies
    const tenancies = await Tenancy.find({}).select('name slug status');
    console.log('🏢 Available Tenancies:');
    tenancies.forEach(tenancy => {
      console.log(`  - ${tenancy.name} (${tenancy.slug}) - Status: ${tenancy.status}`);
    });
    
    // Suggest fix if needed
    const usersWithoutTenancy = adminUsers.filter(user => !user.tenancy);
    if (usersWithoutTenancy.length > 0 && tenancies.length > 0) {
      console.log('\n💡 Suggested Fix:');
      console.log('Some admin users don\'t have tenancy assigned. You can assign them to a tenancy:');
      console.log(`db.users.updateOne({_id: ObjectId("${usersWithoutTenancy[0]._id}")}, {$set: {tenancy: ObjectId("${tenancies[0]._id}")}})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkUserTenancy();