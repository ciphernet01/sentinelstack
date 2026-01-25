import axios from 'axios';
import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

  private resendClient: Resend | null = null;
  private transporter: any = null;
  private mailgunClient: any = null;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'Sentinel Stack <onboarding@resend.dev>';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SentinelStack Security';
    const emailService = process.env.EMAIL_SERVICE?.toLowerCase().trim();
    if (emailService === 'resend') {
      if (!process.env.RESEND_API_KEY) {
        console.warn('EMAIL_SERVICE=resend set, but RESEND_API_KEY missing. Emails will be logged to console.');
        return;
      }
      // Validate EMAIL_FROM format, but do not block initialization
      if (!/^.+<.+@.+>$/.test(this.fromEmail)) {
        console.warn('EMAIL_FROM is not in "Name <email@domain>" format. Using default.');
        this.fromEmail = 'Sentinel Stack <onboarding@resend.dev>';
      }
      this.resendClient = new Resend(process.env.RESEND_API_KEY);
      console.info('Resend email service initialized');
      return;
    }
    // Only call initializeTransporter for non-resend providers
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // ...existing code for other providers...
    // (leave as is, do not touch)
  }

    // ...existing code for other providers...
    // ...existing code for templates and methods...

    // ...existing code for templates and methods...
  // Clean, standalone sendEmail method
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
      // ...existing logic for other providers or fallback...
      // If no provider is configured, fallback to console log
      console.warn('No email service configured. Emails will be logged to console.');
      console.log('\u001fEMAIL\u001f Would send email:');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      // ...existing code...
      return false;
    } catch (error) {
      console.error('Error sending email:', error);
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
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #111827 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 30px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're invited to join ${organizationName}</h1>
            </div>
            <div class="content">
              <p>Hi there,</p>
              <p>You’ve been invited${invitedByText} to join <strong>${organizationName}</strong> on SentinelStack.</p>
              <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Invitation</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #4f46e5;">${inviteUrl}</p>
              <p><strong>This invitation link will expire in 72 hours.</strong></p>
              <p>If you weren’t expecting this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} SentinelStack. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      You've been invited${invitedByText} to join ${organizationName} on SentinelStack.

      Accept the invitation here:
      ${inviteUrl}

      This invitation link will expire in 72 hours.

      If you weren’t expecting this, you can safely ignore this email.
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
