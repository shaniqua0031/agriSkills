import assert from 'node:assert/strict';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// In-memory store + local photo storage (no Cloudinary keys, not production).
process.env.DATABASE_URL = '';
// Never send real emails from tests: codes are captured in memory instead.
process.env.SMTP_USER = '';
process.env.RESEND_API_KEY = '';
process.env.CLOUDINARY_CLOUD_NAME = '';
const { app } = await import('./app.js');
const { registerVerified } = await import('./test-support.js');

// 1x1 transparent PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('RPL evidence: create, photo, ownership and deletion', async (t) => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const createdUserDirs: string[] = [];

  const headers = (token?: string) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const register = async (prefix: string, role: 'LEARNER' | 'ISSUER') => {
    const session = await registerVerified(baseUrl, prefix, role);
    createdUserDirs.push(session.user.id);
    return session.token;
  };
  const post = (url: string, token: string, body: object) =>
    fetch(`${baseUrl}${url}`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  const uploadPhoto = async (token: string) => {
    const grant = (await (await post('/learner/evidence/upload', token, { contentType: 'image/png' })).json()) as {
      provider: string; photoKey: string; uploadUrl: string;
    };
    assert.equal(grant.provider, 'local');
    const upload = await post(grant.uploadUrl, token, { photoKey: grant.photoKey, dataUri: PNG });
    assert.equal(upload.status, 201);
    return grant.photoKey;
  };

  try {
    const learner = await register('rpl-learner', 'LEARNER');
    const otherLearner = await register('rpl-other', 'LEARNER');
    const issuer = await register('rpl-issuer', 'ISSUER');

    await t.test('only learners can use evidence endpoints', async () => {
      assert.equal((await fetch(`${baseUrl}/learner/evidence`)).status, 401);
      assert.equal((await fetch(`${baseUrl}/learner/evidence`, { headers: headers(issuer) })).status, 403);
    });

    await t.test('validates required fields and location consent', async () => {
      assert.equal((await post('/learner/evidence', learner, { skill: '', note: 'x' })).status, 400);
      const noConsent = await post('/learner/evidence', learner, {
        skill: 'Pruning', note: 'Pruned an orchard', location: { latitude: -26.2, longitude: 28.0, capturedAt: new Date().toISOString() },
      });
      assert.equal(noConsent.status, 400);
      const badLocation = await post('/learner/evidence', learner, {
        skill: 'Pruning', note: 'Pruned an orchard', locationConsent: true, location: { latitude: 200, longitude: 28, capturedAt: new Date().toISOString() },
      });
      assert.equal(badLocation.status, 400);
    });

    let evidenceId = '';
    let photoUrl = '';
    await t.test('saves evidence with photo, consented location and supervisor contact', async () => {
      const photoKey = await uploadPhoto(learner);
      const response = await post('/learner/evidence', learner, {
        skill: 'Drip irrigation installation',
        note: 'Installed drip lines on 2 ha of tomatoes.',
        photoKey,
        locationConsent: true,
        location: { latitude: -25.75, longitude: 28.19, capturedAt: '2026-11-01T08:00:00.000Z' },
        supervisorName: 'Fictional Supervisor',
        supervisorContact: '000 000 0000',
      });
      assert.equal(response.status, 201);
      const { evidence } = (await response.json()) as { evidence: Record<string, any> };
      assert.equal(evidence.supervisorName, 'Fictional Supervisor');
      assert.equal(evidence.attestationStatus, undefined, 'there is no supervisor confirmation step');
      assert.equal(evidence.reviewStatus, 'SUBMITTED');
      assert.equal(evidence.locationConsent, true);
      assert.equal(evidence.hasPhoto, true);
      assert.equal(evidence.photoKey, undefined, 'storage key is never returned');
      evidenceId = evidence.id;
      photoUrl = evidence.photoUrl;
      assert.match(photoUrl, /^\/evidence-photos\/.+\?expires=\d+&sig=/);
    });

    await t.test('photo link works only with a valid signature', async () => {
      const ok = await fetch(`${baseUrl}${photoUrl}`);
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get('cache-control'), 'private, no-store');
      assert.equal((await fetch(`${baseUrl}${photoUrl.replace(/sig=.*/, 'sig=forged')}`)).status, 404);
      assert.equal((await fetch(`${baseUrl}${photoUrl.split('?')[0]}`)).status, 404);
    });

    await t.test("learners can't see or use another learner's evidence or photos", async () => {
      assert.equal((await fetch(`${baseUrl}/learner/evidence/${evidenceId}`, { headers: headers(otherLearner) })).status, 404);
      const list = (await (await fetch(`${baseUrl}/learner/evidence`, { headers: headers(otherLearner) })).json()) as { evidence: unknown[] };
      assert.equal(list.evidence.length, 0);
      const stolenKey = await uploadPhoto(learner);
      assert.equal((await post('/learner/evidence', otherLearner, { skill: 'x', note: 'y', photoKey: stolenKey })).status, 400);
    });

    await t.test('a photo key that was never uploaded is rejected', async () => {
      const grant = (await (await post('/learner/evidence/upload', learner, { contentType: 'image/jpeg' })).json()) as { photoKey: string };
      assert.equal((await post('/learner/evidence', learner, { skill: 'x', note: 'y', photoKey: grant.photoKey })).status, 400);
    });

    await t.test('learner chooses an approved issuer; only that issuer can review it', async () => {
      const reviewer = await registerVerified(baseUrl, 'rpl-reviewer', 'ISSUER', { approve: true });
      const otherReviewer = await registerVerified(baseUrl, 'rpl-reviewer2', 'ISSUER', { approve: true });
      const unapproved = await registerVerified(baseUrl, 'rpl-unapproved', 'ISSUER');
      const get = (url: string, token: string) => fetch(`${baseUrl}${url}`, { headers: headers(token) });
      const patch = (url: string, token: string, body: object) =>
        fetch(`${baseUrl}${url}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify(body) });

      const { reviewers } = (await (await get('/learner/evidence-reviewers', learner)).json()) as { reviewers: Array<{ id: string }> };
      assert.ok(reviewers.some((r) => r.id === reviewer.user.id));
      assert.ok(!reviewers.some((r) => r.id === unapproved.user.id), 'unapproved issuers are not offered');

      // An unapproved issuer (or a learner) can't be chosen.
      assert.equal((await post('/learner/evidence', learner, { skill: 'Pruning', note: 'Pruned', reviewerId: unapproved.user.id })).status, 400);
      assert.equal((await post('/learner/evidence', learner, { skill: 'Pruning', note: 'Pruned', reviewerId: 'nobody' })).status, 400);

      const created = await post('/learner/evidence', learner, { skill: 'Pruning', note: 'Pruned 40 citrus trees.', reviewerId: reviewer.user.id });
      assert.equal(created.status, 201);
      const { evidence } = (await created.json()) as { evidence: Record<string, any> };
      assert.equal(evidence.reviewer.id, reviewer.user.id);

      // Only the chosen issuer sees it.
      const mine = (await (await get('/issuer/evidence', reviewer.token)).json()) as { evidence: Array<Record<string, any>> };
      assert.equal(mine.evidence.length, 1);
      assert.equal(mine.evidence[0].learner.name, 'Fictional rpl-learner');
      const theirs = (await (await get('/issuer/evidence', otherReviewer.token)).json()) as { evidence: unknown[] };
      assert.equal(theirs.evidence.length, 0);
      assert.equal((await get('/issuer/evidence', unapproved.token)).status, 403);
      assert.equal((await get('/issuer/evidence', learner)).status, 403);
      assert.equal((await post(`/issuer/evidence/${evidence.id}/review`, otherReviewer.token, { decision: 'APPROVED' })).status, 404);

      // Rejecting needs a reason; a decision is final.
      assert.equal((await post(`/issuer/evidence/${evidence.id}/review`, reviewer.token, { decision: 'REJECTED' })).status, 400);
      assert.equal((await post(`/issuer/evidence/${evidence.id}/review`, reviewer.token, { decision: 'MAYBE' })).status, 400);
      const approved = await post(`/issuer/evidence/${evidence.id}/review`, reviewer.token, { decision: 'APPROVED', note: 'Good work.' });
      assert.equal(approved.status, 200);
      assert.equal((await post(`/issuer/evidence/${evidence.id}/review`, reviewer.token, { decision: 'REJECTED', note: 'x' })).status, 409);

      const seen = (await (await get(`/learner/evidence/${evidence.id}`, learner)).json()) as { evidence: Record<string, any> };
      assert.equal(seen.evidence.reviewStatus, 'APPROVED');
      assert.equal(seen.evidence.reviewNote, 'Good work.');
      assert.ok(seen.evidence.reviewedAt);
      // Can't switch reviewer after a decision.
      assert.equal((await patch(`/learner/evidence/${evidence.id}/reviewer`, learner, { reviewerId: otherReviewer.user.id })).status, 409);

      // Choosing a reviewer later works while still waiting.
      const later = (await (await post('/learner/evidence', learner, { skill: 'Milking', note: 'Milked 30 cows daily.' })).json()) as { evidence: { id: string; reviewer: unknown } };
      assert.equal(later.evidence.reviewer, null);
      assert.equal((await patch(`/learner/evidence/${later.evidence.id}/reviewer`, otherLearner, { reviewerId: reviewer.user.id })).status, 404);
      assert.equal((await patch(`/learner/evidence/${later.evidence.id}/reviewer`, learner, { reviewerId: reviewer.user.id })).status, 200);
    });

    await t.test('deleting evidence removes the record and the photo', async () => {
      const response = await fetch(`${baseUrl}/learner/evidence/${evidenceId}`, { method: 'DELETE', headers: headers(learner) });
      assert.equal(response.status, 204);
      assert.equal((await fetch(`${baseUrl}/learner/evidence/${evidenceId}`, { headers: headers(learner) })).status, 404);
      assert.equal((await fetch(`${baseUrl}${photoUrl}`)).status, 404);
    });
  } finally {
    server.close();
    await once(server, 'close');
    const uploads = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
    await Promise.all(createdUserDirs.map((id) => rm(path.join(uploads, id), { recursive: true, force: true })));
  }
});
