// Curated profiles: a learner picks several of their credentials and shares them through one
// link and QR code. An employer opens /profile/<token> (no account needed) and sees each
// credential checked separately, exactly as a single /verify link would check it.
//
// Rules (same as single share links):
// - The random token is returned once; only its SHA-256 hash is stored.
// - A turned-off, expired or unknown link reveals no learner or credential details.
// - A credential that fails its integrity check shows no details, even inside an active profile.
// - Only the learner's own, active credentials can be added when the link is created.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { SHARE_TOKEN_PATTERN, createShareToken, hashShareToken } from './integrity.js';
import { badge, escapeHtml, field, formatPageDate, renderPublicPage, skillsField } from './public-page.js';

export const MAX_PROFILE_CREDENTIALS = 20;
export const MAX_PROFILE_TITLE = 80;

type PublicCredential = {
  title: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  publicId: string;
  skills: string[];
};

/** One credential's result inside a profile. */
export type ProfileItemResult = {
  status: string;
  valid: boolean;
  message: string;
  label: string;
  credential: PublicCredential | null;
};

type ProfileStatus = 'VERIFIED' | 'PARTLY_VERIFIED' | 'LINK_EXPIRED' | 'LINK_REVOKED' | 'NOT_FOUND';

type CredentialLike = { id: string; title: string };

type ProfileLink = {
  id: string;
  tokenHash: string;
  createdByUserId: string;
  title: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** In the order the learner picked them. */
  credentialIds: string[];
};

type DbProfileLink = Prisma.ProfileLinkGetPayload<{ include: { items: { select: { credentialId: true; position: true } } } }>;

type Deps<C extends CredentialLike> = {
  prisma: PrismaClient | null;
  authMiddleware: express.RequestHandler;
  requireRole: (...roles: Array<'LEARNER'>) => express.RequestHandler;
  publicBaseUrl: () => string;
  maxDays: number;
  defaultDays: number;
  setVerificationHeaders: (res: express.Response) => void;
  findOwnCredential: (id: string, learnerId: string) => Promise<C | undefined>;
  findCredential: (id: string) => Promise<C | undefined>;
  isShareable: (credential: C) => boolean;
  findUserName: (id: string) => Promise<string | null>;
  /** Checks one credential (integrity and status) and records the check. */
  checkCredential: (credential: C, profileLinkId: string) => Promise<ProfileItemResult>;
};

function linkStatus(link: ProfileLink) {
  if (link.revokedAt) return 'REVOKED' as const;
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) return 'EXPIRED' as const;
  return 'ACTIVE' as const;
}

function profileMessage(status: ProfileStatus, verified: number, total: number) {
  switch (status) {
    case 'VERIFIED':
      return total === 1
        ? 'The credential is authentic, active and was shared by its holder.'
        : `All ${total} credentials are authentic, active and were shared by their holder.`;
    case 'PARTLY_VERIFIED':
      return `${verified} of ${total} credentials are verified. Check the result for each one below.`;
    case 'LINK_EXPIRED':
      return 'This profile link has expired. Ask the learner for a new link.';
    case 'LINK_REVOKED':
      return 'The learner has turned off this profile link.';
    default:
      return 'This link does not match any shared profile.';
  }
}

function profileLabel(status: ProfileStatus) {
  switch (status) {
    case 'VERIFIED':
      return 'Profile Verified';
    case 'PARTLY_VERIFIED':
      return 'Some Credentials Need a Look';
    case 'LINK_EXPIRED':
      return 'Link Expired';
    case 'LINK_REVOKED':
      return 'Link Turned Off';
    default:
      return 'Not Found';
  }
}

export type PublicProfile = {
  valid: boolean;
  status: ProfileStatus;
  message: string;
  title: string | null;
  learner: { name: string } | null;
  verifiedCount: number;
  credentials: Array<Omit<ProfileItemResult, 'label'>>;
  linkExpiresAt: string | null;
};

