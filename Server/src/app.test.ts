import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

process.env.DATABASE_URL = '';
// Never send real emails from tests: codes are captured in memory instead.
process.env.SMTP_USER = '';
process.env.RESEND_API_KEY = '';
process.env.PUBLIC_BASE_URL = 'http://verify.test:3000';
const { app } = await import('./app.js');
const { registerVerified } = await import('./test-support.js');

type ShareResponse = { shareUrl: string; shareLink: { id: string; status: string; expiresAt: string } };

test('share links and public verification', async (t) => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const json = (token?: string) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const login = async (email: string) => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: json(),
      body: JSON.stringify({ email, password: 'Password123' }),
    });
    assert.equal(response.status, 200);
    return ((await response.json()) as { token: string }).token;
  };
  const register = async (prefix: string, role: 'LEARNER' | 'ISSUER') =>
    (await registerVerified(baseUrl, prefix, role, { approve: true })).token;
  const createShare = (credentialId: string, token: string, body: object = {}) =>
    fetch(`${baseUrl}/learner/credentials/${credentialId}/share-links`, {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify(body),
    });
  const shareAndGetToken = async (credentialId: string, token: string) => {
    const response = await createShare(credentialId, token);
    assert.equal(response.status, 201);
    const body = (await response.json()) as ShareResponse;
    return { ...body, shareToken: body.shareUrl.split('/verify/')[1] };
  };
  const verifyJson = async (shareToken: string) => {
    const response = await fetch(`${baseUrl}/api/verify/${shareToken}`);
    return { httpStatus: response.status, body: (await response.json()) as { status: string; valid: boolean; credential: unknown } };
  };

  try {
    const learnerToken = await login('sharone@example.com');
    const issuerToken = await login('issuer@example.com');
    const issue = async (title: string, extra: object = {}) => {
      const response = await fetch(`${baseUrl}/issuer/credentials`, {
        method: 'POST',
        headers: json(issuerToken),
        body: JSON.stringify({ learnerEmail: 'sharone@example.com', title, category: 'Test', issueDate: '2026-11-02', ...extra }),
      });
      assert.equal(response.status, 201);
      return ((await response.json()) as { credential: { id: string; publicId: string } }).credential;
    };

    await t.test('registration creates an account that can log in', async () => {
      const token = await register('passport-test', 'LEARNER');
      const me = await fetch(`${baseUrl}/me`, { headers: json(token) });
      assert.equal(((await me.json()) as { user: { role: string } }).user.role, 'LEARNER');
    });

    await t.test('creating a share link requires the owning learner', async () => {
      assert.equal((await createShare('cred-1', '')).status, 401);
      assert.equal((await createShare('cred-1', issuerToken)).status, 403);
      const otherLearner = await register('other-learner', 'LEARNER');
      assert.equal((await createShare('cred-1', otherLearner)).status, 404);
    });

    await t.test('share link uses an unguessable token, not the credential reference', async () => {
      const { shareUrl, shareToken, shareLink } = await shareAndGetToken('cred-1', learnerToken);
      const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
      assert.ok(shareUrl.startsWith(`${publicBaseUrl}/verify/`));
      assert.match(shareToken, /^[A-Za-z0-9_-]{43}$/);
      assert.doesNotMatch(shareUrl, /demo-safety-cert/);
      assert.equal(shareLink.status, 'ACTIVE');
      const days = (Date.parse(shareLink.expiresAt) - Date.now()) / 86_400_000;
      assert.ok(days > 29.9 && days <= 30, 'defaults to a 30-day expiry');
    });

    await t.test('expiry must be 1 to 365 whole days', async () => {
      for (const expiresInDays of [0, 366, 1.5, '7']) {
        assert.equal((await createShare('cred-1', learnerToken, { expiresInDays })).status, 400);
      }
      assert.equal((await createShare('cred-1', learnerToken, { expiresInDays: 7 })).status, 201);
    });

    await t.test('valid link verifies and the page shows only public data', async () => {
      const { shareToken } = await shareAndGetToken('cred-1', learnerToken);
      const { httpStatus, body } = await verifyJson(shareToken);
      assert.equal(httpStatus, 200);
      assert.equal(body.status, 'VERIFIED');
      assert.equal(body.valid, true);

      const page = await fetch(`${baseUrl}/verify/${shareToken}`);
      const html = await page.text();
      assert.equal(page.status, 200);
      assert.equal(page.headers.get('cache-control'), 'no-store');
      assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
      assert.match(html, /Credential Verified/);
      assert.match(html, /Sharone Mabunda/);
      assert.doesNotMatch(html, /sharone@example\.com/);
      assert.doesNotMatch(html, /learner-1|issuer-1/);
    });

    await t.test('old public-reference URLs no longer verify', async () => {
      assert.equal((await fetch(`${baseUrl}/verify/credential/demo-safety-cert`)).status, 404);
      assert.equal((await fetch(`${baseUrl}/api/verify/demo-safety-cert`)).status, 404);
    });

    await t.test('malformed and unknown tokens are not found', async () => {
      for (const token of ['abc', '<script>', 'A'.repeat(43)]) {
        const { httpStatus, body } = await verifyJson(encodeURIComponent(token));
        assert.equal(httpStatus, 404);
        assert.equal(body.status, 'NOT_FOUND');
        assert.equal(body.credential, null);
      }
    });

    await t.test('learner sees who checked their credential, without employer details', async () => {
      const credential = await issue('Checked Course');
      const { shareToken } = await shareAndGetToken(credential.id, learnerToken);
      await verifyJson(shareToken);
      await fetch(`${baseUrl}/verify/${shareToken}`);

      const history = async (token: string, query = '') =>
        fetch(`${baseUrl}/learner/verifications${query}`, { headers: json(token) });
      const response = await history(learnerToken, `?credentialId=${credential.id}`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        summary: { total: number; last30Days: number; lastCheckedAt: string | null };
        events: Array<Record<string, unknown>>;
      };
      assert.equal(body.summary.total, 2);
      assert.equal(body.summary.last30Days, 2);
      assert.ok(body.summary.lastCheckedAt);
      assert.deepEqual(body.events.map((event) => event.source), ['page', 'app'], 'newest first, with how it was opened');
      assert.ok(body.events.every((event) => event.result === 'VERIFIED' && event.credentialTitle === 'Checked Course'));
      assert.deepEqual(Object.keys(body.events[0]).sort(), ['createdAt', 'credentialId', 'credentialTitle', 'id', 'result', 'source']);

      assert.equal((await history(issuerToken)).status, 403);
      const otherLearner = await register('history-snoop', 'LEARNER');
      assert.equal((await history(otherLearner, `?credentialId=${credential.id}`)).status, 404);
      const empty = (await (await history(otherLearner)).json()) as { summary: { total: number } };
      assert.equal(empty.summary.total, 0);
    });

    await t.test('learner can list and revoke their links; revoked links stop working', async () => {
      const { shareToken, shareLink } = await shareAndGetToken('cred-2', learnerToken);
      const list = await fetch(`${baseUrl}/learner/credentials/cred-2/share-links`, { headers: json(learnerToken) });
      const { shareLinks } = (await list.json()) as { shareLinks: Array<{ id: string; tokenHash?: string }> };
      assert.ok(shareLinks.some((link) => link.id === shareLink.id));
      assert.ok(shareLinks.every((link) => link.tokenHash === undefined), 'token hashes are never returned');

      const otherLearner = await register('revoke-attacker', 'LEARNER');
      const denied = await fetch(`${baseUrl}/learner/share-links/${shareLink.id}`, { method: 'DELETE', headers: json(otherLearner) });
      assert.equal(denied.status, 404);

      const revoke = await fetch(`${baseUrl}/learner/share-links/${shareLink.id}`, { method: 'DELETE', headers: json(learnerToken) });
      assert.equal(revoke.status, 200);
      assert.equal(((await revoke.json()) as ShareResponse).shareLink.status, 'REVOKED');

      const { httpStatus, body } = await verifyJson(shareToken);
      assert.equal(httpStatus, 410);
      assert.equal(body.status, 'LINK_REVOKED');
      assert.equal(body.credential, null, 'a revoked link reveals no credential details');
    });

    await t.test('expired links stop working', async () => {
      const { shareToken } = await shareAndGetToken('cred-3', learnerToken);
      t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 31 * 86_400_000 });
      try {
        const { httpStatus, body } = await verifyJson(shareToken);
        assert.equal(httpStatus, 410);
        assert.equal(body.status, 'LINK_EXPIRED');
        assert.equal(body.credential, null);
      } finally {
        t.mock.timers.reset();
      }
    });

    await t.test('revoked credentials report REVOKED and cannot get new links', async () => {
      const credential = await issue('Revoke test credential', { expiryDate: '2030-01-01' });
      const { shareToken } = await shareAndGetToken(credential.id, learnerToken);
      const revoke = await fetch(`${baseUrl}/issuer/credentials/${credential.id}/revoke`, { method: 'PATCH', headers: json(issuerToken) });
      assert.equal(revoke.status, 200);

      const { body } = await verifyJson(shareToken);
      assert.equal(body.status, 'REVOKED');
      assert.equal(body.valid, false);
      assert.equal((await createShare(credential.id, learnerToken)).status, 409);
    });

    await t.test('expired credentials cannot be shared', async () => {
      const credential = await issue('Expired test credential', { expiryDate: '2024-01-01' });
      assert.equal((await createShare(credential.id, learnerToken)).status, 409);
    });

    await t.test('newly issued credentials are signed and verify', async () => {
      const credential = await issue('Signed test credential', { expiryDate: '2030-01-01', skills: ['Testing'] });
      const { shareToken } = await shareAndGetToken(credential.id, learnerToken);
      assert.equal((await verifyJson(shareToken)).body.status, 'VERIFIED');
    });

    await t.test('public credential values are HTML-escaped', async () => {
      const credential = await issue('<script>alert(1)</script>', { skills: ['<img src=x onerror=alert(1)>'] });
      const { shareToken } = await shareAndGetToken(credential.id, learnerToken);
      const html = await (await fetch(`${baseUrl}/verify/${shareToken}`)).text();
      assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
      assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
      assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    });

    await t.test('learners and issuers cannot access another owner’s credentials', async () => {
      const credential = await issue('Authorization test qualification');
      const secondLearner = await register('other-learner', 'LEARNER');
      const forbiddenRead = await fetch(`${baseUrl}/learner/credentials/${credential.id}`, { headers: json(secondLearner) });
      assert.equal(forbiddenRead.status, 404);

      const otherIssuer = await register('other-issuer', 'ISSUER');
      const forbiddenRevoke = await fetch(`${baseUrl}/issuer/credentials/${credential.id}/revoke`, {
        method: 'PATCH',
        headers: json(otherIssuer),
      });
      assert.equal(forbiddenRevoke.status, 404);
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
});
