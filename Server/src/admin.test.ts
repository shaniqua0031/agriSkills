import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

process.env.DATABASE_URL = '';
// Never send real emails from tests.
process.env.SMTP_USER = '';
process.env.RESEND_API_KEY = '';
const { app, testing } = await import('./app.js');
const { registerVerified } = await import('./test-support.js');

test('admin: issuer approval from the app', async (t) => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const call = (method: string, path: string, token: string, body?: object) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  type IssuerRow = { id: string; email: string; approved: boolean; approvedBy: string | null; issuedCount: number };
  const listIssuers = async (token: string) => ((await (await call('GET', '/admin/issuers', token)).json()) as { issuers: IssuerRow[] }).issuers;

  try {
    const admin = await registerVerified(baseUrl, 'admin', 'LEARNER');
    testing.makeAdmin(admin.email);
    const learner = await registerVerified(baseUrl, 'admin-learner', 'LEARNER');
    const issuer = await registerVerified(baseUrl, 'admin-issuer', 'ISSUER');
    const spare = await registerVerified(baseUrl, 'admin-spare', 'ISSUER');
    const credential = { learnerEmail: learner.email, title: 'Admin test', category: 'Test', issueDate: '2026-11-06' };

    await t.test('only admins can use the admin routes', async () => {
      assert.equal((await call('GET', '/admin/issuers', learner.token)).status, 403);
      assert.equal((await call('GET', '/admin/issuers', issuer.token)).status, 403);
      assert.equal((await call('POST', `/admin/issuers/${issuer.user.id}/approve`, issuer.token)).status, 403, 'issuers cannot approve themselves');
    });

    await t.test('admins cannot be created through sign-up', async () => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sneaky', email: `sneaky-${Date.now()}@example.com`, password: 'Sneaky1234', role: 'ADMIN', acceptedPrivacy: true }),
      });
      assert.equal(response.status, 400);
    });

    await t.test('new issuers wait for an admin, and approval records who approved', async () => {
      const before = (await listIssuers(admin.token)).find((r) => r.id === issuer.user.id);
      assert.equal(before?.approved, false);
      const blocked = await call('POST', '/issuer/credentials', issuer.token, credential);
      assert.equal(blocked.status, 403);
      assert.equal(((await blocked.json()) as { code: string }).code, 'ISSUER_NOT_APPROVED');

      assert.equal((await call('POST', `/admin/issuers/${issuer.user.id}/approve`, admin.token)).status, 200);
      const after = (await listIssuers(admin.token)).find((r) => r.id === issuer.user.id);
      assert.equal(after?.approved, true);
      assert.equal(after?.approvedBy, 'Fictional admin');
      assert.equal((await call('POST', '/issuer/credentials', issuer.token, credential)).status, 201);
    });

    await t.test('an issuer who has issued credentials cannot be declined, only withdrawn', async () => {
      assert.equal((await call('DELETE', `/admin/issuers/${issuer.user.id}`, admin.token)).status, 409);
      assert.equal((await call('POST', `/admin/issuers/${issuer.user.id}/withdraw`, admin.token)).status, 200);
      assert.equal((await call('POST', '/issuer/credentials', issuer.token, credential)).status, 403);
    });

    await t.test('declining removes a pending issuer account', async () => {
      assert.equal((await call('DELETE', `/admin/issuers/${spare.user.id}`, admin.token)).status, 204);
      assert.ok(!(await listIssuers(admin.token)).some((r) => r.id === spare.user.id));
      assert.equal((await call('GET', '/me', spare.token)).status, 401, 'the declined account can no longer sign in');
    });

    await t.test('admin routes only act on issuer accounts', async () => {
      assert.equal((await call('POST', `/admin/issuers/${learner.user.id}/approve`, admin.token)).status, 404);
      assert.equal((await call('DELETE', `/admin/issuers/${learner.user.id}`, admin.token)).status, 404);
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
});
