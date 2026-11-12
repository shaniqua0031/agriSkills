import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

process.env.DATABASE_URL = '';
process.env.SMTP_USER = '';
process.env.RESEND_API_KEY = '';
process.env.PUBLIC_BASE_URL = 'http://verify.test:3000';
const { app } = await import('./app.js');
const { registerVerified } = await import('./test-support.js');

type ProfileItem = { status: string; valid: boolean; credential: { title: string; publicId: string } | null };
type PublicProfile = {
  valid: boolean;
  status: string;
  title: string | null;
  learner: { name: string } | null;
  verifiedCount: number;
  credentials: ProfileItem[];
  linkExpiresAt: string | null;
};
type CreateResponse = {
  shareUrl: string;
  profileLink: { id: string; status: string; title: string | null; credentials: Array<{ id: string; title: string }> };
};

test('curated profile links share several credentials in one link', async (t) => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const call = (method: string, path: string, token: string, body?: object) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  const login = async (email: string) => {
    const response = await call('POST', '/auth/login', '', { email, password: 'Password123' });
    return ((await response.json()) as { token: string }).token;
  };
  const viewProfile = async (shareToken: string) => {
    const response = await fetch(`${baseUrl}/api/profile/${shareToken}`);
    return { httpStatus: response.status, body: (await response.json()) as PublicProfile };
  };

  try {
    const learnerToken = await login('sharone@example.com');
    const issuerToken = await login('issuer@example.com');
    let created: CreateResponse;
    let shareToken: string;

    await t.test('only the learner can create profile links for their own credentials', async () => {
      assert.equal((await call('POST', '/learner/profile-links', '', { credentialIds: ['cred-1'] })).status, 401);
      assert.equal((await call('POST', '/learner/profile-links', issuerToken, { credentialIds: ['cred-1'] })).status, 403);
      const otherLearner = await registerVerified(baseUrl, 'profile-other', 'LEARNER');
      assert.equal((await call('POST', '/learner/profile-links', otherLearner.token, { credentialIds: ['cred-1', 'cred-2'] })).status, 404);
    });

    await t.test('bad requests are rejected', async () => {
      const post = (body: object) => call('POST', '/learner/profile-links', learnerToken, body);
      assert.equal((await post({ credentialIds: [] })).status, 400);
      assert.equal((await post({ credentialIds: ['cred-1', 'cred-1'] })).status, 400);
      assert.equal((await post({ credentialIds: Array.from({ length: 21 }, (_, i) => `c-${i}`) })).status, 400);
      assert.equal((await post({ credentialIds: ['cred-1'], expiresInDays: 366 })).status, 400);
      assert.equal((await post({ credentialIds: ['cred-1'], title: 'x'.repeat(81) })).status, 400);
    });

    await t.test('creating a profile returns a one-time link with an unguessable token', async () => {
      const response = await call('POST', '/learner/profile-links', learnerToken, {
        credentialIds: ['cred-2', 'cred-1', 'cred-4'],
        title: '  Farm supervisor <b>application</b>  ',
        expiresInDays: 30,
      });
      assert.equal(response.status, 201);
      created = (await response.json()) as CreateResponse;
      assert.match(created.shareUrl, /^http:\/\/verify\.test:3000\/profile\/[A-Za-z0-9_-]{43}$/);
      shareToken = created.shareUrl.split('/profile/')[1];
      assert.doesNotMatch(created.shareUrl, /cred-|demo-/);
      assert.equal(created.profileLink.status, 'ACTIVE');
      assert.equal(created.profileLink.title, 'Farm supervisor <b>application</b>');
      assert.deepEqual(created.profileLink.credentials.map((c) => c.id), ['cred-2', 'cred-1', 'cred-4']);
    });

    await t.test('anyone can view the profile, in the order the learner chose', async () => {
      const { httpStatus, body } = await viewProfile(shareToken);
      assert.equal(httpStatus, 200);
      assert.equal(body.status, 'VERIFIED');
      assert.equal(body.valid, true);
      assert.equal(body.verifiedCount, 3);
      assert.equal(body.learner?.name, 'Sharone Mabunda');
      assert.deepEqual(body.credentials.map((item) => item.credential?.title), [
        'Crop Production Skills',
        'Agricultural Safety Certificate',
        'Irrigation Management',
      ]);
      const raw = JSON.stringify(body);
      assert.doesNotMatch(raw, /sharone@example\.com|learner-1|issuer-1|"cred-\d"/, 'no emails or internal ids');
    });

    await t.test('the HTML page shows every credential and escapes the title', async () => {
      const response = await fetch(`${baseUrl}/profile/${shareToken}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      const html = await response.text();
      assert.match(html, /Profile Verified/);
      assert.match(html, /Crop Production Skills/);
      assert.match(html, /Irrigation Management/);
      assert.match(html, /Farm supervisor &lt;b&gt;application&lt;\/b&gt;/);
      assert.doesNotMatch(html, /<b>application<\/b>/);
    });

    await t.test('a revoked credential shows its own status and the profile needs a look', async () => {
      const issued = await call('POST', '/issuer/credentials', issuerToken, {
        learnerEmail: 'sharone@example.com', title: 'Profile revoke test', category: 'Test', issueDate: '2026-11-03',
      });
      const { credential } = (await issued.json()) as { credential: { id: string } };
      const response = await call('POST', '/learner/profile-links', learnerToken, { credentialIds: ['cred-3', credential.id] });
      const profileToken = ((await response.json()) as CreateResponse).shareUrl.split('/profile/')[1];
      assert.equal((await call('PATCH', `/issuer/credentials/${credential.id}/revoke`, issuerToken)).status, 200);

      const { body } = await viewProfile(profileToken);
      assert.equal(body.status, 'PARTLY_VERIFIED');
      assert.equal(body.valid, false);
      assert.equal(body.verifiedCount, 1);
      assert.deepEqual(body.credentials.map((item) => item.status), ['VERIFIED', 'REVOKED']);
    });

    await t.test('revoked credentials cannot be added to a new profile', async () => {
      const list = (await (await call('GET', '/learner/credentials', learnerToken)).json()) as { credentials: Array<{ id: string; status: string }> };
      const revoked = list.credentials.find((item) => item.status === 'REVOKED');
      assert.ok(revoked);
      assert.equal((await call('POST', '/learner/profile-links', learnerToken, { credentialIds: ['cred-1', revoked.id] })).status, 409);
    });

    await t.test('the learner can list and turn off profile links', async () => {
      const list = (await (await call('GET', '/learner/profile-links', learnerToken)).json()) as { profileLinks: Array<{ id: string }> };
      assert.ok(list.profileLinks.some((link) => link.id === created.profileLink.id));

      const otherLearner = await registerVerified(baseUrl, 'profile-thief', 'LEARNER');
      assert.equal((await call('DELETE', `/learner/profile-links/${created.profileLink.id}`, otherLearner.token)).status, 404);

      const off = await call('DELETE', `/learner/profile-links/${created.profileLink.id}`, learnerToken);
      assert.equal(((await off.json()) as CreateResponse).profileLink.status, 'REVOKED');
      const { httpStatus, body } = await viewProfile(shareToken);
      assert.equal(httpStatus, 410);
      assert.equal(body.status, 'LINK_REVOKED');
      assert.equal(body.learner, null, 'a turned-off link reveals no learner');
      assert.equal(body.title, null);
      assert.deepEqual(body.credentials, []);
    });

    await t.test('unknown or malformed tokens reveal nothing', async () => {
      const unknown = await viewProfile('A'.repeat(43));
      assert.equal(unknown.httpStatus, 404);
      assert.equal(unknown.body.status, 'NOT_FOUND');
      assert.equal((await viewProfile('not-a-token')).httpStatus, 404);
      // A single-credential token does not open a profile, and vice versa.
      const single = await call('POST', '/learner/credentials/cred-1/share-links', learnerToken, {});
      const singleToken = ((await single.json()) as { shareUrl: string }).shareUrl.split('/verify/')[1];
      assert.equal((await viewProfile(singleToken)).httpStatus, 404);
      assert.equal((await fetch(`${baseUrl}/api/verify/${shareToken}`)).status, 404);
    });
  } finally {
    server.close();
  }
});
