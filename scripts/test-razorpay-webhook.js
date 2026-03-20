/*
  Local Razorpay webhook test

  Usage:
    set RAZORPAY_WEBHOOK_SECRET=...
    node scripts/test-razorpay-webhook.js

  Optional:
    set WEBHOOK_URL=http://localhost:3001/api/billing/webhook
    set ORG_ID=<your-org-id>
    set TIER=PRO|ENTERPRISE
    set EVENT=subscription.activated

  Notes:
  - This only tests your webhook endpoint + signature verification.
  - If ORG_ID is not provided, the handler will log a warning and no DB update will occur.
*/

const crypto = require('crypto');

async function main() {
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3001/api/billing/webhook';
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing env var: RAZORPAY_WEBHOOK_SECRET');
    process.exit(1);
  }

  const organizationId = process.env.ORG_ID;
  const tier = process.env.TIER;
  const event = process.env.EVENT || 'subscription.activated';

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    event,
    payload: {
      subscription: {
        entity: {
          id: 'sub_test_123',
          status: 'active',
          current_end: nowSec + 30 * 24 * 60 * 60,
          customer_id: 'cust_test_123',
          notes: {
            ...(organizationId ? { organizationId } : {}),
            ...(tier ? { tier } : {}),
          },
        },
      },
    },
  };

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body,
  });

  const text = await res.text();
  console.log('POST', webhookUrl);
  console.log('Status:', res.status);
  console.log('Response:', text);

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Webhook test failed:', e);
  process.exit(1);
});
