// Make an existing account an ADMIN (admins approve issuers in the app).
// Admins can't be created through sign-up, so the first one is set up here.
//   npm run admin:grant                   -> list current admins
//   npm run admin:grant -- a@b.com        -> make that account an admin
//   npm run admin:grant -- --revoke a@b.com -> turn an admin back into a learner
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase();

  if (!email) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { name: true, email: true } });
    console.log(admins.length ? 'Admins:' : 'There are no admins yet. Sign up in the app, then run: npm run admin:grant -- <your email>');
    if (admins.length) console.table(admins);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { _count: { select: { issuedCredentials: true, learnerCredentials: true } } },
  });
  if (!user) throw new Error(`No account found for ${email}. Sign up in the app first.`);

  if (revoke) {
    if (user.role !== 'ADMIN') throw new Error(`${email} is not an admin.`);
    await prisma.user.update({ where: { id: user.id }, data: { role: 'LEARNER' } });
    console.log(`${user.name} (${email}) is no longer an admin (now a learner account).`);
    return;
  }

  if (user.role === 'ADMIN') {
    console.log(`${user.name} (${email}) is already an admin.`);
    return;
  }
  // Keep roles clean: an account that holds or issued credentials stays what it is.
  if (user._count.issuedCredentials > 0 || user._count.learnerCredentials > 0) {
    throw new Error(`${email} already has credentials as a ${user.role.toLowerCase()}. Create a separate account for the admin.`);
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN', issuerApprovedAt: null, issuerApprovedById: null } });
  console.log(`${user.name} (${email}) is now an admin. Log out and back in to open the admin screen.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
