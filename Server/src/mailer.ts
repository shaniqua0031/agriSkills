// Sends account emails (verification and password-reset links).
//
// Delivery, chosen from Server/.env:
// - SMTP (e.g. Gmail): SMTP_USER + SMTP_PASS set. For Gmail, SMTP_PASS is an App Password
//   (myaccount.google.com/apppasswords), never the normal Gmail password. Host/port default to Gmail.
// - Resend: RESEND_API_KEY + EMAIL_FROM set.
// - Otherwise: printed in the server terminal during development; unavailable in production.
import nodemailer from 'nodemailer';

export type EmailDelivery = 'email' | 'console' | 'unavailable';

function smtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function emailDeliveryMode(): EmailDelivery {
  if (smtpConfigured() || resendConfigured()) return 'email';
  return process.env.NODE_ENV === 'production' ? 'unavailable' : 'console';
}

let transport: nodemailer.Transporter | null = null;

function smtpTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465,
      // Gmail shows app passwords in groups of four; spaces are not part of the password.
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!.replace(/\s+/g, '') },
    });
  }
  return transport;
}

export async function sendEmail(message: { to: string; subject: string; text: string }) {
  if (smtpConfigured()) {
    const from = process.env.EMAIL_FROM || `AgriSkills Passport <${process.env.SMTP_USER}>`;
    try {
      await smtpTransport().sendMail({ from, to: message.to, subject: message.subject, text: message.text });
    } catch (error) {
      // Log the reason for the operator; never include it in API responses.
      console.error('Email sending failed (SMTP):', error instanceof Error ? error.message : error);
      throw new Error('Email sending failed.');
    }
    return;
  }

  if (resendConfigured()) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
    });
    if (!response.ok) {
      console.error('Email sending failed (Resend):', response.status, await response.text().catch(() => ''));
      throw new Error('Email sending failed.');
    }
    return;
  }

  if (emailDeliveryMode() === 'console') {
    console.log(`\n[email to ${message.to}] ${message.subject}\n${message.text}\n`);
    return;
  }
  throw new Error('Email delivery is not configured (set SMTP_USER/SMTP_PASS or RESEND_API_KEY/EMAIL_FROM).');
}

/** Checks the SMTP login at start-up so a wrong app password shows up immediately in the terminal. */
export async function checkEmailSetup() {
  if (!smtpConfigured()) return;
  try {
    await smtpTransport().verify();
    console.log(`Email: sending via SMTP as ${process.env.SMTP_USER}`);
  } catch (error) {
    console.error('Email: SMTP login failed. Check SMTP_USER and SMTP_PASS (a Gmail App Password) in Server/.env.',
      error instanceof Error ? error.message : error);
  }
}
