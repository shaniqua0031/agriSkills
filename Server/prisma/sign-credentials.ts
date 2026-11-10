// One-off backfill: signs credentials created before signing existed (signature IS NULL).
// Safe to re-run; already-signed credentials are left untouched.
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { SIGNATURE_ALGORITHM, SIGNATURE_KEY_ID, signCredential } from '../src/integrity.js';

const prisma = new PrismaClient();

async function main() {
  const unsigned = await prisma.credential.findMany({ where: { signature: null } });
  for (const credential of unsigned) {
    await prisma.credential.update({
      where: { id: credential.id },
      data: {
        signature: signCredential({
          ...credential,
          issueDate: credential.issueDate.toISOString(),
          expiryDate: credential.expiryDate?.toISOString() ?? null,
        }),
        signatureAlgorithm: SIGNATURE_ALGORITHM,
        signatureKeyId: SIGNATURE_KEY_ID,
      },
    });
  }
  console.log(`Signed ${unsigned.length} credential(s).`);
}

main().catch((error) => {
  console.error('Signing backfill failed:', error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
