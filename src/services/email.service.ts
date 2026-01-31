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
    // Debug: Log environment variables at runtime
    console.log('[EMAIL DEBUG] EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
    console.log('[EMAIL DEBUG] RESEND_API_KEY:', process.env.RESEND_API_KEY ? '[set]' : '[not set]');
    console.log('[EMAIL DEBUG] EMAIL_FROM:', process.env.EMAIL_FROM);
    console.log('[EMAIL DEBUG] EMAIL_FROM_NAME:', process.env.EMAIL_FROM_NAME);

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
}

export const emailService = new EmailService();
