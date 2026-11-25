import { inject, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';

const base = inject('mongoUri');
// Each test file gets its own database so files never see each other's data.
const dbName = `teamflow_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const url = new URL(base);
url.pathname = `/${dbName}`;
process.env.MONGO_URI = url.toString();
process.env.JWT_SECRET = 'test-secret';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
