import 'dotenv/config';

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const isTest = process.env.NODE_ENV === 'test';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI', isTest ? undefined : 'mongodb://127.0.0.1:27017/teamflow'),
  jwtSecret: required('JWT_SECRET', isTest || process.env.NODE_ENV !== 'production' ? 'dev-only-secret-change-me' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
