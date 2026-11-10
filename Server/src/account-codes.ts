// One-time random reset links sent by email for "forgot password" resets.
// (Email verification at sign-up was removed on the owner's request.)
//
// Safety: responses never reveal whether an email has an account; only a hash of each reset token is
// stored (bound to the user and purpose); tokens expire after 15 minutes and work once; requesting a
// new link cancels older ones; every endpoint is rate-limited per IP.
import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

import { emailDeliveryMode, sendEmail } from './mailer.js';

const CODE_TTL_MS = 15 * 60 * 1000;
const GENERIC_INVALID = 'That reset link is invalid or has expired. Request a new one and try again.';

export type CodePurpose = 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';
type CodeRecord = { id: string; userId: string; purpose: CodePurpose; codeHash: string; attempts: number; expiresAt: Date; usedAt: Date | null };
type AccountUser = { id: string; name: string; email: string; emailVerifiedAt: string | null };

type Deps = {
  prisma: PrismaClient | null;
  findUserByEmail: (email: string) => Promise<AccountUser | undefined>;
  setPasswordHash: (userId: string, passwordHash: string) => Promise<void>;
};

// Last token generated for automated tests only.
export const testHooks: Record<'PASSWORD_RESET_TOKEN', string> = { PASSWORD_RESET_TOKEN: '' };

const EMAIL_TEXT: Record<'PASSWORD_RESET', (name: string, link: string) => { subject: string; text: string }> = {
  PASSWORD_RESET: (name, link) => ({
    subject: 'Reset your AgriSkills Passport password',
    text: `Hello ${name},\n\nUse the link below to choose a new password. This link expires in 15 minutes and can only be used once.\n\n${link}\n\nIf you did not ask to reset your password, you can ignore this email; your password has not changed.`,
  }),
};

function makeStore(prisma: PrismaClient | null) {
  const memory: CodeRecord[] = [];
  return {
    async replace(userId: string, purpose: CodePurpose, codeHash: string, expiresAt: Date) {
      if (prisma) {
        await prisma.$transaction([
          prisma.oneTimeCode.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
          prisma.oneTimeCode.create({ data: { userId, purpose, codeHash, expiresAt } }),
        ]);
        return;
      }
      memory.filter((r) => r.userId === userId && r.purpose === purpose && !r.usedAt).forEach((r) => { r.usedAt = new Date(); });
      memory.push({ id: randomUUID(), userId, purpose, codeHash, attempts: 0, expiresAt, usedAt: null });
    },
    async findActiveByHash(codeHash: string, purpose: CodePurpose): Promise<CodeRecord | undefined> {
      if (prisma) {
        return (await prisma.oneTimeCode.findFirst({
          where: { codeHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        })) ?? undefined;
      }
      return memory.find((r) => r.codeHash === codeHash && r.purpose === purpose && !r.usedAt && r.expiresAt > new Date());
    },
    async markUsed(record: CodeRecord) {
      if (prisma) {
        const result = await prisma.oneTimeCode.updateMany({
          where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        return result.count === 1;
      }
      if (record.usedAt || record.expiresAt <= new Date()) return false;
      record.usedAt = new Date();
      return true;
    },
  };
}

export function createAccountCodes(deps: Deps) {
  const { findUserByEmail, setPasswordHash } = deps;
  const router = express.Router();
  const store = makeStore(deps.prisma);
  const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
  const limiter = (limit: number) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
  });
  const validEmail = (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  async function sendResetLink(user: AccountUser) {
    const token = randomBytes(32).toString('base64url');
    await store.replace(user.id, 'PASSWORD_RESET', hashToken(token), new Date(Date.now() + CODE_TTL_MS));
    testHooks.PASSWORD_RESET_TOKEN = token;
    const resetBaseUrl = (process.env.PASSWORD_RESET_URL ?? 'http://localhost:8081/forgot-password').replace(/\/+$/, '');
    const resetUrl = new URL(resetBaseUrl);
    resetUrl.searchParams.set('token', token);
    await sendEmail({
      to: user.email,
      ...EMAIL_TEXT.PASSWORD_RESET(user.name, resetUrl.toString()),
    });
  }

  const deliveryUnavailable = (res: express.Response) =>
    res.status(503).json({ error: 'Sending emails is not set up on this server yet. Please contact support.' });

  router.post('/auth/forgot-password', limiter(5), async (req, res) => {
    if (!validEmail(req.body?.email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (emailDeliveryMode() === 'unavailable') return deliveryUnavailable(res);
    const user = await findUserByEmail(req.body.email.trim());
    if (user) await sendResetLink(user);
    return res.json({
      message: 'If an account exists for that email, a password reset link has been sent. It expires in 15 minutes.',
      delivery: emailDeliveryMode(),
    });
  });

  router.post('/auth/reset-password', limiter(10), async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== 'string' || token.length < 40 || token.length > 200) {
      return res.status(400).json({ error: 'Open the password reset link from your email.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Your new password must be at least 8 characters.' });
    }
    const record = await store.findActiveByHash(hashToken(token), 'PASSWORD_RESET');
    if (!record) return res.status(400).json({ error: GENERIC_INVALID });

    if (!(await store.markUsed(record))) {
      return res.status(400).json({ error: GENERIC_INVALID });
    }
    await setPasswordHash(record.userId, await bcrypt.hash(password, 10));
    return res.json({ message: 'Your password has been changed. You can now log in.' });
  });

  return { router };
}
