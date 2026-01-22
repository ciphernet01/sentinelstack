import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@sentinelstack.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SentinelStack Security';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Check for email service configuration
    const emailService = process.env.EMAIL_SERVICE;

    if (emailService === 'gmail') {
      const emailUser = process.env.EMAIL_USER;
      const emailPassword = process.env.EMAIL_PASSWORD;
      if (!emailUser || !emailPassword || emailUser.includes('CHANGE_ME') || emailPassword.includes('CHANGE_ME')) {
        console.warn('EMAIL_SERVICE=gmail set, but EMAIL_USER/EMAIL_PASSWORD missing. Emails will be logged to console.');
        return;
      }
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      console.info(`Email service configured: gmail (from=${this.fromEmail})`);
    } else if (emailService === 'smtp') {
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPassword = process.env.SMTP_PASSWORD;
      if (!smtpHost || !smtpUser || !smtpPassword || smtpUser.includes('CHANGE_ME') || smtpPassword.includes('CHANGE_ME')) {
        console.warn('EMAIL_SERVICE=smtp set, but SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing. Emails will be logged to console.');
        return;
      }
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      console.info(`Email service configured: smtp://${smtpHost}:${process.env.SMTP_PORT || '587'} (from=${this.fromEmail})`);
    } else if (emailService === 'sendgrid') {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('EMAIL_SERVICE=sendgrid set, but SENDGRID_API_KEY missing. Emails will be logged to console.');
        return;
      }
      // SendGrid via nodemailer
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });

      console.info(`Email service configured: sendgrid (from=${this.fromEmail})`);
      } else if (emailService === 'mailgun') {
        if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
          console.warn('EMAIL_SERVICE=mailgun set, but MAILGUN_API_KEY or MAILGUN_DOMAIN missing. Emails will be logged to console.');
          return;
        }
        // Mailgun via nodemailer
        this.transporter = nodemailer.createTransport({
          host: 'smtp.mailgun.org',
          port: 587,
          auth: {
            user: 'postmaster@' + process.env.MAILGUN_DOMAIN,
            pass: process.env.MAILGUN_API_KEY,
          },
        });

        console.info(`Email service configured: mailgun (from=${this.fromEmail})`);
    } else {
      // Development mode: log to console
      console.warn('No email service configured. Emails will be logged to console.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        // Development mode: log email to console
        console.log('📧 [EMAIL] Would send email:');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body:\n${options.text || options.html}`);
        return true;
      }

      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string, userName?: string): Promise<boolean> {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Hi ${userName || 'there'},</p>
              <p>Thank you for signing up with SentinelStack! Please verify your email address to complete your registration.</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
              <p><strong>This link will expire in 24 hours.</strong></p>
              <p>If you didn't create an account with SentinelStack, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} SentinelStack. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Hi ${userName || 'there'},

      Thank you for signing up with SentinelStack! Please verify your email address by clicking the link below:

      ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create an account with SentinelStack, you can safely ignore this email.

      © ${new Date().getFullYear()} SentinelStack. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - SentinelStack',
      html,
      text,
    });
  }

  async sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<boolean> {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔑 Reset Your Password</h1>
            </div>
            <div class="content">
              <p>Hi ${userName || 'there'},</p>
              <p>We received a request to reset your password for your SentinelStack account.</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure.
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} SentinelStack. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Hi ${userName || 'there'},

      We received a request to reset your password for your SentinelStack account.

      Click the link below to reset your password:
      ${resetUrl}

      This link will expire in 1 hour.

      ⚠️ If you didn't request a password reset, please ignore this email and ensure your account is secure.

      © ${new Date().getFullYear()} SentinelStack. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - SentinelStack',
      html,
      text,
    });
  }

  async sendAccountLockedEmail(email: string, userName?: string): Promise<boolean> {
    const supportUrl = `${process.env.CLIENT_URL}/support`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f56565 0%, #c53030 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert { background: #fee; border-left: 4px solid #f56565; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Account Temporarily Locked</h1>
            </div>
            <div class="content">
              <p>Hi ${userName || 'there'},</p>
              <div class="alert">
                <strong>⚠️ Security Alert:</strong> Your account has been temporarily locked due to multiple failed login attempts.
              </div>
              <p>Your account will be automatically unlocked after 30 minutes. If you believe this was a mistake or need immediate assistance, please contact our support team.</p>
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Wait 30 minutes and try logging in again</li>
                <li>Use the "Forgot Password" feature to reset your password</li>
                <li>Contact support if you suspect unauthorized access</li>
              </ul>
              <p>If you didn't attempt to log in, please reset your password immediately to secure your account.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} SentinelStack. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Hi ${userName || 'there'},

      ⚠️ Security Alert: Your account has been temporarily locked due to multiple failed login attempts.

      Your account will be automatically unlocked after 30 minutes.

      Next Steps:
      - Wait 30 minutes and try logging in again
      - Use the "Forgot Password" feature to reset your password
      - Contact support if you suspect unauthorized access

      If you didn't attempt to log in, please reset your password immediately.

      © ${new Date().getFullYear()} SentinelStack. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Security Alert: Account Temporarily Locked - SentinelStack',
      html,
      text,
    });
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
