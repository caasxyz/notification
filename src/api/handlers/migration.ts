import { Env } from '../../types';
import { AutoMigrate } from '../../db/auto-migrate';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

/**
 * Check database schema status
 */
export async function checkSchemaHandler(
  _request: Request,
  env: Env,
): Promise<Response> {
  try {
    const { isValid, missingTables } = await AutoMigrate.checkSchema(env);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          isValid,
          missingTables,
          environment: env.ENVIRONMENT || 'unknown',
          autoMigrateEnabled: env.AUTO_MIGRATE === 'true',
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Failed to check schema', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check schema',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Run database migrations manually (for emergency use only)
 * Since auto-migration is enabled, this endpoint is rarely needed
 */
export async function runMigrationHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json() as {
      dryRun?: boolean;
      force?: boolean;
    };
    
    const { dryRun = false, force = false } = body;
    
    // Check if we're in production and not forcing
    if (env.ENVIRONMENT === 'production' && !force) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Manual migration in production requires force=true',
          note: 'Auto-migration is already enabled for this environment',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Run migrations
    const result = await AutoMigrate.migrate(env, { dryRun, force });
    
    if (result.success) {
      logger.info('Manual migration completed successfully', {
        migrationsRun: result.migrationsRun,
        dryRun,
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            migrationsRun: result.migrationsRun,
            dryRun,
            environment: env.ENVIRONMENT,
            note: 'Auto-migration is enabled, manual migration is usually not needed',
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          migrationsRun: result.migrationsRun,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    logger.error('Failed to run manual migration', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run migration',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}