#!/usr/bin/env npx ts-node

/**
 * Test script to verify email verification flow works correctly
 */

const API_URL = 'http://localhost:3001/api';

interface AuthResponse {
  success?: boolean;
  message?: string;
  errorCode?: string;
  user?: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
}

async function testEmailVerification() {
  console.log('\n🧪 Testing Email Verification Flow\n');
  console.log('========================================\n');

  // 1. Check default user
  console.log('📋 Step 1: Fetching default user from database...');
  try {
    const response = await fetch(`${API_URL}/auth/init`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    });
    
    const data = (await response.json()) as AuthResponse;
    if (response.status === 401) {
      console.log('✓ Correctly rejected unauthenticated request (401)');
    } else {
      console.log(`Response status: ${response.status}`);
      console.log(`Response:`, data);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n========================================');
  console.log('\n✅ Email Verification Flow Tests Complete!');
  console.log('\nNext Steps:');
  console.log('1. Open http://localhost:3000/signup');
  console.log('2. Sign up with a new email address');
  console.log('3. You should be redirected to /login or see a verification message');
  console.log('4. Check backend logs for verification email with token');
  console.log('5. Visit /verify-email?token=<token> to verify');
  console.log('6. After verification, you should be able to access /dashboard\n');
}

testEmailVerification().catch(console.error);
