export const PRODUCT_FAQ = `SentinelStack Product FAQ (static knowledge)

Positioning
- SentinelStack helps startups and SMBs run security assessments, track findings, and improve security posture.
- It supports compliance readiness (best-practice guidance), but it is not legal advice.

Accounts & Login
- Sign up and login are handled via Firebase Authentication.
- If you can’t log in:
  - Use the “Forgot password” page to reset your password.
  - If your email isn’t verified, you may need to verify it and then log in again.

Emails (Verification & Invites)
- SentinelStack verification and invitation emails are sent from: no-reply@sentinel-stack.tech
- The sending domain is: sentinel-stack.tech
- If you didn’t receive an email:
  - Check Spam/Promotions and search for "sentinel-stack" or "no-reply@sentinel-stack.tech".
  - Wait a few minutes and retry resend once.
  - If your company uses an email security gateway, allowlist the sender/domain above.
- Note: the no-reply address is not monitored.

Organizations & Access
- Your data is scoped to your organization.
- If you can’t see expected data, ensure you are in the correct organization/workspace.

Assessments
- You can create assessments from the dashboard and review results as they complete.
- If an assessment is stuck, refresh and check again later; the system is designed to recover from restarts.

Reports
- You can generate reports for assessments and download them.
- If report generation fails, retry once; if it persists, contact support.

Webhooks (Product Feature)
- You can configure webhooks in the dashboard to receive events.
- If webhooks aren’t delivering, verify the endpoint URL is reachable and logs show a 2xx response.

Billing
- Billing is subscription-based.
- The payment provider may vary by region.
- For billing issues, contact support with your organization name and account email.

Security & Privacy
- SentinelStack uses authentication and organization scoping.
- For sensitive or account-specific questions, the assistant should not request secrets and should route to support.

Support
- If a question is outside this FAQ or needs account-specific help, tell the user to contact support.
`;
