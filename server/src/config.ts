import 'dotenv/config';

const env = process.env.NODE_ENV ?? 'development';
const isProd = env === 'production';

function read(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const config = {
  env,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: read('MONGO_URI', isProd ? undefined : 'mongodb://127.0.0.1:27017/teamflow'),
  jwtSecret: read('JWT_SECRET', isProd ? undefined : 'dev-only-secret-change-me'),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as `${number}d` | `${number}h`,
  /** Create the demo workspace on boot if it is missing (handy on hosts without a shell). */
  seedDemo: process.env.SEED_DEMO === 'true',
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
} as const;
