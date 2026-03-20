import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private resendClient: Resend | null = null;
  private fromEmail: string;
  private fromName: string;
  private emailEnabled = false;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'Sentinel Stack <onboarding@resend.dev>';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SentinelStack Security';
    const emailService = process.env.EMAIL_SERVICE?.toLowerCase().trim();
    if (emailService === 'resend') {
      if (!process.env.RESEND_API_KEY) {
        console.warn('[EMAIL] EMAIL_SERVICE=resend but RESEND_API_KEY missing');
        return;
      }
      if (!/^.+<.+@.+>$/.test(this.fromEmail)) {
        console.warn('[EMAIL] Invalid EMAIL_FROM format, using default');
        this.fromEmail = 'Sentinel Stack <onboarding@resend.dev>';
      }
      this.resendClient = new Resend(process.env.RESEND_API_KEY);
      this.emailEnabled = true;
      console.info('[EMAIL] Resend email service initialized');
      return;
    }
    console.warn('[EMAIL] No email service configured. Emails disabled.');
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (this.resendClient) {
        await this.resendClient.sendEmail({
          from: this.fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        return true;
      }
      if (!this.emailEnabled) {
        console.log('[EMAIL MOCK]', {
          to: options.to,
          subject: options.subject,
        });
        return true; // behave as success in dev/fallback
      }
      return false;
    } catch (error) {
      console.error('[EMAIL] Send failed:', error);
      return false;
    }
  }

  async sendAccountLockedEmail(email: string, userName?: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Account Locked',
      html: `<p>Hi ${userName || ''}, your account has been locked due to failed login attempts.</p>`,
      text: `Hi ${userName || ''}, your account has been locked due to failed login attempts.`
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verifyUrl = `${process.env.CLIENT_URL || ''}/verify-email?token=${token}`;
    return this.sendEmail({
      to: email,
      subject: 'Verify your SentinelStack account',
      html: `
        <table style="width:100%;max-width:600px;margin:auto;font-family:sans-serif;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#18181b;padding:24px 0;text-align:center;">
              <span style="color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">Sentinel Stack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 24px 24px;">
              <h2 style="margin:0 0 16px 0;color:#18181b;">Verify your email address</h2>
              <p style="font-size:16px;color:#444;">
                Thanks for signing up! Please verify your email address by clicking the button below:
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${verifyUrl}" style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
                  Verify Email
                </a>
              </div>
              <p style="font-size:14px;color:#888;">
                If the button above does not work, copy and paste the following link into your browser:<br>
                <a href="${verifyUrl}" style="color:#6366f1;">${verifyUrl}</a>
              </p>
              <p style="font-size:14px;color:#888;margin-top:32px;">
                This link expires in 24 hours. If you did not create an account, you can safely ignore this email.
              </p>
              <p style="font-size:16px;color:#444;margin-top:32px;">Best regards,<br><strong>The Sentinel Stack Team</strong></p>
            </td>
          </tr>
        </table>
      `,
      text: `Thanks for signing up for SentinelStack!\n\nPlease verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, you can ignore this email.\n\nBest,\nThe Sentinel Stack Team`
    });
  }

  async sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<boolean> {
    const resetUrl = `${process.env.CLIENT_URL || ''}/reset-password?token=${token}`;
    const greeting = userName ? `Hi ${userName},` : 'Hi,';
    return this.sendEmail({
      to: email,
      subject: 'Reset your SentinelStack password',
      html: `
        <table style="width:100%;max-width:600px;margin:auto;font-family:sans-serif;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#18181b;padding:24px 0;text-align:center;">
              <span style="color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">Sentinel Stack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 24px 24px;">
              <h2 style="margin:0 0 16px 0;color:#18181b;">Reset your password</h2>
              <p style="font-size:16px;color:#444;">
                ${greeting}<br><br>
                We received a request to reset your password. Click the button below to choose a new password:
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}" style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="font-size:14px;color:#888;">
                If the button above does not work, copy and paste the following link into your browser:<br>
                <a href="${resetUrl}" style="color:#6366f1;">${resetUrl}</a>
              </p>
              <p style="font-size:14px;color:#888;margin-top:32px;">
                This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
              </p>
              <p style="font-size:16px;color:#444;margin-top:32px;">Best regards,<br><strong>The Sentinel Stack Team</strong></p>
            </td>
          </tr>
        </table>
      `,
      text: `${greeting}\n\nWe received a request to reset your password.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.\n\nBest,\nThe Sentinel Stack Team`
    });
  }

  async sendWorkspaceInvite(email: string, orgName: string, inviterName: string, token: string): Promise<boolean> {
    // If orgName looks like a hash, use a generic name
    let displayOrgName = orgName;
    if (/^[a-f0-9]{32,}$/.test(orgName)) {
      displayOrgName = 'your organization';
    }
    return this.sendEmail({
      to: email,
      subject: `Invitation to join ${displayOrgName} on Sentinel Stack`,
      html: `
        <table style="width:100%;max-width:600px;margin:auto;font-family:sans-serif;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#18181b;padding:24px 0;text-align:center;">
              <span style="color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">Sentinel Stack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 24px 24px;">
              <h2 style="margin:0 0 16px 0;color:#18181b;">You’ve been invited to join <span style="color:#6366f1;">${displayOrgName}</span></h2>
              <p style="font-size:16px;color:#444;">Hi,</p>
              <p style="font-size:16px;color:#444;">
                <strong>${inviterName}</strong> has invited you to join <strong>${displayOrgName}</strong> on Sentinel Stack.<br>
                Click the button below to accept your invitation and get started:
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${process.env.CLIENT_URL || ''}/invite?token=${token}" style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
                  Accept Invitation
                </a>
              </div>
              <p style="font-size:14px;color:#888;">
                If the button above does not work, copy and paste the following link into your browser:<br>
                <a href="${process.env.CLIENT_URL || ''}/invite?token=${token}" style="color:#6366f1;">${process.env.CLIENT_URL || ''}/invite?token=${token}</a>
              </p>
              <p style="font-size:14px;color:#888;margin-top:32px;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
              <p style="font-size:16px;color:#444;margin-top:32px;">Best regards,<br><strong>The Sentinel Stack Team</strong></p>
            </td>
          </tr>
        </table>
      `,
      text: `${inviterName} has invited you to join ${displayOrgName} on Sentinel Stack.\n\nAccept your invitation: ${(process.env.CLIENT_URL || '')}/invite?token=${token}\n\nIf you did not expect this invitation, you can ignore this email.\n\nBest,\nThe Sentinel Stack Team`
    });
  }

  /**
   * Send payment failed email notification
   */
  async sendPaymentFailedEmail(email: string, orgName: string, amount: number, retryUrl?: string): Promise<boolean> {
    const formattedAmount = `$${amount.toFixed(2)}`;
    return this.sendEmail({
      to: email,
      subject: `Action Required: Payment Failed for ${orgName}`,
      html: `
        <table style="width:100%;max-width:600px;margin:auto;font-family:sans-serif;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#dc2626;padding:24px 0;text-align:center;">
              <span style="color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">Sentinel Stack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 24px 24px;">
              <h2 style="margin:0 0 16px 0;color:#18181b;">Payment Failed</h2>
              <p style="font-size:16px;color:#444;">Hi,</p>
              <p style="font-size:16px;color:#444;">
                We were unable to process your payment of <strong>${formattedAmount}</strong> for your Sentinel Stack subscription.
              </p>
              <p style="font-size:16px;color:#444;">
                To avoid any interruption to your service, please update your payment method or retry the payment.
              </p>
              ${retryUrl ? `
              <div style="text-align:center;margin:32px 0;">
                <a href="${retryUrl}" style="background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
                  Update Payment Method
                </a>
              </div>
              ` : `
              <div style="text-align:center;margin:32px 0;">
                <a href="${process.env.CLIENT_URL || ''}/dashboard/settings/billing" style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
                  Manage Billing
                </a>
              </div>
              `}
              <p style="font-size:14px;color:#888;margin-top:32px;">
                If you believe this is an error or need assistance, please contact our support team.
              </p>
              <p style="font-size:16px;color:#444;margin-top:32px;">Best regards,<br><strong>The Sentinel Stack Team</strong></p>
            </td>
          </tr>
        </table>
      `,
      text: `Payment Failed\n\nWe were unable to process your payment of ${formattedAmount} for your Sentinel Stack subscription.\n\nTo avoid any interruption to your service, please update your payment method at: ${process.env.CLIENT_URL || ''}/dashboard/settings/billing\n\nBest,\nThe Sentinel Stack Team`
    });
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmationEmail(email: string, orgName: string, tier: string, trialDays?: number): Promise<boolean> {
    const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();
    const trialMessage = trialDays ? `Your ${trialDays}-day free trial has started!` : '';
    
    return this.sendEmail({
      to: email,
      subject: `Welcome to Sentinel Stack ${tierName}!`,
      html: `
        <table style="width:100%;max-width:600px;margin:auto;font-family:sans-serif;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#22c55e;padding:24px 0;text-align:center;">
              <span style="color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">Sentinel Stack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 24px 24px;">
              <h2 style="margin:0 0 16px 0;color:#18181b;">Welcome to ${tierName}! 🎉</h2>
              <p style="font-size:16px;color:#444;">Hi,</p>
              <p style="font-size:16px;color:#444;">
                Thank you for upgrading <strong>${orgName}</strong> to Sentinel Stack ${tierName}.
                ${trialMessage ? `<br><br><strong>${trialMessage}</strong>` : ''}
              </p>
              <p style="font-size:16px;color:#444;">
                You now have access to all ${tierName} features including:
              </p>
              <ul style="font-size:16px;color:#444;">
                ${tier === 'PRO' ? `
                <li>50 security scans per month</li>
                <li>AI-powered risk summaries</li>
                <li>Up to 5 team members</li>
                <li>Priority support</li>
                ` : `
                <li>Unlimited security scans</li>
                <li>API access & webhooks</li>
                <li>SOC2 compliance reports</li>
                <li>Dedicated account manager</li>
                `}
              </ul>
              <div style="text-align:center;margin:32px 0;">
                <a href="${process.env.CLIENT_URL || ''}/dashboard" style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
                  Go to Dashboard
                </a>
              </div>
              <p style="font-size:16px;color:#444;margin-top:32px;">Best regards,<br><strong>The Sentinel Stack Team</strong></p>
            </td>
          </tr>
        </table>
      `,
      text: `Welcome to Sentinel Stack ${tierName}!\n\nThank you for upgrading ${orgName}. ${trialMessage}\n\nGo to your dashboard: ${process.env.CLIENT_URL || ''}/dashboard\n\nBest,\nThe Sentinel Stack Team`
    });
  }

  /**
   * Send subscription canceled email
   */
  async sendSubscriptionCanceledEmail(email: string, orgName: string, endDate: Date): Promise<boolean> {
    const formattedDate = endDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    return this.sendEmail({
      to: email,
      subject: `Your Sentinel Stack subscription has been canceled`,
      html: `
        <table style="width:100%;max-width:600px;margin:auto;font-family:sans-serif;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#18181b;padding:24px 0;text-align:center;">
              <span style="color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">Sentinel Stack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 24px 24px;">
              <h2 style="margin:0 0 16px 0;color:#18181b;">Subscription Canceled</h2>
              <p style="font-size:16px;color:#444;">Hi,</p>
              <p style="font-size:16px;color:#444;">
                Your Sentinel Stack subscription for <strong>${orgName}</strong> has been canceled.
              </p>
              <p style="font-size:16px;color:#444;">
                You'll continue to have access to your current plan features until <strong>${formattedDate}</strong>.
                After that, your account will revert to the Free plan.
              </p>
              <p style="font-size:16px;color:#444;">
                We'd love to have you back! If you change your mind, you can resubscribe anytime.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${process.env.CLIENT_URL || ''}/pricing" style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
                  View Plans
                </a>
              </div>
              <p style="font-size:14px;color:#888;margin-top:32px;">
                We'd appreciate any feedback on why you canceled. Reply to this email to let us know.
              </p>
              <p style="font-size:16px;color:#444;margin-top:32px;">Best regards,<br><strong>The Sentinel Stack Team</strong></p>
            </td>
          </tr>
        </table>
      `,
      text: `Subscription Canceled\n\nYour Sentinel Stack subscription for ${orgName} has been canceled.\n\nYou'll continue to have access until ${formattedDate}. After that, your account will revert to the Free plan.\n\nResubscribe anytime: ${process.env.CLIENT_URL || ''}/pricing\n\nBest,\nThe Sentinel Stack Team`
    });
  }
}

export const emailService = new EmailService();
