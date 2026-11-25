import http from 'node:http';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket.js';

async function main() {
  await connectDb(config.mongoUri);
  const app = createApp();
  const server = http.createServer(app);
  createSocketServer(server);
  server.listen(config.port, () => {
    console.log(`TeamFlow API listening on http://localhost:${config.port}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
