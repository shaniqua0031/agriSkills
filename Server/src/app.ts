import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';

import { computeCredentialStatus, type Role, type CredentialRecord } from './domain.js';
import { createEvidenceRouter } from './evidence.js';
import { createAccountCodes } from './account-codes.js';
import {
  SHARE_TOKEN_PATTERN,
  SIGNATURE_ALGORITHM,
  SIGNATURE_KEY_ID,
  createShareToken,
  getSigningSecret,
  hashShareToken,
  signCredential,
  verifyCredentialSignature,
} from './integrity.js';

dotenv.config();
// Read once at startup so a missing production secret stops the server immediately.
getSigningSecret();

const app = express();
// Rate limits work per visitor IP. Behind a proxy (Cloudflare tunnel, Render) every request
// arrives from the proxy, so read the visitor IP from X-Forwarded-For, but only from a proxy we
// trust. The default trusts only proxies on this machine (cloudflared); on Render set TRUST_PROXY=1.
const trustProxySetting = process.env.TRUST_PROXY?.trim() || 'loopback';
app.set(
  'trust proxy',
  /^\d+$/.test(trustProxySetting) ? Number(trustProxySetting)
    : trustProxySetting === 'false' ? false
    : trustProxySetting,
);
const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'demo-secret');
const configuredPublicBaseUrl = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') || null;

if (!configuredPublicBaseUrl && process.env.NODE_ENV === 'production') {
  throw new Error('PUBLIC_BASE_URL must be set in production (it is the address put in share links and QR codes).');
}

// Base URL for share links / QR codes. In development without PUBLIC_BASE_URL, use this laptop's
// current Wi-Fi/LAN address (looked up per request, so it follows address changes) so that a
// phone on the same network can open the link.
function publicBaseUrl() {
  if (configuredPublicBaseUrl) return configuredPublicBaseUrl;
  const lanAddress = Object.values(networkInterfaces())
    .flat()
    .find((entry) => entry && entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'));
  return `http://${lanAddress?.address ?? 'localhost'}:${port}`;
}
const databaseUrl = process.env.DATABASE_URL;
const prisma = databaseUrl ? new PrismaClient() : null;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set in production.');
}

app.use(cors());
// The local photo upload route parses its own (larger) JSON body; everything else keeps the 100 KB default.
const jsonParser = express.json();
app.use((req, res, next) => (req.path === '/learner/evidence/local-upload' ? next() : jsonParser(req, res, next)));

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  emailVerifiedAt: string | null;
  privacyAcceptedAt: string | null;
  issuerApprovedAt: string | null;
  issuerApprovedById: string | null;
};

export type Credential = CredentialRecord & {
  issuer?: { id: string; name: string; email: string; role: Role };
  learner?: { id: string; name: string; email: string; role: Role };
};

const users: User[] = [
  {
    id: 'learner-1',
    name: 'Sharone Mabunda',
    email: 'sharone@example.com',
    passwordHash: bcrypt.hashSync('Password123', 10),
    role: 'LEARNER',
    createdAt: new Date().toISOString(),
    emailVerifiedAt: new Date().toISOString(),
    privacyAcceptedAt: new Date().toISOString(),
    issuerApprovedAt: null,
    issuerApprovedById: null,
  },
  {
    id: 'issuer-1',
    name: 'Demo Agricultural Training Provider',
    email: 'issuer@example.com',
    passwordHash: bcrypt.hashSync('Password123', 10),
    role: 'ISSUER',
    createdAt: new Date().toISOString(),
    emailVerifiedAt: new Date().toISOString(),
    privacyAcceptedAt: new Date().toISOString(),
    issuerApprovedAt: new Date().toISOString(),
    issuerApprovedById: null,
  },
];

const credentials: Credential[] = [
  {
    id: 'cred-1',
    publicId: 'demo-safety-cert',
    learnerId: 'learner-1',
    issuerId: 'issuer-1',
    title: 'Agricultural Safety Certificate',
    description: 'Practical safety and hazard awareness for agricultural work sites.',
    category: 'Safety',
    issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    status: 'ACTIVE',
    skills: ['Risk assessment', 'Equipment handling', 'Safe work practices'],
    evidence: 'Field safety induction records',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learner: users[0],
    issuer: users[1],
  },
  {
    id: 'cred-2',
    publicId: 'demo-crop-production',
    learnerId: 'learner-1',
    issuerId: 'issuer-1',
    title: 'Crop Production Skills',
    description: 'Skills in crop planning, planting and maintenance.',
    category: 'Agronomy',
    issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
    status: 'ACTIVE',
    skills: ['Planting', 'Field planning', 'Soil care'],
    evidence: 'Practical crop cycle assessment',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learner: users[0],
    issuer: users[1],
  },
  {
    id: 'cred-3',
    publicId: 'demo-sustainable-farming',
    learnerId: 'learner-1',
    issuerId: 'issuer-1',
    title: 'Sustainable Farming Practices',
    description: 'Sustainable soil, water and ecological farm practices.',
    category: 'Sustainability',
    issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 240).toISOString(),
    status: 'ACTIVE',
    skills: ['Soil health', 'Water conservation', 'Agroecology'],
    evidence: 'Farm systems review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learner: users[0],
    issuer: users[1],
  },
  {
    id: 'cred-4',
    publicId: 'demo-irrigation-management',
    learnerId: 'learner-1',
    issuerId: 'issuer-1',
    title: 'Irrigation Management',
    description: 'Efficient irrigation scheduling and water distribution techniques.',
    category: 'Water Management',
    issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 150).toISOString(),
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
    status: 'ACTIVE',
    skills: ['Water scheduling', 'System checks', 'Efficiency auditing'],
    evidence: 'Irrigation plan and operation log',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learner: users[0],
    issuer: users[1],
  },
  {
    id: 'cred-5',
    publicId: 'demo-agri-entrepreneurship',
    learnerId: 'learner-1',
    issuerId: 'issuer-1',
    title: 'Agricultural Entrepreneurship',
    description: 'Enterprise readiness covering planning, enterprise design and value chains.',
    category: 'Business',
    issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 400).toISOString(),
    status: 'ACTIVE',
    skills: ['Business planning', 'Market analysis', 'Value chains'],
    evidence: 'Business model pitch and review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learner: users[0],
    issuer: users[1],
  },
];

