// Shared helpers for the automated tests (in-memory store).
import assert from 'node:assert/strict';

import { testing } from './app.js';

let counter = 0;

/** Signs up (which logs the user straight in) and returns the session. */
export async function registerVerified(baseUrl: string, prefix: string, role: 'LEARNER' | 'ISSUER', options: { approve?: boolean } = {}) {
  counter += 1;
  const email = `${prefix}-${Date.now()}-${counter}@example.com`;
  const registered = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Fictional ${prefix}`, email, password: 'TestPassword123', role, acceptedPrivacy: true }),
  });
  assert.equal(registered.status, 201);
  if (role === 'ISSUER' && options.approve) testing.approveIssuer(email);
  const session = (await registered.json()) as { token: string; user: { id: string; email: string } };
  return { ...session, email };
}
