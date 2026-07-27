import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailDeliveryResult {
  delivered: boolean;
  provider: 'smtp' | 'log' | 'disabled';
  messageId?: string;
  reason?: string;
}

/**
 * Mail delivery with real provider adapters.
 *
 * - `smtp`     : real delivery via nodemailer once SMTP credentials exist.
 * - `log`      : development mode; the message is logged, never silently dropped.
 * - `disabled` : explicitly off; callers are told delivery did not happen.
 *
 * Nothing here pretends a message was sent when it was not: the boolean in the
 * result is what auth flows surface to the user.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private transport() {
    const config = env();
    if (config.MAIL_PROVIDER !== 'smtp') return null;
    if (!config.SMTP_HOST) return null;
    this.transporter ??= nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? '' }
        : undefined,
    });
    return this.transporter;
  }

  get enabled() {
    const config = env();
    if (config.MAIL_PROVIDER === 'disabled') return false;
    if (config.MAIL_PROVIDER === 'log') return true;
    return Boolean(config.SMTP_HOST);
  }

  async send(message: MailMessage): Promise<MailDeliveryResult> {
    const config = env();
    if (config.MAIL_PROVIDER === 'disabled') {
      return { delivered: false, provider: 'disabled', reason: 'Mail delivery is disabled' };
    }
    const transport = this.transport();
    if (!transport) {
      this.logger.log(`[mail:log] to=${message.to} subject=${message.subject}\n${message.text}`);
      return {
        delivered: config.MAIL_PROVIDER === 'log',
        provider: 'log',
        reason: config.MAIL_PROVIDER === 'smtp' ? 'SMTP host is not configured' : undefined,
      };
    }
    try {
      const info = await transport.sendMail({
        from: config.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { delivered: true, provider: 'smtp', messageId: info.messageId };
    } catch (error) {
      this.logger.error(`SMTP delivery failed: ${(error as Error).message}`);
      return { delivered: false, provider: 'smtp', reason: 'SMTP delivery failed' };
    }
  }

  private layout(title: string, body: string, action?: { label: string; url: string }) {
    const config = env();
    const button = action
      ? `<p style="margin:32px 0"><a href="${action.url}" style="background:#2dd9ff;color:#04121f;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700">${action.label}</a></p><p style="color:#7c8ea3;font-size:13px">${action.url}</p>`
      : '';
    return `<!doctype html><html><body style="background:#07111f;color:#e8f4ff;font-family:system-ui,sans-serif;padding:32px">
<h1 style="font-size:22px">${config.APP_NAME}</h1><h2 style="font-size:18px;font-weight:600">${title}</h2>
<p style="line-height:1.6;color:#c3d6e8">${body}</p>${button}
<p style="color:#5d7186;font-size:12px;margin-top:40px">${config.APP_NAME} · ${config.ROOT_DOMAIN}</p></body></html>`;
  }

  sendVerification(to: string, token: string) {
    const url = `${env().WEB_URL}/auth/verify?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: `${env().APP_NAME} — verify your email`,
      text: `Confirm your email address to finish creating your account:\n${url}\n\nThe link expires in 24 hours.`,
      html: this.layout(
        'Verify your email',
        'Confirm your email address to finish creating your account. The link expires in 24 hours.',
        { label: 'Verify email', url },
      ),
    });
  }

  sendPasswordReset(to: string, token: string) {
    const url = `${env().WEB_URL}/auth/reset?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: `${env().APP_NAME} — reset your password`,
      text: `Reset your password using this link:\n${url}\n\nThe link expires in 1 hour. If you did not request it you can ignore this email.`,
      html: this.layout(
        'Reset your password',
        'Use the button below to choose a new password. The link expires in 1 hour. If you did not request this, you can ignore this email.',
        { label: 'Reset password', url },
      ),
    });
  }

  sendAccountDeleted(to: string) {
    return this.send({
      to,
      subject: `${env().APP_NAME} — account deleted`,
      text: 'Your account has been deleted and your personal data removed from the live systems.',
      html: this.layout(
        'Account deleted',
        'Your account has been deleted and your personal data removed from the live systems.',
      ),
    });
  }
}