function renderProfilePage(profile: PublicProfile, labels: string[]) {
  const label = profileLabel(profile.status);
  const items = profile.credentials.map((item, index) => {
    const credential = item.credential;
    const details = credential
      ? [
          field('Issued by', escapeHtml(credential.issuer)),
          field('Issue date', escapeHtml(formatPageDate(credential.issueDate))),
          field('Expiry date', credential.expiryDate ? escapeHtml(formatPageDate(credential.expiryDate)) : 'No expiry'),
          field('Public reference', escapeHtml(credential.publicId)),
          credential.skills.length > 0 ? skillsField(credential.skills) : '',
        ].join('')
      : '';
    return `<section class="item">${badge(labels[index], item.status)}<h2>${escapeHtml(credential?.title ?? 'Credential not shown')}</h2><p class="message">${escapeHtml(item.message)}</p>${details}</section>`;
  }).join('');

  const header = [
    profile.learner ? field('Learner', escapeHtml(profile.learner.name)) : '',
    profile.linkExpiresAt ? field('This link expires', escapeHtml(formatPageDate(profile.linkExpiresAt))) : '',
  ].join('');

  return renderPublicPage({
    title: label,
    extraCss: '.item{border:1px solid #e1e9e2;border-radius:16px;padding:4px 18px 8px;margin-top:16px}.item .badge{margin-top:16px}h2{font-size:19px;line-height:1.3;margin:10px 0 6px}.subtitle{color:#34754b;font-weight:700;margin:0 0 6px}',
    body: `${badge(label, profile.status === 'PARTLY_VERIFIED' ? 'PARTLY' : profile.status)}<h1>${escapeHtml(label)}</h1>${profile.title ? `<p class="subtitle">${escapeHtml(profile.title)}</p>` : ''}<p class="message">${escapeHtml(profile.message)}</p>${header}${items}`,
  });
}

