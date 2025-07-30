import { eq, and, lte, gt, sql } from 'drizzle-orm';
import { getDb, idempotencyKeys } from '../db';
import { Env, DuplicateCheckResult } from '../types';
import { NotificationDispatcherV2 } from './NotificationDispatcherV2';
import { Logger } from '../utils/logger';

interface IdempotencyKeyRecord {
  idempotency_key: string;
  user_id: string;
  message_ids: string;
  expires_at: string;
  created_at: string;
}

export class IdempotencyManager {
  private static logger = Logger.getInstance();
  private static readonly DEFAULT_EXPIRE_HOURS = 24;

  static async checkDuplicate(
    idempotencyKey: string | undefined,
    userId: string,
    env: Env,
  ): Promise<DuplicateCheckResult> {
    if (!idempotencyKey) {
      return { isDuplicate: false };
    }

    try {
      const db = getDb(env);
      const now = new Date().toISOString();
      
      const results = await db
        .select({ message_ids: idempotencyKeys.message_ids })
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.idempotency_key, idempotencyKey),
            eq(idempotencyKeys.user_id, userId),
            gt(idempotencyKeys.expires_at, now)
          )
        )
        .limit(1);

      const existing = results[0];
      if (existing) {
        const messageIds = JSON.parse(existing.message_ids) as string[];
        const notificationResults = await NotificationDispatcherV2.getNotificationResults(messageIds, env);
        
        this.logger.info('Duplicate request detected via idempotency key', {
          idempotencyKey,
          userId,
          messageIds,
        });
        
        return { isDuplicate: true, results: notificationResults };
      }

      return { isDuplicate: false };
    } catch (error) {
      this.logger.error('Failed to check duplicate', error, {
        idempotencyKey,
        userId,
      });
      
      return { isDuplicate: false };
    }
  }

  static async recordIdempotencyKey(
    idempotencyKey: string,
    userId: string,
    messageIds: string[],
    env: Env,
  ): Promise<void> {
    try {
      const db = getDb(env);
      const expiresAt = new Date(Date.now() + this.DEFAULT_EXPIRE_HOURS * 60 * 60 * 1000);
      
      await db
        .insert(idempotencyKeys)
        .values({
          idempotency_key: idempotencyKey,
          user_id: userId,
          message_ids: JSON.stringify(messageIds),
          expires_at: expiresAt.toISOString(),
        });
      
      this.logger.debug('Idempotency key recorded', {
        idempotencyKey,
        userId,
        messageCount: messageIds.length,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to record idempotency key', error, {
        idempotencyKey,
        userId,
      });
    }
  }

  static async cleanupExpiredKeys(env: Env): Promise<number> {
    try {
      const db = getDb(env);
      const now = new Date().toISOString();
      
      // First count the records to be deleted
      const toDelete = await db
        .select({ count: sql<number>`count(*)` })
        .from(idempotencyKeys)
        .where(lte(idempotencyKeys.expires_at, now));
      
      const deletedCount = toDelete[0]?.count ?? 0;
      
      if (deletedCount > 0) {
        await db
          .delete(idempotencyKeys)
          .where(lte(idempotencyKeys.expires_at, now));
      }
      
      if (deletedCount > 0) {
        this.logger.info('Cleaned up expired idempotency keys', {
          deletedCount,
        });
      }
      
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired idempotency keys', error);
      return 0;
    }
  }

  static async getIdempotencyKey(
    idempotencyKey: string,
    userId: string,
    env: Env,
  ): Promise<IdempotencyKeyRecord | null> {
    try {
      const db = getDb(env);
      
      const results = await db
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.idempotency_key, idempotencyKey),
            eq(idempotencyKeys.user_id, userId)
          )
        )
        .limit(1);
      
      return results[0] || null;
    } catch (error) {
      this.logger.error('Failed to get idempotency key', error, {
        idempotencyKey,
        userId,
      });
      return null;
    }
  }

  static async extendExpiration(
    idempotencyKey: string,
    userId: string,
    additionalHours: number,
    env: Env,
  ): Promise<boolean> {
    try {
      const db = getDb(env);
      const now = new Date().toISOString();
      const newExpiresAt = new Date(Date.now() + additionalHours * 60 * 60 * 1000);
      
      await db
        .update(idempotencyKeys)
        .set({ expires_at: newExpiresAt.toISOString() })
        .where(
          and(
            eq(idempotencyKeys.idempotency_key, idempotencyKey),
            eq(idempotencyKeys.user_id, userId),
            gt(idempotencyKeys.expires_at, now)
          )
        );
      
      // Check if the update was successful
      const check = await db
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.idempotency_key, idempotencyKey),
            eq(idempotencyKeys.user_id, userId),
            eq(idempotencyKeys.expires_at, newExpiresAt.toISOString())
          )
        )
        .limit(1);
      
      const updated = check.length > 0;
      
      if (updated) {
        this.logger.info('Extended idempotency key expiration', {
          idempotencyKey,
          userId,
          newExpiresAt: newExpiresAt.toISOString(),
        });
      }
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to extend idempotency key expiration', error, {
        idempotencyKey,
        userId,
      });
      return false;
    }
  }

  static async getStats(env: Env): Promise<{
    totalKeys: number;
    expiredKeys: number;
    activeKeys: number;
  }> {
    try {
      const db = getDb(env);
      const now = new Date().toISOString();
      
      // Since Drizzle doesn't support aggregate functions in a single query for this case,
      // we'll use raw SQL via the sql template
      const result = await db.get<{
        totalKeys: number;
        expiredKeys: number;
        activeKeys: number;
      }>(sql`
        SELECT 
          COUNT(*) as totalKeys,
          COUNT(CASE WHEN expires_at <= ${now} THEN 1 END) as expiredKeys,
          COUNT(CASE WHEN expires_at > ${now} THEN 1 END) as activeKeys
        FROM idempotency_keys
      `);
      
      return result || { totalKeys: 0, expiredKeys: 0, activeKeys: 0 };
    } catch (error) {
      this.logger.error('Failed to get idempotency stats', error);
      return { totalKeys: 0, expiredKeys: 0, activeKeys: 0 };
    }
  }
}