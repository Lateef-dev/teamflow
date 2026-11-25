import { afterAll, beforeAll, inject } from 'vitest';
import mongoose from 'mongoose';

// Each test file gets its own database so files never see each other's data.
const url = new URL(inject('mongoUri'));
url.pathname = `/teamflow_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
process.env.MONGO_URI = url.toString();
process.env.JWT_SECRET = 'test-secret';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI as string);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