export function createProfileLinkRouter<C extends CredentialLike>(deps: Deps<C>) {
  const { prisma } = deps;
  const memory: ProfileLink[] = [];
  const router = express.Router();
  const learnerOnly = [deps.authMiddleware, deps.requireRole('LEARNER')];

  const creationLimit = rateLimit({
    windowMs: 60_000,
    limit: 20,
    keyGenerator: (req: any) => req.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many links created in a short time. Please wait a minute and try again.' },
  });
  const viewLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  const mapDb = (link: DbProfileLink): ProfileLink => ({
    id: link.id,
    tokenHash: link.tokenHash,
    createdByUserId: link.createdByUserId,
    title: link.title,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    credentialIds: [...link.items].sort((a, b) => a.position - b.position).map((item) => item.credentialId),
  });
  const withItems = { items: { select: { credentialId: true, position: true } } } as const;

  const store = {
    async create(data: Omit<ProfileLink, 'id' | 'createdAt' | 'revokedAt'>) {
      if (prisma) {
        return mapDb(await prisma.profileLink.create({
          data: {
            tokenHash: data.tokenHash,
            createdByUserId: data.createdByUserId,
            title: data.title,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            items: { create: data.credentialIds.map((credentialId, position) => ({ credentialId, position })) },
          },
          include: withItems,
        }));
      }
      const link: ProfileLink = { ...data, id: `profile-${randomUUID()}`, revokedAt: null, createdAt: new Date().toISOString() };
      memory.unshift(link);
      return link;
    },
    async list(createdByUserId: string) {
      if (prisma) {
        const rows = await prisma.profileLink.findMany({ where: { createdByUserId }, orderBy: { createdAt: 'desc' }, include: withItems });
        return rows.map(mapDb);
      }
      return memory.filter((link) => link.createdByUserId === createdByUserId);
    },
    async find(where: { id: string } | { tokenHash: string }) {
      if (prisma) {
        const row = await prisma.profileLink.findUnique({ where, include: withItems });
        return row ? mapDb(row) : undefined;
      }
      return memory.find((link) => ('id' in where ? link.id === where.id : link.tokenHash === where.tokenHash));
    },
    async revoke(link: ProfileLink) {
      if (link.revokedAt) return link;
      if (prisma) {
        return mapDb(await prisma.profileLink.update({ where: { id: link.id }, data: { revokedAt: new Date() }, include: withItems }));
      }
      link.revokedAt = new Date().toISOString();
      return link;
    },
  };

  const toLearnerView = async (link: ProfileLink, learnerId: string) => ({
    id: link.id,
    title: link.title,
    status: linkStatus(link),
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    createdAt: link.createdAt,
    credentials: (await findExisting(link.credentialIds, (id) => deps.findOwnCredential(id, learnerId)))
      .map((credential) => ({ id: credential.id, title: credential.title })),
  });

  /** Looks up each id in order, skipping any that no longer exist. */
  async function findExisting(ids: string[], find: (id: string) => Promise<C | undefined>) {
    const found: C[] = [];
    for (const id of ids) {
      const credential = await find(id);
      if (credential) found.push(credential);
    }
    return found;
  }

  router.post('/learner/profile-links', ...learnerOnly, creationLimit, async (req: any, res) => {
    const { credentialIds, title } = req.body ?? {};
    const expiresInDays = req.body?.expiresInDays ?? deps.defaultDays;

    if (!Array.isArray(credentialIds) || credentialIds.length === 0 || credentialIds.some((id: unknown) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'Choose at least one credential for your profile.' });
    }
    if (credentialIds.length > MAX_PROFILE_CREDENTIALS) {
      return res.status(400).json({ error: `A profile can hold up to ${MAX_PROFILE_CREDENTIALS} credentials.` });
    }
    if (new Set(credentialIds).size !== credentialIds.length) {
      return res.status(400).json({ error: 'Each credential can only be added to a profile once.' });
    }
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > deps.maxDays) {
      return res.status(400).json({ error: `expiresInDays must be a whole number from 1 to ${deps.maxDays}.` });
    }
    if (title !== undefined && title !== null && (typeof title !== 'string' || title.trim().length > MAX_PROFILE_TITLE)) {
      return res.status(400).json({ error: `Keep the profile title under ${MAX_PROFILE_TITLE} characters.` });
    }

    const chosen = await Promise.all(credentialIds.map((id: string) => deps.findOwnCredential(id, req.user.id)));
    if (chosen.some((credential) => !credential)) {
      return res.status(404).json({ error: 'One or more credentials were not found in your passport.' });
    }
    const notShareable = (chosen as C[]).filter((credential) => !deps.isShareable(credential));
    if (notShareable.length > 0) {
      return res.status(409).json({
        error: `Only active credentials can be shared. Remove: ${notShareable.map((credential) => credential.title).join(', ')}.`,
      });
    }

    // The raw token is returned once and never stored; only its hash is saved.
    const token = createShareToken();
    const link = await store.create({
      tokenHash: hashShareToken(token),
      createdByUserId: req.user.id,
      title: typeof title === 'string' && title.trim() ? title.trim() : null,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      credentialIds,
    });

    return res.status(201).json({
      profileLink: await toLearnerView(link, req.user.id),
      shareUrl: `${deps.publicBaseUrl()}/profile/${token}`,
    });
  });

  router.get('/learner/profile-links', ...learnerOnly, async (req: any, res) => {
    const links = await store.list(req.user.id);
    res.json({ profileLinks: await Promise.all(links.map((link) => toLearnerView(link, req.user.id))) });
  });

  router.delete('/learner/profile-links/:id', ...learnerOnly, async (req: any, res) => {
    const link = await store.find({ id: String(req.params.id) });
    if (!link || link.createdByUserId !== req.user.id) {
      return res.status(404).json({ error: 'Profile link not found.' });
    }
    return res.json({ profileLink: await toLearnerView(await store.revoke(link), req.user.id) });
  });

  async function verifyProfile(token: string | undefined): Promise<{ profile: PublicProfile; labels: string[] }> {
    const empty = (status: ProfileStatus) => ({
      profile: {
        valid: false,
        status,
        message: profileMessage(status, 0, 0),
        title: null,
        learner: null,
        verifiedCount: 0,
        credentials: [],
        linkExpiresAt: null,
      },
      labels: [],
    });

    if (!token || !SHARE_TOKEN_PATTERN.test(token)) return empty('NOT_FOUND');
    const link = await store.find({ tokenHash: hashShareToken(token) });
    if (!link) return empty('NOT_FOUND');
    const state = linkStatus(link);
    if (state === 'REVOKED') return empty('LINK_REVOKED');
    if (state === 'EXPIRED') return empty('LINK_EXPIRED');

    const credentials = await findExisting(link.credentialIds, deps.findCredential);
    if (credentials.length === 0) return empty('NOT_FOUND');

    const results = [];
    for (const credential of credentials) results.push(await deps.checkCredential(credential, link.id));
    const verifiedCount = results.filter((item) => item.valid).length;
    const status: ProfileStatus = verifiedCount === results.length ? 'VERIFIED' : 'PARTLY_VERIFIED';
    const learnerName = await deps.findUserName(link.createdByUserId);

    return {
      profile: {
        valid: status === 'VERIFIED',
        status,
        message: profileMessage(status, verifiedCount, results.length),
        title: link.title,
        learner: learnerName ? { name: learnerName } : null,
        verifiedCount,
        credentials: results.map(({ label: _label, ...item }) => item),
        linkExpiresAt: link.expiresAt,
      },
      labels: results.map((item) => item.label),
    };
  }

  const httpStatus = (status: ProfileStatus) => (status === 'NOT_FOUND' ? 404 : status.startsWith('LINK_') ? 410 : 200);

  router.get('/profile/:token', viewLimit, async (req, res) => {
    deps.setVerificationHeaders(res);
    const { profile, labels } = await verifyProfile(String(req.params.token));
    res.status(httpStatus(profile.status)).send(renderProfilePage(profile, labels));
  });

  router.get('/api/profile/:token', viewLimit, async (req, res) => {
    deps.setVerificationHeaders(res);
    const { profile } = await verifyProfile(String(req.params.token));
    res.status(httpStatus(profile.status)).json(profile);
  });

  return router;
}
