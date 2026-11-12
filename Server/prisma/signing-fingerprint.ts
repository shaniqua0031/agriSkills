// Prints the fingerprint of CREDENTIAL_SIGNING_SECRET from Server/.env.
// Compare it with "signingKey" at https://<api>/health: if they differ, the deployed server uses a
// different secret and existing credentials will fail verification there.
import 'dotenv/config';
import { signingKeyFingerprint } from '../src/integrity.js';

console.log(signingKeyFingerprint());
