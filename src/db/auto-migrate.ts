import { sql } from 'drizzle-orm';
import { getDb } from './index';
import { Logger } from '../utils/logger';
import type { Env } from '../types';

const logger = Logger.getInstance();

/**
 * Auto-migrate database schema on startup
 * WARNING: This should be used with caution in production
 */
export class AutoMigrate {
  private static readonly MIGRATION_TABLE = 'schema_migrations';
  
  /**
   * Check if migrations table exists
   */
  private static async checkMigrationsTable(env: Env): Promise<boolean> {
    try {
      const db = getDb(env);
      const result = await db.get(sql`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=${this.MIGRATION_TABLE}
      `);
      return !!result;
    } catch (error) {
      logger.error('Failed to check migrations table', error);
      return false;
    }
  }

  /**
   * Create migrations tracking table
   */
  private static async createMigrationsTable(env: Env): Promise<void> {
    const db = getDb(env);
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(this.MIGRATION_TABLE)} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get list of executed migrations
   */
  private static async getExecutedMigrations(env: Env): Promise<string[]> {
    const db = getDb(env);
    const results = await db.all<{ name: string }>(sql`
      SELECT name FROM ${sql.identifier(this.MIGRATION_TABLE)} ORDER BY id
    `);
    return results.map(r => r.name);
  }

  /**
   * Record migration as executed
   */
  private static async recordMigration(env: Env, name: string): Promise<void> {
    const db = getDb(env);
    await db.run(sql`
      INSERT INTO ${sql.identifier(this.MIGRATION_TABLE)} (name) VALUES (${name})
    `);
  }

  /**
   * Define all migrations
   */
  private static getMigrations(): Array<{
    name: string;
    up: (env: Env) => Promise<void>;
  }> {
    return [
      {
        name: '001_initial_schema',
        up: async (env: Env) => {
          const db = getDb(env);
          
          // Create user_configs table
          await db.run(sql`
            CREATE TABLE IF NOT EXISTS user_configs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              channel_type TEXT NOT NULL,
              config_data TEXT NOT NULL,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, channel_type)
            )
          `);
          
          // Create indexes
          await db.run(sql`
            CREATE INDEX IF NOT EXISTS idx_user_channel 
            ON user_configs(user_id, channel_type)
          `);
          
          // Create notification_templates_v2 table
          await db.run(sql`
            CREATE TABLE IF NOT EXISTS notification_templates_v2 (
              template_key TEXT PRIMARY KEY,
              template_name TEXT NOT NULL,
              description TEXT,
              variables TEXT,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          // Create template_contents table
          await db.run(sql`
            CREATE TABLE IF NOT EXISTS template_contents (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              template_key TEXT NOT NULL,
              channel_type TEXT NOT NULL,
              content_type TEXT NOT NULL,
              subject_template TEXT,
              content_template TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (template_key) REFERENCES notification_templates_v2(template_key),
              UNIQUE(template_key, channel_type)
            )
          `);
          
          // Create notification_logs table
          await db.run(sql`
            CREATE TABLE IF NOT EXISTS notification_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              message_id TEXT NOT NULL UNIQUE,
              user_id TEXT NOT NULL,
              channel_type TEXT NOT NULL,
              template_key TEXT,
              subject TEXT,
              content TEXT,
              status TEXT NOT NULL,
              sent_at TEXT,
              error TEXT,
              retry_count INTEGER NOT NULL DEFAULT 0,
              request_id TEXT,
              variables TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          // Create indexes for notification_logs
          await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_user ON notification_logs(user_id)`);
          await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_status ON notification_logs(status)`);
          await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_created ON notification_logs(created_at)`);
          await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_request_id ON notification_logs(request_id)`);
          
          // Create system_configs table
          await db.run(sql`
            CREATE TABLE IF NOT EXISTS system_configs (
              config_key TEXT PRIMARY KEY,
              config_value TEXT NOT NULL,
              description TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          // Create idempotency_keys table
          await db.run(sql`
            CREATE TABLE IF NOT EXISTS idempotency_keys (
              idempotency_key TEXT NOT NULL,
              user_id TEXT NOT NULL,
              message_ids TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (idempotency_key, user_id)
            )
          `);
          
          // Create task_execution_records table
          await db.run(sql`
            CREATE TABLE IF NOT EXISTS task_execution_records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              task_name TEXT NOT NULL,
              execution_time TEXT NOT NULL,
              status TEXT NOT NULL,
              error TEXT,
              duration_ms INTEGER,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          await db.run(sql`CREATE INDEX IF NOT EXISTS idx_task_execution_time ON task_execution_records(execution_time)`);
          await db.run(sql`CREATE INDEX IF NOT EXISTS idx_task_name_time ON task_execution_records(task_name, execution_time)`);
        },
      },
      {
        name: '002_add_metadata_to_user_configs',
        up: async (env: Env) => {
          const db = getDb(env);
          
          // Check if column already exists
          const tableInfo = await db.all<{ name: string }>(sql`
            PRAGMA table_info(user_configs)
          `);
          
          const hasMetadata = tableInfo.some(col => col.name === 'metadata');
          
          if (!hasMetadata) {
            // SQLite doesn't support ADD COLUMN easily, so we need to recreate the table
            // In production, you might want to use a more sophisticated approach
            
            // For now, we'll log a warning
            logger.warn('Migration 002: Adding metadata column would require table recreation in SQLite');
            // In a real scenario, you would:
            // 1. Create a new table with the new schema
            // 2. Copy data from old table
            // 3. Drop old table
            // 4. Rename new table
          }
        },
      },
      {
        name: '003_fix_task_execution_records',
        up: async (env: Env) => {
          const db = getDb(env);
          
          // Add missing duration_ms column to task_execution_records table
          // SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS
          // So we need to check if the column exists first
          try {
            // Try to query the column
            await db.run(sql`SELECT duration_ms FROM task_execution_records LIMIT 0`);
            // If we get here, the column exists
            logger.info('Column duration_ms already exists in task_execution_records');
          } catch (error) {
            // Column doesn't exist, add it
            logger.info('Adding duration_ms column to task_execution_records');
            await db.run(sql`ALTER TABLE task_execution_records ADD COLUMN duration_ms INTEGER`);
          }
          
          // Also remove the unused 'details' column if it exists and migrate data to 'error' column
          try {
            const hasDetails = await db.run(sql`SELECT details FROM task_execution_records LIMIT 0`);
            // If we have details column, migrate data to error column
            logger.info('Migrating details column data to error column');
            await db.run(sql`UPDATE task_execution_records SET error = details WHERE error IS NULL AND details IS NOT NULL`);
            // Note: SQLite doesn't support DROP COLUMN in older versions
            // The details column will remain but unused
          } catch (error) {
            // Details column doesn't exist, which is fine
            logger.info('Details column does not exist, skipping migration');
          }
        },
      },
    ];
  }

