// RPL (recognition of prior learning) evidence: a learner's note, optional photo,
// optional location stamp and optional supervisor details for a skill they already have.
//
// Photo storage, chosen at request time from the environment:
// - "cloudinary": CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET set. Photos are uploaded straight from the
//   app to Cloudinary as private ("authenticated") assets using a server-signed upload.
// - "local": development only (NODE_ENV !== 'production') and no Cloudinary keys. Photos are saved in
//   Server/uploads/ on this machine. Not suitable for Render, whose disk is wiped on every deploy.
// - "disabled": production without Cloudinary keys. Evidence without a photo still works.
// Photos are only ever shown through short-lived signed URLs, after an ownership check.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { v2 as cloudinary } from 'cloudinary';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient, RplEvidence as DbRplEvidence } from '@prisma/client';

export type StorageMode = 'cloudinary' | 'local' | 'disabled';

type AttestationStatus = 'NOT_REQUESTED' | 'PENDING' | 'CONFIRMED';
type ReviewStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type RplEvidence = {
  id: string;
  learnerId: string;
  skill: string;
  note: string;
  photoKey: string | null;
  locationConsent: boolean;
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationCapturedAt: string | null;
  supervisorName: string | null;
  supervisorContact: string | null;
  // Legacy column from the removed supervisor-confirmation step; always NOT_REQUESTED now and never returned.
  attestationStatus: AttestationStatus;
  reviewStatus: ReviewStatus;
  // The approved issuer the learner asked to review this evidence, and their decision.
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Person = { id: string; name: string };

type Deps = {
  prisma: PrismaClient | null;
  authMiddleware: express.RequestHandler;
  requireRole: (...roles: Array<'LEARNER' | 'ISSUER' | 'EMPLOYER'>) => express.RequestHandler;
  requireApprovedIssuer: express.RequestHandler;
  /** Approved issuer accounts a learner may ask to review evidence. */
  listApprovedIssuers: () => Promise<Person[]>;
  findPerson: (id: string) => Promise<(Person & { role: string; approved: boolean }) | undefined>;
  urlSigningSecret: string;
};

const PHOTO_URL_TTL_SECONDS = 10 * 60;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const UPLOADS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
const ID = '[A-Za-z0-9_-]{1,64}';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LOCAL_KEY = new RegExp(`^local:(${ID})/(${UUID})\\.(jpg|png|webp)$`);
const CLOUDINARY_KEY = new RegExp(`^cloudinary:agriskills/rpl/(${ID})/(${UUID})$`);

export function getStorageMode(): StorageMode {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) return 'cloudinary';
  return process.env.NODE_ENV === 'production' ? 'disabled' : 'local';
}

function cloudinaryConfig() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  };
}

/** Returns the owner's user ID if the key is a well-formed storage key, otherwise null. */
function photoKeyOwner(photoKey: string) {
  return LOCAL_KEY.exec(photoKey)?.[1] ?? CLOUDINARY_KEY.exec(photoKey)?.[1] ?? null;
}

function signLocalPath(urlPath: string, expires: number, secret: string) {
  return createHmac('sha256', secret).update(`${urlPath}|${expires}`).digest('base64url');
}

async function photoExists(photoKey: string) {
  const local = LOCAL_KEY.exec(photoKey);
  if (local) {
    return stat(path.join(UPLOADS_DIR, local[1], `${local[2]}.${local[3]}`)).then(() => true, () => false);
  }
  const publicId = CLOUDINARY_KEY.test(photoKey) ? photoKey.slice('cloudinary:'.length) : null;
  if (!publicId || getStorageMode() !== 'cloudinary') return false;
  try {
    await cloudinary.api.resource(publicId, { type: 'authenticated', ...cloudinaryConfig() });
    return true;
  } catch {
    return false;
  }
}

