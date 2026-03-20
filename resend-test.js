// Minimal Resend API test script
// Usage: node resend-test.js

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  try {
    const result = await resend.sendEmail({
      from: process.env.EMAIL_FROM || 'Sentinel Stack <no-reply@sentinel-stack.tech>',
      to: 'devanshgaur2019@gmail.com',
      subject: 'Resend API Test',
      html: '<p>This is a test email from Resend API integration.</p>',
    });
    console.log('Resend API test result:', result);
  } catch (err) {
    console.error('Resend API test error:', err);
  }
}

testResend();
