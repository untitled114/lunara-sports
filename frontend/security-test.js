import { chromium } from '@playwright/test';

async function testXSS() {
  console.log('🔒 Testing XSS Vulnerabilities...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
    '<svg onload=alert("xss")>',
    '"><script>alert("xss")</script>',
    '\'><script>alert("xss")</script>',
  ];

  const results = {
    signInEmail: [],
    signUpName: [],
    projectTitle: [],
  };

  // Test 1: SignIn Email Field
  console.log('Testing: Sign In email field...');
  await page.goto('http://localhost:3001/signin');

  for (const payload of xssPayloads) {
    await page.getByLabel('Email Address').fill(payload);
    await page.getByLabel('Password').fill('testpassword');

    // Check if script executed
    const dialogPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
    await page.getByRole('button', { name: /log me in/i }).click();
    const dialog = await dialogPromise;

    if (dialog) {
      results.signInEmail.push({ payload, vulnerable: true });
      await dialog.dismiss();
    } else {
      results.signInEmail.push({ payload, vulnerable: false });
    }

    await page.goto('http://localhost:3001/signin'); // Reset
  }

  // Test 2: SignUp Name Field
  console.log('Testing: Sign Up name field...');
  await page.goto('http://localhost:3001/signup');

  for (const payload of xssPayloads) {
    await page.getByLabel(/^name/i).first().fill(payload);

    // Check if XSS is reflected in the DOM
    const nameValue = await page.getByLabel(/^name/i).first().inputValue();
    const isEscaped = !nameValue.includes('<script>') || nameValue !== payload;

    results.signUpName.push({
      payload,
      vulnerable: !isEscaped,
      reflected: nameValue
    });

    await page.goto('http://localhost:3001/signup'); // Reset
  }

  await browser.close();

  // Print results
  console.log('\n📋 XSS Test Results:\n');

  console.log('Sign In Email Field:');
  const signInVulnerable = results.signInEmail.filter(r => r.vulnerable);
  if (signInVulnerable.length === 0) {
    console.log('  ✅ No XSS vulnerabilities detected');
  } else {
    console.log(`  ❌ ${signInVulnerable.length} XSS vulnerabilities found!`);
    signInVulnerable.forEach(r => console.log(`     - ${r.payload}`));
  }

  console.log('\nSign Up Name Field:');
  const signUpVulnerable = results.signUpName.filter(r => r.vulnerable);
  if (signUpVulnerable.length === 0) {
    console.log('  ✅ No XSS vulnerabilities detected');
  } else {
    console.log(`  ❌ ${signUpVulnerable.length} XSS vulnerabilities found!`);
    signUpVulnerable.forEach(r => console.log(`     - ${r.payload}`));
  }

  return results;
}

async function testAuthSecurity() {
  console.log('\n🔐 Testing Authentication Security...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {
    tokenStorage: null,
    tokenExpiration: null,
    protectedRoutes: [],
  };

  // Test 1: Check token storage location
  console.log('Testing: Token storage...');
  await page.goto('http://localhost:3001/signin');
  await page.getByLabel('Email Address').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /log me in/i }).click();

  // Wait for potential redirect
  await page.waitForTimeout(2000);

  // Check localStorage for tokens
  const localStorage = await page.evaluate(() => {
    return {
      auth_token: localStorage.getItem('auth_token'),
      refresh_token: localStorage.getItem('refresh_token'),
      user_email: localStorage.getItem('user_email'),
    };
  });

  results.tokenStorage = {
    hasAuthToken: !!localStorage.auth_token,
    hasRefreshToken: !!localStorage.refresh_token,
    hasUserData: !!localStorage.user_email,
    storageType: 'localStorage',
    concern: 'localStorage is vulnerable to XSS. Consider httpOnly cookies instead.'
  };

  console.log(`  Token in localStorage: ${localStorage.auth_token ? '✅ Found' : '❌ Not found'}`);
  console.log(`  Refresh token: ${localStorage.refresh_token ? '✅ Found' : '❌ Not found'}`);
  console.log(`  ⚠️  Security concern: Tokens in localStorage are vulnerable to XSS attacks`);

  // Test 2: Protected route access without auth
  console.log('\nTesting: Protected routes without auth...');

  // Clear auth
  await page.evaluate(() => localStorage.clear());

  const protectedRoutes = [
    '/dashboard',
    '/dashboard/projects',
    '/dashboard/messages',
    '/dashboard/payments',
  ];

  for (const route of protectedRoutes) {
    await page.goto(`http://localhost:3001${route}`);
    await page.waitForTimeout(500);

    const currentUrl = page.url();
    const redirectedToSignIn = currentUrl.includes('/signin');

    results.protectedRoutes.push({
      route,
      protected: redirectedToSignIn,
      redirectedTo: currentUrl,
    });

    console.log(`  ${route}: ${redirectedToSignIn ? '✅ Protected' : '❌ NOT Protected'}`);
  }

  await browser.close();

  return results;
}

async function testCSRF() {
  console.log('\n🛡️  Testing CSRF Protection...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to sign in page
  await page.goto('http://localhost:3001/signin');

  // Check for CSRF tokens in forms
  const csrfToken = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      const csrfInput = form.querySelector('input[name="csrf_token"], input[name="_csrf"]');
      if (csrfInput) {
        return csrfInput.value;
      }
    }
    return null;
  });

  console.log(`  CSRF Token in forms: ${csrfToken ? '✅ Found' : '⚠️  Not found (using JWT auth instead - acceptable)'}`);

  const result = {
    csrfTokenPresent: !!csrfToken,
    note: csrfToken
      ? 'CSRF tokens found in forms'
      : 'No CSRF tokens (likely using JWT Bearer auth which doesn\'t require CSRF for JSON APIs)',
  };

  await browser.close();

  return result;
}

async function runSecurityTests() {
  console.log('🚀 Starting Security Audit...\n');
  console.log('=' .repeat(80) + '\n');

  const xssResults = await testXSS();
  const authResults = await testAuthSecurity();
  const csrfResults = await testCSRF();

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Security Audit Summary\n');

  const xssVulnerabilities = Object.values(xssResults).flat().filter(r => r.vulnerable);
  const protectedRoutesOk = authResults.protectedRoutes.every(r => r.protected);

  console.log(`XSS Vulnerabilities: ${xssVulnerabilities.length === 0 ? '✅ None found' : `❌ ${xssVulnerabilities.length} found`}`);
  console.log(`Protected Routes: ${protectedRoutesOk ? '✅ All protected' : '❌ Some unprotected'}`);
  console.log(`Token Storage: ⚠️  localStorage (vulnerable to XSS, consider httpOnly cookies)`);
  console.log(`CSRF Protection: ${csrfResults.csrfTokenPresent ? '✅ Tokens present' : '⚠️  JWT auth (no CSRF tokens needed for API)'}`);

  // Save results
  const fs = await import('fs');
  fs.writeFileSync('security-results.json', JSON.stringify({
    xss: xssResults,
    auth: authResults,
    csrf: csrfResults,
    summary: {
      xssVulnerabilities: xssVulnerabilities.length,
      protectedRoutesOk,
      recommendations: [
        'Consider moving tokens from localStorage to httpOnly cookies',
        'Implement Content Security Policy (CSP) headers',
        'Add rate limiting on auth endpoints',
        'Implement token refresh mechanism',
      ]
    }
  }, null, 2));

  console.log('\n✅ Results saved to security-results.json');
  console.log('='.repeat(80));
}

runSecurityTests().catch(console.error);
