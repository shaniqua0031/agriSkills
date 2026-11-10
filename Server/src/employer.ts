// Employer accounts: an employer checks a credential link a learner shared with them and keeps a
// private list of the people they have checked, with their own notes. Each saved check can be run
// again later, so the employer always sees the credential's current status (for example, revoked).
//
// Privacy: the raw share token is never stored. A check remembers the share link's id, so if the
// learner turns the link off, "Check again" reports that and shows no credential details.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import type { PrismaClient, EmployerCheck as DbEmployerCheck } from '@prisma/client';

/** The same public result the /verify page shows. */
export type PublicVerification = {
  valid: boolean;
  status: string;
  message: string;
  learner: { name: string } | null;
  credential: {
    title: string;
    issuer: string;
    issueDate: string;
    expiryDate: string | null;
    publicId: string;
    skills: string[];
  } | null;
  linkExpiresAt: string | null;
};

export type EmployerCheck = {
  id: string;
  employerId: string;
  shareLinkId: string | null;
  result: string;
  learnerName: string | null;
  credentialTitle: string | null;
  issuerName: string | null;
  note: string | null;
  createdAt: string;
  checkedAt: string;
};

type Deps = {
  prisma: PrismaClient | null;
  authMiddleware: express.RequestHandler;
  requireRole: (...roles: Array<'EMPLOYER'>) => express.RequestHandler;
  /** Verifies a raw share token, exactly like the public /verify page. */
  verifyToken: (token: string) => Promise<{ shareLinkId: string | null; verification: PublicVerification }>;
  /** Verifies a share link by id (used by "Check again"). */
  verifyLinkId: (shareLinkId: string) => Promise<PublicVerification>;
};

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const MAX_NOTE = 500;
const MAX_CHECKS = 200;

/** Accepts a full share link (…/verify/<token>) or just the token. */
export function extractShareToken(input: unknown) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (TOKEN.test(trimmed)) return trimmed;
  return /\/verify\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/.exec(trimmed)?.[1] ?? null;
}

function mapDb(check: DbEmployerCheck): EmployerCheck {
  return {
    id: check.id,
    employerId: check.employerId,
    shareLinkId: check.shareLinkId,
    result: check.result,
    learnerName: check.learnerName,
    credentialTitle: check.credentialTitle,
    issuerName: check.issuerName,
    note: check.note,
    createdAt: check.createdAt.toISOString(),
    checkedAt: check.checkedAt.toISOString(),
  };
}

function toResponse(check: EmployerCheck) {
  const { employerId: _employerId, shareLinkId, ...rest } = check;
  return { ...rest, canRecheck: Boolean(shareLinkId) };
}

/** What a check remembers from a result: the names only when the result showed them. */
function snapshot(verification: PublicVerification) {
  return {
    result: verification.status,
    learnerName: verification.learner?.name ?? null,
    credentialTitle: verification.credential?.title ?? null,
    issuerName: verification.credential?.issuer ?? null,
  };
}

