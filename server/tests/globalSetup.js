/**
 * Uses MONGO_URI_TEST when given (e.g. a Docker or CI MongoDB), otherwise
 * boots an in-memory MongoDB with mongodb-memory-server.
 */
let memoryServer;

export default async function setup({ provide }) {
  let uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  provide('mongoUri', uri);
  return async () => {
    await memoryServer?.stop();
  };
}