function photoUrl(photoKey: string | null, secret: string) {
  if (!photoKey) return null;
  const expires = Math.floor(Date.now() / 1000) + PHOTO_URL_TTL_SECONDS;
  const local = LOCAL_KEY.exec(photoKey);
  if (local) {
    // Relative to the API base URL; the app prefixes it.
    const urlPath = `/evidence-photos/${local[1]}/${local[2]}.${local[3]}`;
    return `${urlPath}?expires=${expires}&sig=${signLocalPath(urlPath, expires, secret)}`;
  }
  if (CLOUDINARY_KEY.test(photoKey) && getStorageMode() === 'cloudinary') {
    return cloudinary.utils.private_download_url(photoKey.slice('cloudinary:'.length), 'jpg', {
      type: 'authenticated',
      resource_type: 'image',
      expires_at: expires,
      ...cloudinaryConfig(),
    });
  }
  return null;
}

async function deletePhoto(photoKey: string) {
  const local = LOCAL_KEY.exec(photoKey);
  if (local) {
    await rm(path.join(UPLOADS_DIR, local[1], `${local[2]}.${local[3]}`), { force: true });
  } else if (CLOUDINARY_KEY.test(photoKey) && getStorageMode() === 'cloudinary') {
    await cloudinary.uploader.destroy(photoKey.slice('cloudinary:'.length), {
      type: 'authenticated',
      invalidate: true,
      ...cloudinaryConfig(),
    });
  }
}

// ---------- persistence (Postgres, or in-memory for automated tests) ----------

const memoryEvidence: RplEvidence[] = [];

function mapDb(row: DbRplEvidence): RplEvidence {
  return {
    ...row,
    locationCapturedAt: row.locationCapturedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? null : new Date(value));

type NewEvidence = Omit<RplEvidence, 'id' | 'reviewStatus' | 'reviewNote' | 'reviewedAt' | 'createdAt' | 'updatedAt'>;
type EvidenceChanges = Partial<Pick<RplEvidence, 'reviewerId' | 'reviewStatus' | 'reviewNote' | 'reviewedAt'>>;

function makeRepository(prisma: PrismaClient | null) {
  return {
    async create(data: NewEvidence) {
      if (prisma) {
        return mapDb(await prisma.rplEvidence.create({
          data: { ...data, locationCapturedAt: data.locationCapturedAt ? new Date(data.locationCapturedAt) : null },
        }));
      }
      const now = new Date().toISOString();
      const row: RplEvidence = {
        ...data,
        id: `rpl-${randomUUID()}`,
        reviewStatus: 'SUBMITTED',
        reviewNote: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      memoryEvidence.push(row);
      return row;
    },
    async update(id: string, changes: EvidenceChanges) {
      if (prisma) {
        return mapDb(await prisma.rplEvidence.update({
          where: { id },
          data: { ...changes, reviewedAt: toDate(changes.reviewedAt) },
        }));
      }
      const row = memoryEvidence.find((candidate) => candidate.id === id)!;
      Object.assign(row, changes, { updatedAt: new Date().toISOString() });
      return row;
    },
    async listForReviewer(reviewerId: string) {
      if (prisma) {
        return (await prisma.rplEvidence.findMany({ where: { reviewerId }, orderBy: { createdAt: 'desc' } })).map(mapDb);
      }
      return memoryEvidence.filter((row) => row.reviewerId === reviewerId).reverse();
    },
    async findForReviewer(id: string, reviewerId: string) {
      if (prisma) {
        const row = await prisma.rplEvidence.findFirst({ where: { id, reviewerId } });
        return row ? mapDb(row) : undefined;
      }
      return memoryEvidence.find((row) => row.id === id && row.reviewerId === reviewerId);
    },
    async list(learnerId: string) {
      if (prisma) {
        return (await prisma.rplEvidence.findMany({ where: { learnerId }, orderBy: { createdAt: 'desc' } })).map(mapDb);
      }
      return memoryEvidence.filter((row) => row.learnerId === learnerId).reverse();
    },
    async find(id: string, learnerId: string) {
      if (prisma) {
        const row = await prisma.rplEvidence.findFirst({ where: { id, learnerId } });
        return row ? mapDb(row) : undefined;
      }
      return memoryEvidence.find((row) => row.id === id && row.learnerId === learnerId);
    },
    async remove(id: string) {
      if (prisma) {
        await prisma.rplEvidence.delete({ where: { id } });
        return;
      }
      memoryEvidence.splice(memoryEvidence.findIndex((row) => row.id === id), 1);
    },
  };
}

// ---------- validation ----------

function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null) return { ok: true as const, value: null };
  if (typeof value !== 'string' || value.trim().length > max) return { ok: false as const };
  return { ok: true as const, value: value.trim() || null };
}