for (const credential of credentials) {
  Object.assign(credential, signatureFields(credential));
}

function signatureFields(credential: Parameters<typeof signCredential>[0]) {
  return {
    signature: signCredential(credential),
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    signatureKeyId: SIGNATURE_KEY_ID,
  };
}

export type ShareLink = {
  id: string;
  credentialId: string;
  tokenHash: string;
  createdByUserId: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const shareLinks: ShareLink[] = [];

function mapDbUser(user: Prisma.UserGetPayload<object>): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.password,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    privacyAcceptedAt: user.privacyAcceptedAt?.toISOString() ?? null,
    issuerApprovedAt: user.issuerApprovedAt?.toISOString() ?? null,
    issuerApprovedById: user.issuerApprovedById ?? null,
  };
}

/** The account details the app is allowed to see. */
function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
    issuerApproved: user.role === 'ISSUER' ? Boolean(user.issuerApprovedAt) : undefined,
  };
}

async function findUserByEmail(email: string): Promise<User | undefined> {
  if (prisma) {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    return user ? mapDbUser(user) : undefined;
  }

  return users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
}

async function findUserById(id: string): Promise<User | undefined> {
  if (prisma) {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? mapDbUser(user) : undefined;
  }

  return users.find((user) => user.id === id);
}

type DbCredential = Prisma.CredentialGetPayload<{ include: { learner: true; issuer: true } }>;

function mapDbCredential(credential: DbCredential): Credential {
  return {
    id: credential.id,
    publicId: credential.publicId,
    learnerId: credential.learnerId,
    issuerId: credential.issuerId,
    title: credential.title,
    description: credential.description,
    category: credential.category,
    issueDate: credential.issueDate.toISOString(),
    expiryDate: credential.expiryDate?.toISOString() ?? null,
    status: credential.status,
    skills: credential.skills,
    evidence: credential.evidence,
    revokedAt: credential.revokedAt?.toISOString() ?? null,
    signature: credential.signature,
    signatureAlgorithm: credential.signatureAlgorithm,
    signatureKeyId: credential.signatureKeyId,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
    learner: {
      id: credential.learner.id,
      name: credential.learner.name,
      email: credential.learner.email,
      role: credential.learner.role,
    },
    issuer: {
      id: credential.issuer.id,
      name: credential.issuer.name,
      email: credential.issuer.email,
      role: credential.issuer.role,
    },
  };
}