  /**
   * Run auto-migration
   */
  static async migrate(env: Env, options?: { 
    dryRun?: boolean;
    force?: boolean;
  }): Promise<{
    success: boolean;
    migrationsRun: string[];
    error?: string;
  }> {
    const { dryRun = false, force = false } = options || {};
    const migrationsRun: string[] = [];
    
    try {
      // Check if we should run migrations
      if (!force && env.ENVIRONMENT === 'production') {
        logger.warn('Auto-migration is disabled in production. Use force=true to override.');
        return { success: false, migrationsRun, error: 'Auto-migration disabled in production' };
      }
      
      // Ensure migrations table exists
      const hasMigrationsTable = await this.checkMigrationsTable(env);
      if (!hasMigrationsTable) {
        logger.info('Creating migrations table...');
        if (!dryRun) {
          await this.createMigrationsTable(env);
        }
      }
      
      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations(env);
      const allMigrations = this.getMigrations();
      
      // Find pending migrations
      const pendingMigrations = allMigrations.filter(
        m => !executedMigrations.includes(m.name)
      );
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return { success: true, migrationsRun };
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migrations`);
      
      // Run migrations
      for (const migration of pendingMigrations) {
        logger.info(`Running migration: ${migration.name}`);
        
        if (!dryRun) {
          try {
            await migration.up(env);
            await this.recordMigration(env, migration.name);
            migrationsRun.push(migration.name);
            logger.info(`✅ Migration ${migration.name} completed`);
          } catch (error) {
            logger.error(`❌ Migration ${migration.name} failed`, error);
            throw error;
          }
        } else {
          logger.info(`[DRY RUN] Would run migration: ${migration.name}`);
          migrationsRun.push(migration.name);
        }
      }
      
      return { success: true, migrationsRun };
    } catch (error) {
      logger.error('Auto-migration failed', error);
      return { 
        success: false, 
        migrationsRun, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check if all tables exist (quick health check)
   */
  static async checkSchema(env: Env): Promise<{
    isValid: boolean;
    missingTables: string[];
  }> {
    const requiredTables = [
      'user_configs',
      'notification_templates_v2',
      'template_contents',
      'notification_logs',
      'system_configs',
      'idempotency_keys',
      'task_execution_records',
    ];
    
    const missingTables: string[] = [];
    
    try {
      const db = getDb(env);
      
      for (const tableName of requiredTables) {
        const result = await db.get(sql`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=${tableName}
        `);
        
        if (!result) {
          missingTables.push(tableName);
        }
      }
      
      return {
        isValid: missingTables.length === 0,
        missingTables,
      };
    } catch (error) {
      logger.error('Failed to check schema', error);
      return { isValid: false, missingTables: requiredTables };
    }
  }
}

// Export a helper function for easy use
export async function ensureDatabase(env: Env, options?: {
  autoMigrate?: boolean;
  force?: boolean;
}): Promise<void> {
  const { autoMigrate = true, force = false } = options || {};
  
  // Quick schema check
  const { isValid, missingTables } = await AutoMigrate.checkSchema(env);
  
  if (!isValid) {
    logger.warn(`Schema validation failed. Missing tables: ${missingTables.join(', ')}`);
    
    if (autoMigrate) {
      logger.info('Running auto-migration...');
      const result = await AutoMigrate.migrate(env, { force });
      
      if (!result.success) {
        throw new Error(`Auto-migration failed: ${result.error}`);
      }
      
      logger.info(`Auto-migration completed. Migrations run: ${result.migrationsRun.join(', ')}`);
    } else {
      throw new Error('Database schema is not valid. Please run migrations.');
    }
  }
}