function parseEvidence(body: any, learnerId: string): { error: string } | { data: Omit<NewEvidence, 'photoKey'> & { photoKey: string | null } } {
  const skill = typeof body?.skill === 'string' ? body.skill.trim() : '';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (!skill || skill.length > 120) return { error: 'Enter the skill this evidence is for (up to 120 characters).' };
  if (!note || note.length > 2000) return { error: 'Describe the evidence in the note (up to 2000 characters).' };

  const supervisorName = optionalText(body.supervisorName, 120);
  const supervisorContact = optionalText(body.supervisorContact, 120);
  if (!supervisorName.ok || !supervisorContact.ok) return { error: 'Supervisor details must be up to 120 characters each.' };
  if (supervisorContact.value && !supervisorName.value) return { error: "Add the supervisor's name as well as their contact details." };

  const photoKey = body.photoKey ?? null;
  if (photoKey !== null && (typeof photoKey !== 'string' || photoKeyOwner(photoKey) !== learnerId)) {
    return { error: 'The photo reference is not valid.' };
  }

  // Checked against the approved issuers in the route.
  const reviewerId = body.reviewerId ?? null;
  if (reviewerId !== null && (typeof reviewerId !== 'string' || !reviewerId || reviewerId.length > 64)) {
    return { error: 'Choose a reviewer from the list.' };
  }

  // Location is only accepted together with explicit consent.
  const consent = body.locationConsent === true;
  let location = { locationLatitude: null as number | null, locationLongitude: null as number | null, locationCapturedAt: null as string | null };
  if (body.location !== undefined && body.location !== null) {
    const { latitude, longitude, capturedAt } = body.location ?? {};
    if (!consent) return { error: 'A location can only be saved if you agree to add it.' };
    if (typeof latitude !== 'number' || typeof longitude !== 'number'
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
      || typeof capturedAt !== 'string' || Number.isNaN(Date.parse(capturedAt))) {
      return { error: 'The location stamp is not valid.' };
    }
    location = { locationLatitude: latitude, locationLongitude: longitude, locationCapturedAt: new Date(capturedAt).toISOString() };
  }

  return {
    data: {
      learnerId,
      skill,
      note,
      photoKey,
      locationConsent: consent && location.locationLatitude !== null,
      ...location,
      supervisorName: supervisorName.value,
      supervisorContact: supervisorContact.value,
      // The supervisor is only a contact the reviewing issuer may use; the issuer alone approves evidence.
      attestationStatus: 'NOT_REQUESTED',
      reviewerId,
    },
  };
}

// ---------- routes ----------

