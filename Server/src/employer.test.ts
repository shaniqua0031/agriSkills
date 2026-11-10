import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

process.env.DATABASE_URL = '';
process.env.SMTP_USER = '';
process.env.RESEND_API_KEY = '';
process.env.PUBLIC_BASE_URL = 'http://verify.test:3000';
const { app } = await import('./app.js');
const { registerVerified } = await import('./test-support.js');

type Check = {
  id: string;
  result: string;
  learnerName: string | null;
  credentialTitle: string | null;
  issuerName: string | null;
  note: string | null;
  canRecheck: boolean;
};
type CheckResponse = { check: Check | null; verification: { status: string; valid: boolean; credential: unknown } };

test('employer accounts check shared credentials and keep a private list', async (t) => {
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

  try {
    const learnerToken = await login('sharone@example.com');
    const shareResponse = await call('POST', '/learner/credentials/cred-1/share-links', learnerToken, { expiresInDays: 7 });
    const share = (await shareResponse.json()) as { shareUrl: string; shareLink: { id: string } };
    const employer = await registerVerified(baseUrl, 'employer', 'EMPLOYER');
    const otherEmployer = await registerVerified(baseUrl, 'other-employer', 'EMPLOYER');
    let saved: Check;

    await t.test('anyone can sign up as an employer', async () => {
      const me = await call('GET', '/me', employer.token);
      assert.equal(((await me.json()) as { user: { role: string } }).user.role, 'EMPLOYER');
    });

    await t.test('only employers can use the check list', async () => {
      assert.equal((await call('GET', '/employer/checks', '')).status, 401);
      assert.equal((await call('GET', '/employer/checks', learnerToken)).status, 403);
      assert.equal((await call('POST', '/employer/checks', employer.token, { link: 'not a link' })).status, 400);
    });

    await t.test('checking a shared link returns the result and saves it once', async () => {
      const first = await call('POST', '/employer/checks', employer.token, { link: share.shareUrl, note: 'Applied for tractor driver' });
      assert.equal(first.status, 201);
      const body = (await first.json()) as CheckResponse;
      assert.equal(body.verification.status, 'VERIFIED');
      assert.ok(body.check);
      saved = body.check;
      assert.equal(saved.result, 'VERIFIED');
      assert.equal(saved.learnerName, 'Sharone Mabunda');
      assert.equal(saved.credentialTitle, 'Agricultural Safety Certificate');
      assert.equal(saved.note, 'Applied for tractor driver');
      assert.equal(saved.canRecheck, true);
      assert.ok(!('shareLinkId' in saved) && !('employerId' in saved), 'internal ids stay on the server');

      // Pasting just the token works too, and updates the same entry instead of adding another.
      const again = await call('POST', '/employer/checks', employer.token, { link: share.shareUrl.split('/verify/')[1] });
      assert.equal(again.status, 200);
      assert.equal(((await again.json()) as CheckResponse).check?.id, saved.id);
      const list = (await (await call('GET', '/employer/checks', employer.token)).json()) as { checks: Check[] };
      assert.equal(list.checks.length, 1);
      assert.equal(list.checks[0].note, 'Applied for tractor driver', 'an empty note does not wipe the saved one');
    });

    await t.test('an unknown link is reported but not saved', async () => {
      const response = await call('POST', '/employer/checks', employer.token, { link: `${'A'.repeat(43)}` });
      const body = (await response.json()) as CheckResponse;
      assert.equal(body.verification.status, 'NOT_FOUND');
      assert.equal(body.check, null);
    });

    await t.test('each employer only sees their own checks', async () => {
      const list = (await (await call('GET', '/employer/checks', otherEmployer.token)).json()) as { checks: Check[] };
      assert.equal(list.checks.length, 0);
      assert.equal((await call('PATCH', `/employer/checks/${saved.id}`, otherEmployer.token, { note: 'x' })).status, 404);
      assert.equal((await call('DELETE', `/employer/checks/${saved.id}`, otherEmployer.token)).status, 404);
      assert.equal((await call('POST', `/employer/checks/${saved.id}/recheck`, otherEmployer.token)).status, 404);
    });

    await t.test('notes can be changed and must be short', async () => {
      const updated = await call('PATCH', `/employer/checks/${saved.id}`, employer.token, { note: 'Interviewed 12 Nov' });
      assert.equal(((await updated.json()) as { check: Check }).check.note, 'Interviewed 12 Nov');
      assert.equal((await call('PATCH', `/employer/checks/${saved.id}`, employer.token, { note: 'x'.repeat(501) })).status, 400);
    });

    await t.test('check again shows the current status when the learner turns the link off', async () => {
      assert.equal((await call('DELETE', `/learner/share-links/${share.shareLink.id}`, learnerToken)).status, 200);
      const response = await call('POST', `/employer/checks/${saved.id}/recheck`, employer.token);
      assert.equal(response.status, 200);
      const body = (await response.json()) as CheckResponse;
      assert.equal(body.verification.status, 'LINK_REVOKED');
      assert.equal(body.verification.credential, null, 'no credential details once the link is off');
      assert.equal(body.check?.result, 'LINK_REVOKED');
      assert.equal(body.check?.learnerName, 'Sharone Mabunda', 'keeps the name the employer already saw');
    });

    await t.test('employers can delete a saved check', async () => {
      assert.equal((await call('DELETE', `/employer/checks/${saved.id}`, employer.token)).status, 204);
      const list = (await (await call('GET', '/employer/checks', employer.token)).json()) as { checks: Check[] };
      assert.equal(list.checks.length, 0);
    });
  } finally {
    server.close();
  }
});
