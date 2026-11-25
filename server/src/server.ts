import http from 'node:http';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket.js';
import { ensureDemoData } from './lib/demoSeed.js';

async function main() {
  await connectDb(config.mongoUri);
  if (config.seedDemo && (await ensureDemoData())) console.log('Created the demo workspace');
  const server = http.createServer(createApp());
  createSocketServer(server);
  server.listen(config.port, () => {
    console.log(`TeamFlow API listening on http://localhost:${config.port}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