export function createEmployerRouter(deps: Deps) {
  const { prisma } = deps;
  const memory: EmployerCheck[] = [];
  const router = express.Router();
  const employerOnly = [deps.authMiddleware, deps.requireRole('EMPLOYER')];
  const checkRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many checks in a short time. Please wait a minute and try again.' },
  });

  const store = {
    async list(employerId: string) {
      if (prisma) {
        const rows = await prisma.employerCheck.findMany({ where: { employerId }, orderBy: { checkedAt: 'desc' } });
        return rows.map(mapDb);
      }
      return memory
        .filter((check) => check.employerId === employerId)
        .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
    },
    async find(employerId: string, where: { id?: string; shareLinkId?: string }) {
      if (prisma) {
        const row = await prisma.employerCheck.findFirst({ where: { employerId, ...where } });
        return row ? mapDb(row) : undefined;
      }
      return memory.find((check) => check.employerId === employerId
        && (!where.id || check.id === where.id)
        && (!where.shareLinkId || check.shareLinkId === where.shareLinkId));
    },
    async count(employerId: string) {
      if (prisma) return prisma.employerCheck.count({ where: { employerId } });
      return memory.filter((check) => check.employerId === employerId).length;
    },
    async create(data: Omit<EmployerCheck, 'id' | 'createdAt' | 'checkedAt'>) {
      if (prisma) return mapDb(await prisma.employerCheck.create({ data }));
      const now = new Date().toISOString();
      const check: EmployerCheck = { ...data, id: `check-${randomUUID()}`, createdAt: now, checkedAt: now };
      memory.push(check);
      return check;
    },
    async update(check: EmployerCheck, data: Partial<Pick<EmployerCheck, 'result' | 'learnerName' | 'credentialTitle' | 'issuerName' | 'note'>> & { touch?: boolean }) {
      const { touch, ...fields } = data;
      if (prisma) {
        return mapDb(await prisma.employerCheck.update({
          where: { id: check.id },
          data: { ...fields, ...(touch ? { checkedAt: new Date() } : {}) },
        }));
      }
      Object.assign(check, fields, touch ? { checkedAt: new Date().toISOString() } : {});
      return check;
    },
    async remove(check: EmployerCheck) {
      if (prisma) {
        await prisma.employerCheck.delete({ where: { id: check.id } });
        return;
      }
      memory.splice(memory.indexOf(check), 1);
    },
  };

  const readNote = (value: unknown): string | null | Error => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return new Error('The note must be text.');
    if (value.trim().length > MAX_NOTE) return new Error(`Keep the note under ${MAX_NOTE} characters.`);
    return value.trim() || null;
  };

  router.get('/employer/checks', ...employerOnly, async (req: any, res) => {
    const checks = await store.list(req.user.id);
    res.json({ checks: checks.map(toResponse) });
  });

  // Check a shared link. The result is always returned; it is saved when it points at a real share link.
  // Checking the same link again updates the saved entry instead of adding a duplicate.
  router.post('/employer/checks', ...employerOnly, checkRateLimit, async (req: any, res) => {
    const token = extractShareToken(req.body?.link);
    if (!token) {
      return res.status(400).json({ error: 'Paste the full verification link the learner shared, e.g. https://…/verify/AbC123…' });
    }
    const note = readNote(req.body?.note);
    if (note instanceof Error) return res.status(400).json({ error: note.message });

    const { shareLinkId, verification } = await deps.verifyToken(token);
    if (!shareLinkId) {
      return res.json({ check: null, verification });
    }

    const existing = await store.find(req.user.id, { shareLinkId });
    if (existing) {
      const updated = await store.update(existing, { ...snapshot(verification), ...(note ? { note } : {}), touch: true });
      return res.json({ check: toResponse(updated), verification });
    }

    if (await store.count(req.user.id) >= MAX_CHECKS) {
      return res.status(409).json({
        error: `You can keep up to ${MAX_CHECKS} checks. Delete some old ones to save new checks.`,
        verification,
      });
    }
    const created = await store.create({ employerId: req.user.id, shareLinkId, note, ...snapshot(verification) });
    return res.status(201).json({ check: toResponse(created), verification });
  });

  router.post('/employer/checks/:id/recheck', ...employerOnly, checkRateLimit, async (req: any, res) => {
    const check = await store.find(req.user.id, { id: String(req.params.id) });
    if (!check) return res.status(404).json({ error: 'Check not found.' });
    if (!check.shareLinkId) {
      return res.status(409).json({ error: 'The learner deleted this share link, so it cannot be checked again.' });
    }

    const verification = await deps.verifyLinkId(check.shareLinkId);
    // Keep the names the employer already saw; only update them when the new result shows them.
    const fresh = snapshot(verification);
    const updated = await store.update(check, {
      result: fresh.result,
      ...(verification.credential ? fresh : {}),
      touch: true,
    });
    return res.json({ check: toResponse(updated), verification });
  });

  router.patch('/employer/checks/:id', ...employerOnly, async (req: any, res) => {
    const check = await store.find(req.user.id, { id: String(req.params.id) });
    if (!check) return res.status(404).json({ error: 'Check not found.' });
    const note = readNote(req.body?.note);
    if (note instanceof Error) return res.status(400).json({ error: note.message });
    const updated = await store.update(check, { note });
    return res.json({ check: toResponse(updated) });
  });

  router.delete('/employer/checks/:id', ...employerOnly, async (req: any, res) => {
    const check = await store.find(req.user.id, { id: String(req.params.id) });
    if (!check) return res.status(404).json({ error: 'Check not found.' });
    await store.remove(check);
    return res.status(204).end();
  });

  return router;
}