async function listCredentials(where: { learnerId?: string; issuerId?: string }): Promise<Credential[]> {
  if (prisma) {
    const records = await prisma.credential.findMany({
      where,
      include: { learner: true, issuer: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(mapDbCredential);
  }

  return credentials
    .filter((credential) =>
      (!where.learnerId || credential.learnerId === where.learnerId)
      && (!where.issuerId || credential.issuerId === where.issuerId),
    );
}

async function findCredential(where: {
  id?: string;
  publicId?: string;
  learnerId?: string;
  issuerId?: string;
}): Promise<Credential | undefined> {
  if (prisma) {
    if (where.id || where.publicId) {
      const record = await prisma.credential.findUnique({
        where: where.id ? { id: where.id } : { publicId: where.publicId! },
        include: { learner: true, issuer: true },
      });
      if (!record
        || (where.learnerId && record.learnerId !== where.learnerId)
        || (where.issuerId && record.issuerId !== where.issuerId)) {
        return undefined;
      }
      return mapDbCredential(record);
    }

    return undefined;
  }

  return credentials.find((credential) =>
    (!where.id || credential.id === where.id)
    && (!where.publicId || credential.publicId === where.publicId)
    && (!where.learnerId || credential.learnerId === where.learnerId)
    && (!where.issuerId || credential.issuerId === where.issuerId),
  );
}

async function createCredential(data: {
  learnerId: string;
  issuerId: string;
  title: string;
  description: string;
  category: string;
  issueDate: Date;
  expiryDate: Date | null;
  skills: string[];
  evidence: string | null;
}): Promise<Credential> {
  const publicId = `cred-${randomUUID()}`;
  const signed = signatureFields({
    ...data,
    publicId,
    issueDate: data.issueDate.toISOString(),
    expiryDate: data.expiryDate?.toISOString() ?? null,
  });

  if (prisma) {
    const record = await prisma.credential.create({
      data: {
        ...data,
        ...signed,
        publicId,
        status: 'ACTIVE',
      },
      include: { learner: true, issuer: true },
    });
    return mapDbCredential(record);
  }

  const learner = users.find((user) => user.id === data.learnerId);
  const issuer = users.find((user) => user.id === data.issuerId);
  if (!learner || !issuer) {
    throw new Error('Credential references an unknown account.');
  }
  const now = new Date().toISOString();
  const record: Credential = {
    ...data,
    ...signed,
    id: `cred-${randomUUID()}`,
    publicId,
    issueDate: data.issueDate.toISOString(),
    expiryDate: data.expiryDate?.toISOString() ?? null,
    status: 'ACTIVE',
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    learner,
    issuer,
  };
  credentials.unshift(record);
  return record;
}

async function revokeCredential(credential: Credential): Promise<Credential> {
  if (prisma) {
    const record = await prisma.credential.update({
      where: { id: credential.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
      include: { learner: true, issuer: true },
    });
    return mapDbCredential(record);
  }

  credential.status = 'REVOKED';
  credential.revokedAt = new Date().toISOString();
  credential.updatedAt = new Date().toISOString();
  return credential;
}

type DbShareLink = Prisma.ShareLinkGetPayload<object>;

function mapDbShareLink(link: DbShareLink): ShareLink {
  return {
    id: link.id,
    credentialId: link.credentialId,
    tokenHash: link.tokenHash,
    createdByUserId: link.createdByUserId,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };
}

async function createShareLink(data: {
  credentialId: string;
  createdByUserId: string;
  tokenHash: string;
  expiresAt: Date | null;
}): Promise<ShareLink> {
  if (prisma) {
    return mapDbShareLink(await prisma.shareLink.create({ data }));
  }

  const link: ShareLink = {
    ...data,
    id: `share-${randomUUID()}`,
    expiresAt: data.expiresAt?.toISOString() ?? null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
  shareLinks.unshift(link);
  return link;
}

async function listShareLinks(credentialId: string, createdByUserId: string): Promise<ShareLink[]> {
  if (prisma) {
    const links = await prisma.shareLink.findMany({
      where: { credentialId, createdByUserId },
      orderBy: { createdAt: 'desc' },
    });
    return links.map(mapDbShareLink);
  }

  return shareLinks.filter((link) => link.credentialId === credentialId && link.createdByUserId === createdByUserId);
}

async function findShareLink(where: { id?: string; tokenHash?: string }): Promise<ShareLink | undefined> {
  if (prisma) {
    const link = where.id
      ? await prisma.shareLink.findUnique({ where: { id: where.id } })
      : where.tokenHash
        ? await prisma.shareLink.findUnique({ where: { tokenHash: where.tokenHash } })
        : null;
    return link ? mapDbShareLink(link) : undefined;
  }

  return shareLinks.find((link) =>
    (!where.id || link.id === where.id) && (!where.tokenHash || link.tokenHash === where.tokenHash),
  );
}

async function revokeShareLink(link: ShareLink): Promise<ShareLink> {
  if (link.revokedAt) return link;
  if (prisma) {
    return mapDbShareLink(await prisma.shareLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() },
    }));
  }

  link.revokedAt = new Date().toISOString();
  return link;
}

async function logVerification(credentialId: string, shareLinkId: string, result: string) {
  if (!prisma) return;
  try {
    await prisma.verificationEvent.create({ data: { credentialId, shareLinkId, eventType: result } });
  } catch (error) {
    // An audit-log failure must not hide the verification result from the employer.
    console.error('Could not record verification event:', error);
  }
}

function signToken(user: User) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let decoded: { sub: string; role: Role; email: string };
  try {
    decoded = jwt.verify(header.slice('Bearer '.length), jwtSecret) as typeof decoded;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const user = await findUserById(decoded.sub);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  req.user = user;
  next();
}

function requireRole(...roles: Role[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

function withComputedCredentialStatus(credential: Credential) {
  const effectiveStatus = computeCredentialStatus({
    status: credential.status,
    expiryDate: credential.expiryDate,
    revokedAt: credential.revokedAt,
  });

  const base = {
    ...credential,
    status: effectiveStatus,
    learner: credential.learner ?? users.find((user) => user.id === credential.learnerId),
    issuer: credential.issuer ?? users.find((user) => user.id === credential.issuerId),
  };

  return {
    ...base,
    learner: base.learner ? { id: base.learner.id, name: base.learner.name, email: base.learner.email, role: base.learner.role } : undefined,
    issuer: base.issuer ? { id: base.issuer.id, name: base.issuer.name, email: base.issuer.email, role: base.issuer.role } : undefined,
  };
}

function toPublicShareLink(link: ShareLink) {
  const now = Date.now();
  const status = link.revokedAt
    ? 'REVOKED'
    : link.expiresAt && new Date(link.expiresAt).getTime() <= now
      ? 'EXPIRED'
      : 'ACTIVE';
  return {
    id: link.id,
    credentialId: link.credentialId,
    status,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    createdAt: link.createdAt,
  };
}

// Result order matters: link problems and failed integrity checks reveal no credential details.
export type VerificationResult =
  | 'VERIFIED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'PENDING'
  | 'LINK_EXPIRED'
  | 'LINK_REVOKED'
  | 'INVALID'
  | 'NOT_FOUND';

async function verifyShareToken(token: string | undefined) {
  if (!token || !SHARE_TOKEN_PATTERN.test(token)) {
    return { result: 'NOT_FOUND' as VerificationResult };
  }

  const link = await findShareLink({ tokenHash: hashShareToken(token) });
  if (!link) return { result: 'NOT_FOUND' as VerificationResult };

  const credential = await findCredential({ id: link.credentialId });
  if (!credential) return { result: 'NOT_FOUND' as VerificationResult };

  const linkStatus = toPublicShareLink(link).status;
  let result: VerificationResult;
  if (linkStatus === 'REVOKED') {
    result = 'LINK_REVOKED';
  } else if (linkStatus === 'EXPIRED') {
    result = 'LINK_EXPIRED';
  } else if (!verifyCredentialSignature(credential)) {
    result = 'INVALID';
  } else {
    const status = computeCredentialStatus(credential);
    result = status === 'ACTIVE' ? 'VERIFIED' : status;
  }

  await logVerification(credential.id, link.id, result);
  const showsCredential = ['VERIFIED', 'EXPIRED', 'REVOKED', 'PENDING'].includes(result);
  return { result, credential: showsCredential ? credential : undefined, link };
}

function makePublicVerificationResponse(verification: Awaited<ReturnType<typeof verifyShareToken>>) {
  const { result, credential } = verification;
  const learner = credential && (credential.learner ?? users.find((user) => user.id === credential.learnerId));
  const issuer = credential && (credential.issuer ?? users.find((user) => user.id === credential.issuerId));

  return {
    valid: result === 'VERIFIED',
    status: result,
    message: verificationMessage(result),
    learner: learner ? { name: learner.name } : null,
    credential: credential
      ? {
          title: credential.title,
          issuer: issuer ? issuer.name : 'Unknown issuer',
          issueDate: credential.issueDate,
          expiryDate: credential.expiryDate ?? null,
          publicId: credential.publicId,
          skills: credential.skills,
        }
      : null,
    linkExpiresAt: credential ? verification.link?.expiresAt ?? null : null,
  };
}

function verificationMessage(result: VerificationResult) {
  switch (result) {
    case 'VERIFIED':
      return 'The credential is authentic, active and was shared by its holder.';
    case 'EXPIRED':
      return 'The credential is authentic but has passed its expiry date.';
    case 'REVOKED':
      return 'The issuer has revoked this credential.';
    case 'PENDING':
      return 'The credential has not been activated by the issuer yet.';
    case 'LINK_EXPIRED':
      return 'This share link has expired. Ask the learner for a new link.';
    case 'LINK_REVOKED':
      return 'The learner has turned off this share link.';
    case 'INVALID':
      return 'The credential failed its integrity check and cannot be trusted.';
    default:
      return 'This link does not match any shared credential.';
  }
}

// Friendly page for anyone who opens the API address in a browser (instead of "Cannot GET /").
// The app itself is served separately (Expo: http://localhost:8082 in development).
app.get('/', (req, res) => {
  const appUrl = process.env.PUBLIC_APP_URL?.trim() || `http://${req.hostname}:8082`;
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgriSkills Passport API</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#eff7f1;color:#102a1a;display:grid;place-items:center;min-height:100vh}
  main{background:#fff;border-radius:18px;padding:28px;max-width:440px;margin:16px;box-shadow:0 8px 30px rgba(16,42,26,.08)}
  h1{font-size:22px;margin:0 0 6px} p{color:#48615a;line-height:1.5;margin:8px 0}
  .ok{display:inline-block;background:#dcfce7;color:#14532d;font-weight:700;border-radius:999px;padding:4px 12px;font-size:13px}
  a.button{display:inline-block;margin-top:14px;background:#1f7a46;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px}
  code{background:#eef3ef;padding:2px 6px;border-radius:6px}
</style></head>
<body><main>
  <span class="ok">● Server is running</span>
  <h1>AgriSkills Passport API</h1>
  <p>This address is the server the app talks to. There is nothing to use here directly.</p>
  <p>Health check: <a href="/health"><code>/health</code></a></p>
  <a class="button" href="${escapeHtml(appUrl)}">Open the AgriSkills Passport app →</a>
</main></body></html>`);
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'agri-skills-passport-api',
    storage: prisma ? 'postgresql' : 'memory-test',
  });
});

// Only failed logins count, so normal use is never blocked; guessing passwords is.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many failed login attempts. Please wait 15 minutes and try again.' },
});
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this network. Please try again later.' },
});

async function setPasswordHash(userId: string, passwordHash: string) {
  if (prisma) {
    await prisma.user.update({ where: { id: userId }, data: { password: passwordHash } });
    return;
  }
  const user = users.find((candidate) => candidate.id === userId);
  if (user) user.passwordHash = passwordHash;
}

const accountCodes = createAccountCodes({ prisma, findUserByEmail, setPasswordHash });
app.use(accountCodes.router);

// Sign-up creates the account and logs the user straight in.
// The email address is not checked (owner's decision, 2026-11-06): no confirmation email is sent.
app.post('/auth/register', registerRateLimit, async (req, res) => {
  const { name, email, password, role, acceptedPrivacy } = req.body ?? {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required.' });
  }

  if (!name.trim() || name.trim().length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8) {
    return res.status(400).json({ error: 'Enter a valid name and email, and a password of at least 8 characters.' });
  }

  if (!['LEARNER', 'ISSUER'].includes(role)) {
    return res.status(400).json({ error: 'Choose either Learner or Issuer.' });
  }

  if (acceptedPrivacy !== true) {
    return res.status(400).json({ error: 'Please read and accept the privacy notice to create an account.' });
  }

  if (await findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email address already exists. Try logging in or resetting your password.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const user: User = prisma
    ? mapDbUser(await prisma.user.create({
        // New issuers start unapproved: an admin must approve them before they can issue (owner's decision, for safety).
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: passwordHash,
          role,
          privacyAcceptedAt: now,
        },
      }))
    : {
        id: `user-${randomUUID()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role,
        createdAt: now.toISOString(),
        emailVerifiedAt: null,
        privacyAcceptedAt: now.toISOString(),
        issuerApprovedAt: null,
        issuerApprovedById: null,
      };
  if (!prisma) users.push(user);

  return res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/auth/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/me', authMiddleware, (req: any, res) => {
  res.json({ user: publicUser(req.user) });
});

// Issuing and revoking credentials needs an approved issuer account (approved by an admin in the app,
// or with npm run issuer:approve -- <email>).
function requireApprovedIssuer(req: any, res: any, next: any) {
  if (!req.user?.issuerApprovedAt) {
    return res.status(403).json({
      error: 'Your issuer account is waiting for approval. You can issue credentials once it has been approved.',
      code: 'ISSUER_NOT_APPROVED',
    });
  }
  next();
}

// ---------- Admin: issuer approval ----------
// Admin accounts can't be created through sign-up; an existing account is promoted with
// `npm run admin:grant -- <email>`.

async function listIssuers() {
  if (prisma) {
    const rows = await prisma.user.findMany({
      where: { role: 'ISSUER' },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { issuedCredentials: true } } },
    });
    return rows.map((row) => ({ ...mapDbUser(row), issuedCount: row._count.issuedCredentials }));
  }
  return users
    .filter((user) => user.role === 'ISSUER')
    .map((user) => ({ ...user, issuedCount: credentials.filter((c) => c.issuerId === user.id).length }));
}

async function setIssuerApproval(userId: string, approvedById: string | null) {
  const approvedAt = approvedById ? new Date() : null;
  if (prisma) {
    await prisma.user.update({ where: { id: userId }, data: { issuerApprovedAt: approvedAt, issuerApprovedById: approvedById } });
    return;
  }
  const user = users.find((candidate) => candidate.id === userId);
  if (user) {
    user.issuerApprovedAt = approvedAt?.toISOString() ?? null;
    user.issuerApprovedById = approvedById;
  }
}

async function deleteUser(userId: string) {
  if (prisma) {
    await prisma.user.delete({ where: { id: userId } });
    return;
  }
  users.splice(users.findIndex((user) => user.id === userId), 1);
}

async function findIssuerForAdmin(req: any, res: any) {
  const issuer = await findUserById(String(getRouteParam(req.params.id)));
  if (!issuer || issuer.role !== 'ISSUER') {
    res.status(404).json({ error: 'Issuer account not found.' });
    return undefined;
  }
  return issuer;
}

app.get('/admin/issuers', authMiddleware, requireRole('ADMIN'), async (_req, res) => {
  const issuers = await listIssuers();
  const approverNames = new Map<string, string>();
  for (const id of new Set(issuers.map((issuer) => issuer.issuerApprovedById).filter(Boolean) as string[])) {
    const approver = await findUserById(id);
    if (approver) approverNames.set(id, approver.name);
  }
  res.json({
    issuers: issuers.map((issuer) => ({
      id: issuer.id,
      name: issuer.name,
      email: issuer.email,
      signedUpAt: issuer.createdAt,
      approved: Boolean(issuer.issuerApprovedAt),
      approvedAt: issuer.issuerApprovedAt,
      approvedBy: issuer.issuerApprovedById ? approverNames.get(issuer.issuerApprovedById) ?? 'an admin' : issuer.issuerApprovedAt ? 'server command' : null,
      issuedCount: issuer.issuedCount,
    })),
  });
});

app.post('/admin/issuers/:id/approve', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
  const issuer = await findIssuerForAdmin(req, res);
  if (!issuer) return;
  if (!issuer.issuerApprovedAt) await setIssuerApproval(issuer.id, req.user.id);
  res.json({ message: `${issuer.name} can now issue credentials.` });
});

app.post('/admin/issuers/:id/withdraw', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
  const issuer = await findIssuerForAdmin(req, res);
  if (!issuer) return;
  await setIssuerApproval(issuer.id, null);
  res.json({ message: `${issuer.name} can no longer issue or revoke credentials. Credentials they already issued stay valid.` });
});

// Declining removes a pending issuer account. Only allowed before approval, when it cannot have issued anything.
app.delete('/admin/issuers/:id', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
  const issuer = await findIssuerForAdmin(req, res);
  if (!issuer) return;
  const issued = (await listCredentials({ issuerId: issuer.id })).length;
  if (issuer.issuerApprovedAt || issued > 0) {
    return res.status(409).json({ error: 'Only pending issuers who have not issued any credentials can be declined. Withdraw approval instead.' });
  }
  await deleteUser(issuer.id);
  res.status(204).end();
});

app.get('/learner/passport', authMiddleware, requireRole('LEARNER'), async (req: any, res) => {
  const learnerCredentials = (await listCredentials({ learnerId: req.user.id }))
    .map((credential) => withComputedCredentialStatus(credential));

  res.json({
    learner: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    },
    credentials: learnerCredentials,
    stats: {
      total: learnerCredentials.length,
      verified: learnerCredentials.filter((credential) => credential.status === 'ACTIVE').length,
    },
  });
});

app.get('/learner/credentials', authMiddleware, requireRole('LEARNER'), async (req: any, res) => {
  const learnerCredentials = (await listCredentials({ learnerId: req.user.id }))
    .map(withComputedCredentialStatus);

  res.json({ credentials: learnerCredentials });
});

app.get('/learner/credentials/:id', authMiddleware, requireRole('LEARNER'), async (req: any, res) => {
  const credential = await findCredential({ id: getRouteParam(req.params.id), learnerId: req.user.id });
  if (!credential) {
    return res.status(404).json({ error: 'Credential not found.' });
  }

  return res.json({ credential: withComputedCredentialStatus(credential) });
});

app.get('/issuer/credentials', authMiddleware, requireRole('ISSUER'), async (req: any, res) => {
  const issuerCredentials = (await listCredentials({ issuerId: req.user.id }))
    .map(withComputedCredentialStatus);

  res.json({ credentials: issuerCredentials });
});

app.post('/issuer/credentials', authMiddleware, requireRole('ISSUER'), requireApprovedIssuer, async (req: any, res) => {
  const { learnerId, learnerEmail, title, description, category, issueDate, expiryDate, skills, evidence } = req.body ?? {};

  if (typeof title !== 'string' || !title.trim()
    || typeof category !== 'string' || !category.trim()
    || typeof issueDate !== 'string'
    || Number.isNaN(Date.parse(issueDate))
    || (expiryDate !== undefined && expiryDate !== null && (typeof expiryDate !== 'string' || Number.isNaN(Date.parse(expiryDate))))
    || (skills !== undefined && (!Array.isArray(skills) || skills.some((skill: unknown) => typeof skill !== 'string')))
    || (evidence !== undefined && evidence !== null && typeof evidence !== 'string')) {
    return res.status(400).json({ error: 'Title, category and issueDate are required.' });
  }

  const learner = learnerId
    ? await findUserById(learnerId)
    : learnerEmail
      ? await findUserByEmail(learnerEmail)
      : undefined;

  if (!learner || learner.role !== 'LEARNER') {
    return res.status(400).json({ error: 'No learner account was found for that email address. Check the spelling, or ask the learner to sign up first.' });
  }

  // Stop accidental duplicates (e.g. pressing "Issue" twice): the same issuer can't give the same learner
  // the same, still-valid qualification twice for the same issue date.
  const sameDay = new Date(issueDate).toISOString().slice(0, 10);
  const duplicate = (await listCredentials({ issuerId: req.user.id })).find((existing) =>
    existing.learnerId === learner.id
    && existing.title.trim().toLowerCase() === title.trim().toLowerCase()
    && new Date(existing.issueDate).toISOString().slice(0, 10) === sameDay
    && withComputedCredentialStatus(existing).status !== 'REVOKED');
  if (duplicate) {
    return res.status(409).json({
      error: `${learner.name} already has "${duplicate.title}" from you, issued on ${sameDay}. Check the Issued list instead of issuing it again.`,
      code: 'DUPLICATE_CREDENTIAL',
    });
  }

  const newCredential = await createCredential({
    learnerId: learner.id,
    issuerId: req.user.id,
    title: title.trim(),
    description: typeof description === 'string' ? description : '',
    category: category.trim(),
    issueDate: new Date(issueDate),
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    skills: Array.isArray(skills) ? skills : [],
    evidence: typeof evidence === 'string' ? evidence : null,
  });

  return res.status(201).json({ credential: withComputedCredentialStatus(newCredential) });
});

app.patch('/issuer/credentials/:id/revoke', authMiddleware, requireRole('ISSUER'), requireApprovedIssuer, async (req: any, res) => {
  const credential = await findCredential({ id: getRouteParam(req.params.id), issuerId: req.user.id });
  if (!credential) {
    return res.status(404).json({ error: 'Credential not found or not owned by your organisation.' });
  }

  const revokedCredential = await revokeCredential(credential);
  return res.json({ credential: withComputedCredentialStatus(revokedCredential) });
});

// Runs after authMiddleware, so the limit applies per learner rather than per network.
const shareLinkCreationLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req: any) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_SHARE_DAYS = 365;
const DEFAULT_SHARE_DAYS = 30;

app.post('/learner/credentials/:id/share-links', authMiddleware, requireRole('LEARNER'), shareLinkCreationLimit, async (req: any, res) => {
  const credential = await findCredential({ id: getRouteParam(req.params.id), learnerId: req.user.id });
  if (!credential) {
    return res.status(404).json({ error: 'Credential not found.' });
  }

  const expiresInDays = req.body?.expiresInDays ?? DEFAULT_SHARE_DAYS;
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > MAX_SHARE_DAYS) {
    return res.status(400).json({ error: `expiresInDays must be a whole number from 1 to ${MAX_SHARE_DAYS}.` });
  }

  if (computeCredentialStatus(credential) !== 'ACTIVE') {
    return res.status(409).json({ error: 'Only active credentials can be shared.' });
  }

  // The raw token is returned once and never stored; only its hash is saved.
  const token = createShareToken();
  const link = await createShareLink({
    credentialId: credential.id,
    createdByUserId: req.user.id,
    tokenHash: hashShareToken(token),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
  });

  return res.status(201).json({
    shareLink: toPublicShareLink(link),
    shareUrl: `${publicBaseUrl()}/verify/${token}`,
  });
});

app.get('/learner/credentials/:id/share-links', authMiddleware, requireRole('LEARNER'), async (req: any, res) => {
  const credential = await findCredential({ id: getRouteParam(req.params.id), learnerId: req.user.id });
  if (!credential) {
    return res.status(404).json({ error: 'Credential not found.' });
  }

  const links = await listShareLinks(credential.id, req.user.id);
  return res.json({ shareLinks: links.map(toPublicShareLink) });
});

app.delete('/learner/share-links/:id', authMiddleware, requireRole('LEARNER'), async (req: any, res) => {
  const link = await findShareLink({ id: getRouteParam(req.params.id) });
  if (!link || link.createdByUserId !== req.user.id) {
    return res.status(404).json({ error: 'Share link not found.' });
  }

  const revoked = await revokeShareLink(link);
  return res.json({ shareLink: toPublicShareLink(revoked) });
});

const verificationRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Share tokens travel in the URL, so stop them leaking through caches or Referer headers.
function setVerificationHeaders(res: express.Response) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function publicStatusLabel(result: VerificationResult) {
  switch (result) {
    case 'VERIFIED':
      return 'Credential Verified';
    case 'EXPIRED':
      return 'Credential Expired';
    case 'REVOKED':
      return 'Credential Revoked';
    case 'PENDING':
      return 'Pending';
    case 'LINK_EXPIRED':
      return 'Link Expired';
    case 'LINK_REVOKED':
      return 'Link Turned Off';
    case 'INVALID':
      return 'Verification Failed';
    default:
      return 'Not Found';
  }
}

function renderVerificationPage(response: ReturnType<typeof makePublicVerificationResponse>) {
  const result = response.status;
  const statusLabel = publicStatusLabel(result);
  const palette = result === 'VERIFIED'
    ? { background: '#e5f4e9', color: '#1d7040' }
    : result === 'REVOKED' || result === 'INVALID' || result === 'NOT_FOUND'
      ? { background: '#fbe9e7', color: '#9a352c' }
      : result === 'PENDING'
        ? { background: '#e8eefb', color: '#385a96' }
        : { background: '#fff3df', color: '#9a5c15' };
  const field = (label: string, value: string) =>
    `<div class="field"><span class="label">${label}</span><span class="value">${value}</span></div>`;

  let details = '';
  if (response.credential) {
    const { credential } = response;
    const skills = credential.skills.map((skill) => `<span class="skill">${escapeHtml(skill)}</span>`).join('');
    details = [
      field('Learner', escapeHtml(response.learner?.name ?? 'Unknown learner')),
      field('Qualification', escapeHtml(credential.title)),
      field('Issued by', escapeHtml(credential.issuer)),
      field('Issue date', escapeHtml(new Date(credential.issueDate).toLocaleDateString('en-ZA'))),
      field('Expiry date', credential.expiryDate ? escapeHtml(new Date(credential.expiryDate).toLocaleDateString('en-ZA')) : 'No expiry'),
      field('Public reference', escapeHtml(credential.publicId)),
      `<div class="field"><span class="label">Skills</span><div class="skills">${skills}</div></div>`,
      response.linkExpiresAt ? field('This link expires', escapeHtml(new Date(response.linkExpiresAt).toLocaleDateString('en-ZA'))) : '',
    ].join('');
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><meta name="theme-color" content="#f3f7f3"><title>${statusLabel} · AgriSkills Passport</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f3f7f3;color:#173424;font-family:Arial,sans-serif}.card{max-width:660px;margin:5vh auto;background:#fff;border:1px solid #e1e9e2;border-radius:20px;padding:30px;box-shadow:0 12px 30px rgba(23,52,36,.07)}.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#34754b}.badge{display:inline-block;margin-top:24px;padding:8px 12px;border-radius:999px;background:${palette.background};color:${palette.color};font-size:12px;font-weight:700}h1{font-size:28px;line-height:1.2;margin:14px 0 10px}.message{color:#4c6253;line-height:1.6;margin:0 0 18px}.field{border-top:1px solid #edf1ed;padding:13px 0}.label{display:block;color:#718076;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px}.value{color:#243b2c;font-size:15px;line-height:1.5}.skills{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.skill{background:#edf5ef;border-radius:999px;color:#315b3d;padding:7px 10px;font-size:12px}.note{border-top:1px solid #edf1ed;color:#758078;font-size:12px;line-height:1.5;margin-top:20px;padding-top:16px}@media(max-width:520px){body{padding:14px}.card{padding:22px;margin:3vh auto}h1{font-size:24px}}</style></head><body><main class="card"><div class="brand">AgriSkills Passport</div><div class="badge">${statusLabel}</div><h1>${statusLabel}</h1><p class="message">${escapeHtml(response.message)}</p>${details}<p class="note">Checked just now against the issuer's records and an HMAC-SHA256 integrity signature. This is a simplified project scheme, not a W3C Verifiable Credential or Open Badge.</p></main></body></html>`;
}

app.get('/verify/:token', verificationRateLimit, async (req, res) => {
  setVerificationHeaders(res);
  const response = makePublicVerificationResponse(await verifyShareToken(getRouteParam(req.params.token)));
  const httpStatus = response.status === 'NOT_FOUND' ? 404 : response.status.startsWith('LINK_') ? 410 : 200;
  return res.status(httpStatus).send(renderVerificationPage(response));
});

app.get('/api/verify/:token', verificationRateLimit, async (req, res) => {
  setVerificationHeaders(res);
  const response = makePublicVerificationResponse(await verifyShareToken(getRouteParam(req.params.token)));
  const httpStatus = response.status === 'NOT_FOUND' ? 404 : response.status.startsWith('LINK_') ? 410 : 200;
  return res.status(httpStatus).json(response);
});

app.use(createEvidenceRouter({
  prisma,
  authMiddleware,
  requireRole,
  requireApprovedIssuer,
  // Learners choose one of these training providers to review their skills evidence.
  listApprovedIssuers: async () =>
    (await listIssuers())
      .filter((issuer) => issuer.issuerApprovedAt)
      .map((issuer) => ({ id: issuer.id, name: issuer.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  findPerson: async (id) => {
    const user = await findUserById(id);
    return user && { id: user.id, name: user.name, role: user.role, approved: Boolean(user.issuerApprovedAt) };
  },
  urlSigningSecret: jwtSecret,
}));

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if ((error as { type?: string } | null)?.type === 'entity.too.large') {
    res.status(413).json({ error: 'The request is too large. Photos must be smaller than 5 MB.' });
    return;
  }
  console.error('Request failed:', error);
  if (isDatabaseUnavailable(error)) {
    res.status(503).json({ error: 'The database is temporarily unavailable. Please try again in a few seconds.' });
    return;
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

function isDatabaseUnavailable(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  const code = (error as { code?: string; errorCode?: string } | null)?.code
    ?? (error as { errorCode?: string } | null)?.errorCode;
  return code === 'P1001' || code === 'P1002' || code === 'P1017' || code === 'P2024';
}

// Neon computes suspend when idle and can take several seconds to wake up,
// so retry the initial connection instead of exiting on the first failure.
// About 45 seconds in total, which also covers short Wi-Fi drop-outs.
export async function connectDatabase(attempts = 10, delayMs = 5000) {
  if (!prisma) return;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      if (attempt >= attempts || !isDatabaseUnavailable(error)) throw error;
      console.warn(`Database not reachable (attempt ${attempt}/${attempts}); retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
}

/** Automated-test helpers; they only touch the in-memory store (no DATABASE_URL). */
export const testing = {
  approveIssuer(email: string) {
    if (prisma) throw new Error('testing.approveIssuer is only for the in-memory test store.');
    const user = users.find((candidate) => candidate.email === email.toLowerCase());
    if (user) user.issuerApprovedAt = new Date().toISOString();
  },
  makeAdmin(email: string) {
    if (prisma) throw new Error('testing.makeAdmin is only for the in-memory test store.');
    const user = users.find((candidate) => candidate.email === email.toLowerCase());
    if (user) user.role = 'ADMIN';
  },
};

export { app };
