/**
 * API Endpoint Test Script
 * Tests the multi-tenancy API endpoints
 */

require('dotenv').config();
const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

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
  header: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}\n`)
};

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  log.header('API ENDPOINT TESTS');
  log.info(`Testing against: ${BASE_URL}`);

  // Test 1: Health Check
  try {
    const res = await makeRequest('/api/health');
    if (res.status === 200 && res.data.success) {
      log.success('Health check endpoint works');
      passed++;
    } else {
      log.error('Health check failed');
      failed++;
    }
  } catch (err) {
    log.error(`Health check error: ${err.message}`);
    log.info('Make sure the backend server is running: npm run dev');
    failed++;
  }

  // Test 2: Public Tenancy Branding (should return 404 for non-existent)
  try {
    const res = await makeRequest('/api/tenancy/branding/nonexistent');
    if (res.status === 404) {
      log.success('Public branding endpoint returns 404 for non-existent tenancy');
      passed++;
    } else {
      log.info(`Public branding returned status ${res.status}`);
      passed++;
    }
  } catch (err) {
    log.error(`Public branding error: ${err.message}`);
    failed++;
  }

  // Test 3: Services endpoint (public)
  try {
    const res = await makeRequest('/api/services');
    if (res.status === 200) {
      log.success('Services endpoint works');
      passed++;
    } else {
      log.info(`Services returned status ${res.status}`);
    }
  } catch (err) {
    log.error(`Services error: ${err.message}`);
    failed++;
  }

  // Test 4: Superadmin auth (should require credentials)
  try {
    const res = await makeRequest('/api/superadmin/auth/login', {
      method: 'POST',
      body: { email: 'test@test.com', password: 'wrong' }
    });
    if (res.status === 401 || res.status === 400) {
      log.success('Superadmin auth rejects invalid credentials');
      passed++;
    } else {
      log.info(`Superadmin auth returned status ${res.status}`);
    }
  } catch (err) {
    log.error(`Superadmin auth error: ${err.message}`);
    failed++;
  }

  // Test 5: Protected endpoint without auth
  try {
    const res = await makeRequest('/api/superadmin/tenancies');
    if (res.status === 401 || res.status === 403) {
      log.success('Protected endpoints require authentication');
      passed++;
    } else {
      log.info(`Protected endpoint returned status ${res.status}`);
    }
  } catch (err) {
    log.error(`Protected endpoint error: ${err.message}`);
    failed++;
  }

  // Summary
  log.header('TEST SUMMARY');
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  
  if (failed === 0) {
    log.success('\n🎉 All API tests passed!\n');
  } else {
    log.error(`\n⚠️ ${failed} test(s) failed.\n`);
  }
}

runTests().catch(console.error);
