/**
 * Resets the demo data: npm run seed
 * Log in as demo@teamflow.dev / password123 (invite code: acme-demo).
 */
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { seedDemo } from './lib/demoSeed.js';

async function main() {
  await connectDb(config.mongoUri);
  await seedDemo();
  console.log('Seeded. Log in as demo@teamflow.dev / password123 (invite code: acme-demo)');
  await disconnectDb();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
