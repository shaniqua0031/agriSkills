import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHARE_TOKEN_PATTERN,
  SIGNATURE_KEY_ID,
  canonicalCredentialPayload,
  createShareToken,
  hashShareToken,
  signCredential,
  signingKeyFingerprint,
  verifyCredentialSignature,
} from './integrity.js';

const secret = 'unit-test-secret';
const credential = {
  publicId: 'cred-test',
  learnerId: 'learner-1',
  issuerId: 'issuer-1',
  title: 'Agricultural Safety Certificate',
  description: 'Fictional test credential.',
  category: 'Safety',
  issueDate: '2026-01-01T00:00:00.000Z',
  expiryDate: '2027-01-01T00:00:00.000Z',
  skills: ['Risk assessment'],
};
const signed = { ...credential, signature: signCredential(credential, secret), signatureKeyId: SIGNATURE_KEY_ID };

test('a correctly signed credential verifies', () => {
  assert.equal(verifyCredentialSignature(signed, secret), true);
});

test('canonical payload does not depend on date formatting', () => {
  assert.equal(
    canonicalCredentialPayload(credential),
    canonicalCredentialPayload({ ...credential, issueDate: '2026-01-01T02:00:00+02:00' }),
  );
});

test('tampered fields fail verification', () => {
  assert.equal(verifyCredentialSignature({ ...signed, title: 'Forged title' }, secret), false);
  assert.equal(verifyCredentialSignature({ ...signed, skills: ['Risk assessment', 'Extra skill'] }, secret), false);
  assert.equal(verifyCredentialSignature({ ...signed, expiryDate: '2099-01-01T00:00:00.000Z' }, secret), false);
  assert.equal(verifyCredentialSignature({ ...signed, learnerId: 'someone-else' }, secret), false);
});

test('missing signature, unknown key ID or wrong secret fail closed', () => {
  assert.equal(verifyCredentialSignature({ ...signed, signature: null }, secret), false);
  assert.equal(verifyCredentialSignature({ ...signed, signatureKeyId: 'v0' }, secret), false);
  assert.equal(verifyCredentialSignature({ ...signed, signature: 'short' }, secret), false);
  assert.equal(verifyCredentialSignature(signed, 'a-different-secret'), false);
});

test('share tokens are random, URL-safe and stored only as a hash', () => {
  const first = createShareToken();
  const second = createShareToken();
  assert.match(first, SHARE_TOKEN_PATTERN);
  assert.notEqual(first, second);
  assert.match(hashShareToken(first), /^[0-9a-f]{64}$/);
  assert.notEqual(hashShareToken(first), first);
});

test('signing key fingerprint identifies the secret without revealing it', () => {
  const a = signingKeyFingerprint('secret-one');
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.equal(a, signingKeyFingerprint('secret-one'));
  assert.notEqual(a, signingKeyFingerprint('secret-two'));
  assert.ok(!a.includes('secret'));
});
