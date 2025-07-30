import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    // For local development
    wranglerConfigPath: './wrangler.toml',
    dbName: process.env.DB_NAME || 'notification-system',
  },
  verbose: true,
  strict: true,
});