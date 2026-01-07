const jwt = require('jsonwebtoken');
const User = require('./src/models/User');
require('dotenv').config();

// Connect to MongoDB
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/laundry-management');

async function testServicesEndpoint() {
  try {
    console.log('🧪 Testing Services Endpoint...\n');
    
    // Get first admin user
    const adminUser = await User.findOne({ role: 'admin', isActive: true });
    if (!adminUser) {
      console.log('❌ No active admin user found');
      return;
    }
    
    console.log(`👤 Using admin user: ${adminUser.name} (${adminUser.email})`);
    
    // Generate token
    const token = jwt.sign(
      { userId: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('🔑 Generated token:', token.substring(0, 50) + '...');
    
    // Test the endpoint
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const API_URL = 'http://localhost:5000/api';
    
    console.log('\n📡 Testing GET /api/admin/services...');
    
    const response = await fetch(`${API_URL}/admin/services`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📊 Response Body:', responseText);
    
    if (response.ok) {
      console.log('✅ Services endpoint working correctly!');
    } else {
      console.log('❌ Services endpoint failed');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

testServicesEndpoint();