export function createEvidenceRouter({
  prisma,
  authMiddleware,
  requireRole,
  requireApprovedIssuer,
  listApprovedIssuers,
  findPerson,
  urlSigningSecret,
}: Deps) {
  const router = express.Router();
  const repo = makeRepository(prisma);
  const learnerOnly = [authMiddleware, requireRole('LEARNER')];
  const reviewerOnly = [authMiddleware, requireRole('ISSUER'), requireApprovedIssuer];
  const uploadLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many uploads. Please wait a few minutes and try again.' },
  });

  const personName = async (id: string | null, cache = new Map<string, string>()) => {
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, (await findPerson(id))?.name ?? 'Unknown');
    return cache.get(id)!;
  };

  // What the learner sees. Storage keys are never returned.
  const toResponse = async (row: RplEvidence, withPhotoUrl: boolean, cache?: Map<string, string>) => {
    const { photoKey, learnerId: _learnerId, attestationStatus: _legacy, ...rest } = row;
    const reviewerName = await personName(row.reviewerId, cache);
    return {
      ...rest,
      reviewer: row.reviewerId ? { id: row.reviewerId, name: reviewerName } : null,
      hasPhoto: Boolean(photoKey),
      ...(withPhotoUrl ? { photoUrl: photoUrl(photoKey, urlSigningSecret) } : {}),
    };
  };

  // What the reviewing issuer sees: the evidence plus the learner's name.
  const toReviewerResponse = async (row: RplEvidence, cache?: Map<string, string>) => {
    const { photoKey, attestationStatus: _legacy, learnerId, ...rest } = row;
    return {
      ...rest,
      learner: { id: learnerId, name: await personName(learnerId, cache) },
      hasPhoto: Boolean(photoKey),
      photoUrl: photoUrl(photoKey, urlSigningSecret),
    };
  };

  /** Returns an error message if the ID isn't an approved issuer's. */
  const checkReviewer = async (reviewerId: string) => {
    const person = await findPerson(reviewerId);
    return person?.role === 'ISSUER' && person.approved ? null : 'Choose an approved training provider to review your evidence.';
  };

  router.get('/learner/evidence/storage', ...learnerOnly, (_req, res) => {
    res.json({ storage: getStorageMode() });
  });

  // Step 1 of a photo upload: the server picks the storage key and grants permission to upload it.
  router.post('/learner/evidence/upload', ...learnerOnly, uploadLimit, (req: any, res) => {
    const extension = IMAGE_TYPES[req.body?.contentType];
    if (!extension) return res.status(400).json({ error: 'Photos must be JPEG, PNG or WebP images.' });

    const mode = getStorageMode();
    const id = randomUUID();
    if (mode === 'cloudinary') {
      const config = cloudinaryConfig();
      const params = {
        public_id: `agriskills/rpl/${req.user.id}/${id}`,
        type: 'authenticated',
        format: 'jpg',
        allowed_formats: 'jpg,jpeg,png,webp',
        timestamp: Math.floor(Date.now() / 1000),
      };
      return res.json({
        provider: 'cloudinary',
        photoKey: `cloudinary:${params.public_id}`,
        uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloud_name)}/image/upload`,
        fields: { ...params, api_key: config.api_key, signature: cloudinary.utils.api_sign_request(params, config.api_secret) },
      });
    }
    if (mode === 'local') {
      return res.json({ provider: 'local', photoKey: `local:${req.user.id}/${id}.${extension}`, uploadUrl: '/learner/evidence/local-upload' });
    }
    return res.status(503).json({ error: 'Photo storage is not set up on this server yet. You can still save evidence without a photo.' });
  });

  // Development-only upload target used when Cloudinary is not configured.
  router.post('/learner/evidence/local-upload', ...learnerOnly, uploadLimit, express.json({ limit: '8mb' }), async (req: any, res) => {
    if (getStorageMode() !== 'local') return res.status(404).json({ error: 'Not found.' });
    const match = typeof req.body?.photoKey === 'string' ? LOCAL_KEY.exec(req.body.photoKey) : null;
    if (!match || match[1] !== req.user.id) return res.status(400).json({ error: 'The photo reference is not valid.' });

    const dataUri = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUri ?? ''));
    if (!dataUri || IMAGE_TYPES[dataUri[1]] !== match[3]) return res.status(400).json({ error: 'Photos must be JPEG, PNG or WebP images.' });
    const bytes = Buffer.from(dataUri[2], 'base64');
    if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'Photos must be smaller than 5 MB.' });

    await mkdir(path.join(UPLOADS_DIR, match[1]), { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, match[1], `${match[2]}.${match[3]}`), bytes, { flag: 'wx' });
    return res.status(201).json({ photoKey: req.body.photoKey });
  });

  // Signed, short-lived links for locally stored photos (images can't send an Authorization header).
  router.get(new RegExp(`^/evidence-photos/(${ID})/(${UUID})\\.(jpg|png|webp)$`), async (req, res) => {
    const expires = Number(req.query.expires);
    const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
    const expected = Buffer.from(signLocalPath(req.path, expires, urlSigningSecret));
    const valid = Number.isInteger(expires) && expires > Date.now() / 1000
      && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), expected);
    if (!valid || getStorageMode() !== 'local') return res.status(404).json({ error: 'Not found.' });

    const [, owner, file, extension] = /^\/evidence-photos\/([^/]+)\/([^.]+)\.(\w+)$/.exec(req.path)!;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(path.join(UPLOADS_DIR, owner, `${file}.${extension}`), (error) => {
      if (error && !res.headersSent) res.status(404).json({ error: 'Not found.' });
    });
  });

  // Approved training providers a learner can ask to review their evidence.
  router.get('/learner/evidence-reviewers', ...learnerOnly, async (_req, res) => {
    res.json({ reviewers: await listApprovedIssuers() });
  });

  router.post('/learner/evidence', ...learnerOnly, async (req: any, res) => {
    const parsed = parseEvidence(req.body, req.user.id);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    if (parsed.data.reviewerId) {
      const reviewerError = await checkReviewer(parsed.data.reviewerId);
      if (reviewerError) return res.status(400).json({ error: reviewerError });
    }
    if (parsed.data.photoKey && !(await photoExists(parsed.data.photoKey))) {
      return res.status(400).json({ error: 'The photo upload was not found. Please add the photo again.' });
    }
    const evidence = await repo.create(parsed.data);
    return res.status(201).json({ evidence: await toResponse(evidence, true) });
  });

  router.get('/learner/evidence', ...learnerOnly, async (req: any, res) => {
    const rows = await repo.list(req.user.id);
    const cache = new Map<string, string>();
    return res.json({ evidence: await Promise.all(rows.map((row) => toResponse(row, false, cache))) });
  });

  router.get('/learner/evidence/:id', ...learnerOnly, async (req: any, res) => {
    const evidence = await repo.find(String(req.params.id), req.user.id);
    if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
    return res.json({ evidence: await toResponse(evidence, true) });
  });

  // Choose (or change) who reviews the evidence. Only while it is still waiting for a decision.
  router.patch('/learner/evidence/:id/reviewer', ...learnerOnly, async (req: any, res) => {
    const evidence = await repo.find(String(req.params.id), req.user.id);
    if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
    if (evidence.reviewStatus !== 'SUBMITTED') {
      return res.status(409).json({ error: 'This evidence has already been reviewed.' });
    }
    const reviewerId = typeof req.body?.reviewerId === 'string' ? req.body.reviewerId : '';
    const reviewerError = await checkReviewer(reviewerId);
    if (reviewerError) return res.status(400).json({ error: reviewerError });
    const updated = await repo.update(evidence.id, { reviewerId });
    return res.json({ evidence: await toResponse(updated, true) });
  });

  // ---------- issuer: review evidence learners sent to them ----------

  router.get('/issuer/evidence', ...reviewerOnly, async (req: any, res) => {
    const rows = await repo.listForReviewer(req.user.id);
    const cache = new Map<string, string>();
    return res.json({ evidence: await Promise.all(rows.map((row) => toReviewerResponse(row, cache))) });
  });

  router.post('/issuer/evidence/:id/review', ...reviewerOnly, async (req: any, res) => {
    const evidence = await repo.findForReviewer(String(req.params.id), req.user.id);
    if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
    if (evidence.reviewStatus !== 'SUBMITTED') {
      return res.status(409).json({ error: 'You have already reviewed this evidence.' });
    }
    const decision = req.body?.decision;
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return res.status(400).json({ error: 'The decision must be APPROVED or REJECTED.' });
    }
    const note = optionalText(req.body?.note, 1000);
    if (!note.ok) return res.status(400).json({ error: 'The note must be up to 1000 characters.' });
    if (decision === 'REJECTED' && !note.value) {
      return res.status(400).json({ error: 'Tell the learner why the evidence was not approved.' });
    }
    const updated = await repo.update(evidence.id, { reviewStatus: decision, reviewNote: note.value, reviewedAt: new Date().toISOString() });
    return res.json({ evidence: await toReviewerResponse(updated) });
  });

  router.delete('/learner/evidence/:id', ...learnerOnly, async (req: any, res) => {
    const evidence = await repo.find(String(req.params.id), req.user.id);
    if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
    if (evidence.photoKey) await deletePhoto(evidence.photoKey);
    await repo.remove(evidence.id);
    return res.status(204).end();
  });

  return router;
}
