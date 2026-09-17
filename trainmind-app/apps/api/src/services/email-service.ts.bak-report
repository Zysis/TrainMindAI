/**
 * Sprint 4.2 — Email service
 *
 * Thin wrapper around the Resend HTTP API for sending transactional emails
 * (currently used by the report scheduling worker).
 *
 * Behaviour:
 *   - If RESEND_API_KEY starts with "re_" and is not the placeholder, real
 *     emails are sent via the Resend REST API.
 *   - Otherwise, the service runs in "log-only" mode: it logs the email
 *     payload (subject, recipients, attachment size) and returns success.
 *     This lets the worker pipeline be tested end-to-end in dev without
 *     requiring a Resend account.
 */

import type { FastifyBaseLogger } from 'fastify';

const RESEND_API_URL = 'https://api.resend.com/emails';
const PLACEHOLDER_PREFIX = 're_xxx';

export interface EmailAttachment {
  filename: string;
  content: Buffer;       // raw bytes
  contentType: string;   // e.g. "application/pdf"
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  from?: string;         // override default REPORT_FROM_EMAIL
}

export interface SendEmailResult {
  success: boolean;
  mode: 'sent' | 'logged';
  id?: string;           // Resend message id when sent
  error?: string;
}

function isLogOnlyMode(): boolean {
  const key = process.env.RESEND_API_KEY;
  return !key || key.startsWith(PLACEHOLDER_PREFIX) || key.length < 10;
}

/**
 * Diagnostica leggibile della configurazione email, da stampare all'avvio.
 * Serve a evitare il caso peggiore: credere di spedire davvero mentre si e'
 * in log-only, senza alcun segnale visibile.
 */
export function describeEmailMode(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'log-only (RESEND_API_KEY non definita — nessuna email verra inviata)';
  if (key.startsWith(PLACEHOLDER_PREFIX))
    return 'log-only (RESEND_API_KEY e ancora il placeholder re_xxx)';
  if (key.length < 10) return 'log-only (RESEND_API_KEY troppo corta: sembra incompleta)';
  return `INVIO REALE via Resend (chiave ${key.slice(0, 6)}..., mittente auth "${getAuthFrom()}", mittente report "${getDefaultFrom()}")`;
}

function getDefaultFrom(): string {
  return process.env.REPORT_FROM_EMAIL || 'TrainMind <onboarding@resend.dev>';
}

/**
 * Mittente per le email transazionali di autenticazione (reset password).
 *
 * Tenuto separato da REPORT_FROM_EMAIL di proposito: i report programmati e
 * le email di sicurezza hanno destinatari, tono e requisiti di recapito
 * diversi, e conviene poter cambiare l'uno senza toccare l'altro. Se
 * AUTH_FROM_EMAIL non e' definita si ricade sul mittente generico.
 */
export function getAuthFrom(): string {
  return process.env.AUTH_FROM_EMAIL || getDefaultFrom();
}

export async function sendEmail(
  input: SendEmailInput,
  logger?: FastifyBaseLogger,
): Promise<SendEmailResult> {
  const log = logger?.child({ service: 'email' });

  if (input.to.length === 0) {
    return { success: false, mode: 'logged', error: 'No recipients provided' };
  }

  if (isLogOnlyMode()) {
    log?.info(
      {
        mode: 'log-only',
        to: input.to,
        subject: input.subject,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          size: a.content.length,
          contentType: a.contentType,
        })),
      },
      `[EMAIL LOG-ONLY] Would send "${input.subject}" to ${input.to.length} recipient(s)`,
    );
    return { success: true, mode: 'logged' };
  }

  // ─── Real send via Resend ───
  try {
    const body: Record<string, unknown> = {
      from: input.from || getDefaultFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    };
    if (input.text) body.text = input.text;
    if (input.attachments && input.attachments.length > 0) {
      body.attachments = input.attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      }));
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      log?.error({ status: response.status, errText }, 'Resend API error');
      return { success: false, mode: 'sent', error: `Resend ${response.status}: ${errText}` };
    }

    const data = (await response.json()) as { id?: string };
    log?.info({ id: data.id, to: input.to, subject: input.subject }, 'Email sent via Resend');
    return { success: true, mode: 'sent', id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log?.error({ err }, 'Email send failed');
    return { success: false, mode: 'sent', error: message };
  }
}

/**
 * Build the HTML body for a password reset email.
 *
 * `resetUrl` deve essere il link completo e gia' comprensivo del token,
 * es. https://app.trainmind.it/reset-password?token=abc123
 */
export function buildPasswordResetEmailHtml(opts: {
  firstName: string;
  resetUrl: string;
  expiryMinutes: number;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="color: #0f172a; margin: 0 0 8px 0; font-size: 22px;">Reset your password</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 16px 0;">Hi ${opts.firstName}, we received a request to reset the password for your TrainMind account.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${opts.resetUrl}" style="display: inline-block; background: #0f766e; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">Reset password</a>
    </p>
    <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 16px 0;">The link expires in <strong>${opts.expiryMinutes} minutes</strong> and can only be used once.</p>
    <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 16px 0;">If the button doesn't work, copy and paste this address into your browser:<br><span style="color: #0f766e; word-break: break-all;">${opts.resetUrl}</span></p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">If you didn't request this reset, ignore this email: your password stays unchanged and nobody can access your account with this link.</p>
  </div>
</body>
</html>`;
}

/**
 * Build the HTML body for a scheduled report email.
 */
export function buildReportEmailHtml(opts: {
  organizationName: string;
  audience: string;
  periodFrom: string;
  periodTo: string;
  summary?: string;
}): string {
  const audienceLabel = {
    STAFF: 'Coaching staff',
    MEDICAL: 'Medical staff',
    TRAINER: 'Strength and conditioning',
  }[opts.audience] || opts.audience;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="color: #0f172a; margin: 0 0 8px 0; font-size: 22px;">${audienceLabel} report</h1>
    <p style="color: #64748b; margin: 0 0 24px 0; font-size: 14px;">${opts.organizationName} · ${opts.periodFrom} to ${opts.periodTo}</p>
    ${opts.summary ? `<div style="background: #f8fafc; border-left: 3px solid #6366f1; padding: 16px; border-radius: 6px; margin-bottom: 24px;"><p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.6;">${opts.summary}</p></div>` : ''}
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">The full report is attached in the requested format. The document was generated automatically by TrainMind according to the configured schedule.</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">This email was sent automatically by TrainMind. To change or turn off the schedule, sign in to your dashboard.</p>
  </div>
</body>
</html>`;
}
