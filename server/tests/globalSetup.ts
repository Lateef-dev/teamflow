import type { TestProject } from 'vitest/node';
import type { MongoMemoryServer } from 'mongodb-memory-server';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/**
 * Uses MONGO_URI_TEST when given (a Docker or CI MongoDB), otherwise boots an
 * in-memory MongoDB with mongodb-memory-server.
 */
let memoryServer: MongoMemoryServer | undefined;

export default async function setup(project: TestProject) {
  let uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  project.provide('mongoUri', uri);
  return async () => {
    await memoryServer?.stop();
  };
}
