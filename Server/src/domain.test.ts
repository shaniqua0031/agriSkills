import test from 'node:test';
import assert from 'node:assert/strict';

import { computeCredentialStatus } from './domain.js';

test('expired credentials are marked expired', () => {
  const expired = {
    status: 'ACTIVE' as const,
    expiryDate: new Date(Date.now() - 60000).toISOString(),
    revokedAt: null,
  };

  assert.equal(computeCredentialStatus(expired), 'EXPIRED');
});

test('revoked credentials stay revoked', () => {
  const revoked = {
    status: 'ACTIVE' as const,
    expiryDate: new Date(Date.now() + 60000).toISOString(),
    revokedAt: new Date().toISOString(),
  };

  assert.equal(computeCredentialStatus(revoked), 'REVOKED');
});

test('valid credentials are active', () => {
  const valid = {
    status: 'ACTIVE' as const,
    expiryDate: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null,
  };

  assert.equal(computeCredentialStatus(valid), 'ACTIVE');
});
