import { app, connectDatabase, disconnectDatabase } from './app.js';
import { checkEmailSetup } from './mailer.js';

const port = Number(process.env.PORT ?? 3000);

async function startServer() {
  // The in-memory store in app.ts exists only for automated tests; real runs must use the database.
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in Server/.env. The server no longer runs on demo data.');
  }
  await connectDatabase();
  await checkEmailSetup();

  const server = app.listen(port, () => {
    console.log(`AgriSkills Passport API listening on http://localhost:${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error: unknown) => {
  console.error('Failed to start AgriSkills Passport API:', error);
  if ((error as { errorCode?: string } | null)?.errorCode === 'P1001') {
    console.error(
      '\nHint: the database could not be reached. Check that this computer is online (open any website),'
      + ' that the Neon project is not paused or deleted at https://console.neon.tech, and that DATABASE_URL'
      + ' in Server/.env is correct. Then start the server again.',
    );
  }
  void disconnectDatabase().finally(() => process.exit(1));
});
