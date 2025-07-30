import { Env } from '../types';
import { ensureDatabase } from '../db/auto-migrate';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

// Cache to track if we've already initialized the database in this worker instance
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Middleware to ensure database is initialized
 */
export async function withDatabaseInit(
  env: Env,
  handler: () => Promise<Response>
): Promise<Response> {
  // If already initialized, proceed directly
  if (isInitialized) {
    return handler();
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    try {
      await initializationPromise;
      return handler();
    } catch (error) {
      logger.error('Database initialization failed', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database initialization failed',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      logger.info('Initializing database...');
      
      // Configure based on environment
      const options = {
        autoMigrate: env.AUTO_MIGRATE === 'true' || env.ENVIRONMENT !== 'production',
        force: env.FORCE_MIGRATE === 'true',
      };
      
      await ensureDatabase(env, options);
      
      isInitialized = true;
      logger.info('Database initialization completed');
    } catch (error) {
      logger.error('Database initialization error', error);
      throw error;
    }
  })();

  try {
    await initializationPromise;
    return handler();
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Database initialization failed',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    initializationPromise = null;
  }
}

/**
 * Reset initialization state (useful for testing)
 */
export function resetDatabaseInit(): void {
  isInitialized = false;
  initializationPromise = null;
}