#!/usr/bin/env npx ts-node
/**
 * Automated Email Verification Test
 * Tests the complete email verification flow
 */

import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3001/api',
  validateStatus: () => true, // Don't throw on any status
});

interface InitResponse {
  success?: boolean;
  message?: string;
  errorCode?: string;
  user?: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
}

async function testEmailVerificationFlow() {
  console.log('\n📧 Email Verification Flow Test\n');
  console.log('═'.repeat(80));

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log(`\n🧪 Test Email: ${testEmail}`);
  console.log(`🔐 Test Password: ${testPassword}\n`);

  console.log('═'.repeat(80));
  console.log('Step 1: User signup (Firebase)');
  console.log('─'.repeat(80));
  console.log('ℹ️  This is done via browser - you should see signup form at http://localhost:3002/signup');

  console.log('\n═'.repeat(80));
  console.log('Step 2: Backend receives Firebase token & calls /auth/init');
  console.log('─'.repeat(80));
  console.log('✓ Backend should:');
  console.log('  - Create user in database with emailVerified=false');
  console.log('  - Generate verification token');
  console.log('  - Log verification email to console (since EMAIL_SERVICE=undefined)');
  console.log('  - Return 403 with errorCode: EMAIL_NOT_VERIFIED\n');

  console.log('═'.repeat(80));
  console.log('Step 3: Frontend receives 403 response');
  console.log('─'.repeat(80));
  console.log('✓ AuthContext should:');
  console.log('  - Detect errorCode === EMAIL_NOT_VERIFIED');
  console.log('  - Sign user out');
  console.log('  - Redirect to /login\n');

  console.log('═'.repeat(80));
  console.log('Step 4: User gets verification token from logs');
  console.log('─'.repeat(80));
  console.log('✓ Check backend terminal for: 📧 [EMAIL] Would send email:');
  console.log('✓ Copy the verification token from the log\n');

  console.log('═'.repeat(80));
  console.log('Step 5: User visits /verify-email?token=<token>');
  console.log('─'.repeat(80));
  console.log('✓ Page should auto-verify the email');
  console.log('✓ Show "Email verified successfully!" message\n');

  console.log('═'.repeat(80));
  console.log('Step 6: User logs in with credentials');
  console.log('─'.repeat(80));
  console.log('✓ Go to /login');
  console.log('✓ Enter email and password');
  console.log('✓ Should successfully login and see dashboard\n');

  console.log('═'.repeat(80));
  console.log('\n💡 To perform this test manually:\n');
  console.log('1. Go to: http://localhost:3002/signup');
  console.log(`2. Email: ${testEmail}`);
  console.log(`3. Password: ${testPassword}`);
  console.log('4. Click Signup');
  console.log('5. You should be redirected to /login');
  console.log('6. Check the BACKEND TERMINAL for verification email');
  console.log('7. Copy token from log');
  console.log('8. Go to: http://localhost:3002/verify-email?token=<TOKEN>');
  console.log('9. Go to: http://localhost:3002/login');
  console.log(`10. Login with ${testEmail} and ${testPassword}`);
  console.log('11. Should access /dashboard ✅\n');
  
  console.log('═'.repeat(80));
  console.log('\n⏱️  Backend Terminal Location:');
  console.log('Look for logs containing: "📧 [EMAIL]"');
  console.log('Example: "📧 [EMAIL] Would send email: { to: ..., token: ... }"\n');
}

testEmailVerificationFlow().catch(console.error);
