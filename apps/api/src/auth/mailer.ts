import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Port for outgoing email (ADR-002: any SMTP provider; no vendor SDKs). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const MAILER = Symbol('MAILER');

class SmtpMailer implements Mailer {
  private readonly transport;
  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(url);
  }
  async send(m: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...m });
  }
}

/** Development only: writes the email to the log instead of sending it. */
class LogMailer implements Mailer {
  private readonly logger = new Logger('LogMailer');
  async send(m: MailMessage): Promise<void> {
    this.logger.warn(`[dev email] subject="${m.subject}"\n${m.text}`);
  }
}

/** Tests only: keeps sent emails in memory. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  async send(m: MailMessage): Promise<void> {
    this.sent.push(m);
  }
  lastTo(to: string): MailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.to === to);
  }
}

export function createMailer(env: Env): Mailer {
  switch (env.MAIL_TRANSPORT) {
    case 'memory':
      return new MemoryMailer();
    case 'log':
      return new LogMailer();
    default:
      return new SmtpMailer(env.SMTP_URL, env.MAIL_FROM);
  }
}
