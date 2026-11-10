// Approve issuer accounts so they can issue and revoke credentials.
//   npm run issuer:approve                 -> list issuers waiting for approval
//   npm run issuer:approve -- a@b.com      -> approve that issuer
//   npm run issuer:approve -- --revoke a@b.com -> withdraw approval
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase();

  if (!email) {
    const pending = await prisma.user.findMany({
      where: { role: 'ISSUER', issuerApprovedAt: null },
      select: { name: true, email: true, emailVerifiedAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) {
      console.log('No issuers are waiting for approval.');
      return;
    }
    console.log('Issuers waiting for approval:');
    console.table(pending.map((p) => ({
      name: p.name,
      email: p.email,
      emailVerified: Boolean(p.emailVerifiedAt),
      signedUp: p.createdAt.toISOString().slice(0, 10),
    })));
    console.log('Approve one with: npm run issuer:approve -- <email>');
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account found for ${email}.`);
  if (user.role !== 'ISSUER') throw new Error(`${email} is a ${user.role} account, not an issuer.`);

  await prisma.user.update({ where: { id: user.id }, data: { issuerApprovedAt: revoke ? null : new Date() } });
  console.log(revoke ? `Approval withdrawn for ${user.name} (${email}).` : `Approved ${user.name} (${email}) as an issuer.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
