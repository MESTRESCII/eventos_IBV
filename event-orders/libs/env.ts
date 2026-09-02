function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// DATABASE_URL: usado apenas por drizzle-kit (migrations), nunca em runtime de Workers
export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
} as const;
