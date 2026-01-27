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
    return this.sendEmail({
      to: email,
      subject: 'Verify your email',
      html: `<p>Click <a href="${process.env.CLIENT_URL || ''}/verify?token=${token}">here</a> to verify your email.</p>`,
      text: `Go to ${(process.env.CLIENT_URL || '')}/verify?token=${token} to verify your email.`
    });
  }

  async sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Password Reset',
      html: `<p>Hi ${userName || ''}, reset your password <a href="${process.env.CLIENT_URL || ''}/reset?token=${token}">here</a>.</p>`,
      text: `Hi ${userName || ''}, reset your password at ${(process.env.CLIENT_URL || '')}/reset?token=${token}`
    });
  }

  async sendWorkspaceInvite(email: string, orgName: string, inviterName: string, token: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: `Invitation to join ${orgName}`,
      html: `<p>${inviterName} invited you to join ${orgName}. Accept <a href="${process.env.CLIENT_URL || ''}/invite?token=${token}">here</a>.</p>`,
      text: `${inviterName} invited you to join ${orgName}. Accept at ${(process.env.CLIENT_URL || '')}/invite?token=${token}`
    });
  }
}

export const emailService = new EmailService();
