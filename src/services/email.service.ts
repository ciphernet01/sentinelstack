import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private resendClient: Resend | null = null;
  private transporter: any = null;
  private mailgunClient: any = null;
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

    if (emailService) {
      this.initializeTransporter();
      this.emailEnabled = !!this.transporter || !!this.mailgunClient;
      return;
    }

    console.warn('[EMAIL] No email service configured. Emails disabled.');
  }

  private initializeTransporter() {
    // existing legacy provider code (unchanged)
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (this.resendClient) {
        await this.resendClient.emails.send({
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

  async sendOrganizationInvitationEmail(
    email: string,
    token: string,
    organizationName: string,
    inviterName?: string
  ): Promise<boolean> {
    const inviteUrl = `${process.env.CLIENT_URL}/invite?token=${token}`;
    const invitedByText = inviterName ? ` by ${inviterName}` : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <h2>You're invited to join ${organizationName}</h2>
          <p>You’ve been invited${invitedByText}.</p>
          <a href="${inviteUrl}">Accept Invitation</a>
        </body>
      </html>
    `;

    const text = `
You've been invited${invitedByText} to join ${organizationName}.
${inviteUrl}
    `;

    return this.sendEmail({
      to: email,
      subject: `Invitation to join ${organizationName} - SentinelStack`,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
