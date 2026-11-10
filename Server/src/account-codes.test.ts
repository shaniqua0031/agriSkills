import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

process.env.DATABASE_URL = '';
// Never send real emails from tests: reset tokens are captured in memory instead.
process.env.SMTP_USER = '';
process.env.RESEND_API_KEY = '';
const { app, testing } = await import('./app.js');
const { testHooks } = await import('./account-codes.js');

test('accounts: privacy consent, instant sign-up, password reset and issuer approval', async (t) => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: object, token?: string) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  const stamp = Date.now();
  const learnerEmail = `acct-learner-${stamp}@example.com`;

  try {
    await t.test('sign-up requires accepting the privacy notice and a supported role', async () => {
      const base = { name: 'Fictional Learner', email: learnerEmail, password: 'OldPassword1' };
      assert.equal((await post('/auth/register', { ...base, role: 'LEARNER' })).status, 400);
      assert.equal((await post('/auth/register', { ...base, role: 'ADMIN', acceptedPrivacy: true })).status, 400, 'admins cannot sign up in the app');
      const ok = await post('/auth/register', { ...base, role: 'LEARNER', acceptedPrivacy: true });
      assert.equal(ok.status, 201);
      const body = (await ok.json()) as { token?: string; user?: { role: string } };
      assert.ok(body.token, 'sign-up logs the user straight in');
      assert.equal(body.user?.role, 'LEARNER');
    });

    await t.test('the new account can log in immediately (no email check)', async () => {
      assert.equal((await post('/auth/login', { email: learnerEmail, password: 'OldPassword1' })).status, 200);
      assert.equal((await post('/auth/verify-email', { email: learnerEmail, code: '123456' })).status, 404, 'verification route removed');
    });

    await t.test('password reset: same response for unknown emails, link works once', async () => {
      testHooks.PASSWORD_RESET_TOKEN = '';
      const unknown = await post('/auth/forgot-password', { email: `nobody-${stamp}@example.com` });
      assert.equal(unknown.status, 200);
      assert.equal(testHooks.PASSWORD_RESET_TOKEN, '', 'no reset token for unknown accounts');
      const known = await post('/auth/forgot-password', { email: learnerEmail });
      assert.deepEqual(await known.json(), await unknown.json());

      const token = testHooks.PASSWORD_RESET_TOKEN;
      assert.equal((await post('/auth/reset-password', { token: `${token}wrong`, password: 'NewPassword1' })).status, 400, 'invalid reset links are rejected');
      assert.equal((await post('/auth/reset-password', { token, password: 'short' })).status, 400);
      assert.equal((await post('/auth/reset-password', { email: learnerEmail, password: 'NewPassword1' })).status, 400, 'email alone cannot reset a password');
      assert.equal((await post('/auth/reset-password', { token, password: 'NewPassword1' })).status, 200);
      assert.equal((await post('/auth/login', { email: learnerEmail, password: 'OldPassword1' })).status, 401);
      assert.equal((await post('/auth/login', { email: learnerEmail, password: 'NewPassword1' })).status, 200);
      assert.equal((await post('/auth/reset-password', { token, password: 'Another123' })).status, 400, 'reset link works only once');
    });


    await t.test('new issuers cannot issue until an admin approves them', async () => {
      const issuerEmail = `acct-issuer-${stamp}@example.com`;
      const registered = await post('/auth/register', { name: 'Fictional Provider', email: issuerEmail, password: 'IssuerPass1', role: 'ISSUER', acceptedPrivacy: true });
      assert.equal(registered.status, 201);
      const { token } = (await registered.json()) as { token: string };

      const me = (await (await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { user: { issuerApproved: boolean } };
      assert.equal(me.user.issuerApproved, false);

      const credential = { learnerEmail, title: 'Approval test', category: 'Test', issueDate: '2026-11-06' };
      const blocked = await post('/issuer/credentials', credential, token);
      assert.equal(blocked.status, 403);
      assert.equal(((await blocked.json()) as { code: string }).code, 'ISSUER_NOT_APPROVED');

      testing.approveIssuer(issuerEmail);
      assert.equal((await post('/issuer/credentials', credential, token)).status, 201);

      // Pressing Issue again for the same learner, title and date is refused instead of creating a duplicate.
      const again = await post('/issuer/credentials', { ...credential, title: '  approval TEST ' }, token);
      assert.equal(again.status, 409);
      assert.equal(((await again.json()) as { code: string }).code, 'DUPLICATE_CREDENTIAL');
      assert.equal((await post('/issuer/credentials', { ...credential, issueDate: '2026-11-07' }, token)).status, 201, 'a different issue date is allowed');
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
});
