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
export type MailLocale = 'tr' | 'en';

/** Transactional email copy in both supported product languages. */
export const MAIL_COPY: Record<
  MailLocale,
  Record<
    'verification' | 'reset' | 'deleted',
    {
      subject: string;
      title: string;
      body: string;
      expiry: string;
      action: string;
      codeLabel?: string;
    }
  >
> = {
  en: {
    verification: {
      subject: 'your verification code',
      title: 'Verify your email',
      body: 'Enter this code to finish creating your account:',
      codeLabel: 'Verification code',
      expiry: 'The code expires in 30 minutes.',
      action: 'Verify email',
    },
    reset: {
      subject: 'reset your password',
      title: 'Reset your password',
      body: 'Use this link to choose a new password:',
      expiry: 'The link expires in 1 hour. If you did not request it you can ignore this email.',
      action: 'Reset password',
    },
    deleted: {
      subject: 'account deleted',
      title: 'Account deleted',
      body: 'Your account has been deleted and your personal data removed from the live systems.',
      expiry: '',
      action: '',
    },
  },
  tr: {
    verification: {
      subject: 'doğrulama kodun',
      title: 'E-postanı doğrula',
      body: 'Hesabını tamamlamak için bu kodu gir:',
      codeLabel: 'Doğrulama kodu',
      expiry: 'Kod 30 dakika geçerlidir.',
      action: 'E-postayı doğrula',
    },
    reset: {
      subject: 'parolanı sıfırla',
      title: 'Parolanı sıfırla',
      body: 'Yeni bir parola belirlemek için bu bağlantıyı kullan:',
      expiry:
        'Bağlantı 1 saat geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.',
      action: 'Parolayı sıfırla',
    },
    deleted: {
      subject: 'hesap silindi',
      title: 'Hesap silindi',
      body: 'Hesabın silindi ve kişisel verilerin canlı sistemlerden kaldırıldı.',
      expiry: '',
      action: '',
    },
  },
};

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

  /**
   * Sign-up verification. The message carries a six-digit code the player can
   * type on any device plus a prefilled link for one-click confirmation — both
   * redeem the same single-use credential.
   */
  sendVerification(to: string, code: string, locale: MailLocale = 'en') {
    const url = `${env().WEB_URL}/auth/verify?email=${encodeURIComponent(to)}&code=${encodeURIComponent(code)}`;
    const copy = MAIL_COPY[locale].verification;
    return this.send({
      to,
      subject: `${env().APP_NAME} — ${copy.subject}`,
      text: `${copy.body}\n\n${copy.codeLabel}: ${code}\n\n${url}\n\n${copy.expiry}`,
      html: this.layout(
        copy.title,
        `${copy.body}<br><br><span style="display:inline-block;font-size:30px;letter-spacing:10px;font-weight:700;background:#ece8ff;color:#3f31b5;border-radius:12px;padding:14px 22px">${code}</span><br><br>${copy.expiry}`,
        { label: copy.action, url },
      ),
    });
  }

  sendPasswordReset(to: string, token: string, locale: MailLocale = 'en') {
    const url = `${env().WEB_URL}/auth/reset?token=${encodeURIComponent(token)}`;
    const copy = MAIL_COPY[locale].reset;
    return this.send({
      to,
      subject: `${env().APP_NAME} — ${copy.subject}`,
      text: `${copy.body}\n${url}\n\n${copy.expiry}`,
      html: this.layout(copy.title, `${copy.body} ${copy.expiry}`, { label: copy.action, url }),
    });
  }

  sendAccountDeleted(to: string, locale: MailLocale = 'en') {
    const copy = MAIL_COPY[locale].deleted;
    return this.send({
      to,
      subject: `${env().APP_NAME} — ${copy.subject}`,
      text: copy.body,
      html: this.layout(copy.title, copy.body),
    });
  }
}
