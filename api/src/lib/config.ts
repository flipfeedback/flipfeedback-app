import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// In production a missing JWT_SECRET is fatal; in dev/test we allow a clearly
// labelled default so the app boots without ceremony. No secret is ever committed.
const isProd = process.env.NODE_ENV === 'production';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', isProd ? undefined : 'postgresql://flipfeedback:flipfeedback@localhost:5432/flipfeedback?schema=public'),
  jwtSecret: isProd
    ? required('JWT_SECRET')
    : process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  // Comma-separated list of allowed web origins for CORS.
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
};
