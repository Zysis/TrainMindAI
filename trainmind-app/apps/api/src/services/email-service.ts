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

function getDefaultFrom(): string {
  return process.env.REPORT_FROM_EMAIL || 'TrainMind AI <onboarding@resend.dev>';
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
    STAFF: 'Staff tecnico',
    MEDICAL: 'Staff medico',
    TRAINER: 'Preparazione atletica',
  }[opts.audience] || opts.audience;

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="color: #0f172a; margin: 0 0 8px 0; font-size: 22px;">Report ${audienceLabel}</h1>
    <p style="color: #64748b; margin: 0 0 24px 0; font-size: 14px;">${opts.organizationName} · dal ${opts.periodFrom} al ${opts.periodTo}</p>
    ${opts.summary ? `<div style="background: #f8fafc; border-left: 3px solid #6366f1; padding: 16px; border-radius: 6px; margin-bottom: 24px;"><p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.6;">${opts.summary}</p></div>` : ''}
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">In allegato trovi il report completo nel formato richiesto. Il documento è stato generato automaticamente da TrainMind AI in base alla schedulazione configurata.</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">Questa email è stata inviata automaticamente da TrainMind AI. Per modificare o disattivare la schedulazione, accedi alla dashboard.</p>
  </div>
</body>
</html>`;
}
