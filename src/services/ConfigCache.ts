import { eq, and } from 'drizzle-orm';
import { getDb, userConfigs, systemConfigs } from '../db';
import { Env } from '../types';
import { Logger } from '../utils/logger';
import { ValidationUtils } from '../utils/validation';

interface ParsedUserConfig {
  id: number;
  user_id: string;
  channel_type: string;
  config_data: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ConfigCache {
  private static logger = Logger.getInstance();
  private static readonly DEFAULT_TTL = 300; // 5 minutes

  static async getUserConfig(
    userId: string,
    channelType: string,
    env: Env,
  ): Promise<ParsedUserConfig | null> {
    const cacheKey = `user_config:${userId}:${channelType}`;

    try {
      const cached = await env.CONFIG_CACHE.get(cacheKey);
      if (cached) {
        const config = ValidationUtils.parseJsonSafe<ParsedUserConfig>(cached);
        if (config) {
          this.logger.debug('User config cache hit', { cacheKey });
          return config;
        }
      }
    } catch (error) {
      this.logger.warn('User config cache read failed', { error, cacheKey });
    }

    try {
      const db = getDb(env);
      const results = await db
        .select()
        .from(userConfigs)
        .where(
          and(
            eq(userConfigs.user_id, userId),
            eq(userConfigs.channel_type, channelType),
            eq(userConfigs.is_active, true)
          )
        )
        .limit(1);

      const config = results[0];
      if (config) {
        const parsedConfig: ParsedUserConfig = {
          ...config,
          config_data: JSON.parse(config.config_data),
        };
        await this.setCache(cacheKey, parsedConfig, env);
        return parsedConfig;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get user config', error, { userId, channelType });
      return null;
    }
  }

  static async setUserConfig(
    userId: string,
    channelType: string,
    config: ParsedUserConfig,
    env: Env,
  ): Promise<void> {
    const cacheKey = `user_config:${userId}:${channelType}`;
    await this.setCache(cacheKey, config, env);
  }

  static async invalidateUserConfig(
    userId: string,
    env: Env,
    channelType?: string,
  ): Promise<void> {
    if (channelType) {
      const cacheKey = `user_config:${userId}:${channelType}`;
      await this.deleteCache(cacheKey, env);
    } else {
      const channels = ['webhook', 'telegram', 'lark', 'slack'];
      const deletePromises = channels.map((channel) =>
        this.deleteCache(`user_config:${userId}:${channel}`, env),
      );
      await Promise.all(deletePromises);
    }
  }

  static async getSystemConfig(
    configKey: string,
    env: Env,
  ): Promise<string | null> {
    const cacheKey = `system_config:${configKey}`;

    try {
      const cached = await env.CONFIG_CACHE.get(cacheKey);
      if (cached) {
        this.logger.debug('System config cache hit', { cacheKey });
        return cached;
      }
    } catch (error) {
      this.logger.warn('System config cache read failed', { error, cacheKey });
    }

    try {
      const db = getDb(env);
      const results = await db
        .select({ config_value: systemConfigs.config_value })
        .from(systemConfigs)
        .where(eq(systemConfigs.config_key, configKey))
        .limit(1);

      const config = results[0];
      if (config) {
        await this.setCache(cacheKey, config.config_value, env);
        return config.config_value;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get system config', error, { configKey });
      return null;
    }
  }

  static async setSystemConfig(
    configKey: string,
    configValue: string,
    env: Env,
  ): Promise<void> {
    const cacheKey = `system_config:${configKey}`;
    await this.setCache(cacheKey, configValue, env);
  }

  static async invalidateSystemConfig(configKey: string, env: Env): Promise<void> {
    const cacheKey = `system_config:${configKey}`;
    await this.deleteCache(cacheKey, env);
  }

  static async invalidateAllCaches(_env: Env): Promise<void> {
    this.logger.info('Invalidating all caches');
  }

  private static async setCache<T>(
    key: string,
    value: T,
    env: Env,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<void> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await env.CONFIG_CACHE.put(key, serialized, { expirationTtl: ttl });
      this.logger.debug('Cache set', { key, ttl });
    } catch (error) {
      this.logger.error('Failed to set cache', error, { key });
    }
  }

  private static async deleteCache(key: string, env: Env): Promise<void> {
    try {
      await env.CONFIG_CACHE.delete(key);
      this.logger.debug('Cache deleted', { key });
    } catch (error) {
      this.logger.error('Failed to delete cache', error, { key });
    }
  }

  static async warmupCache(userId: string, env: Env): Promise<void> {
    try {
      const db = getDb(env);
      const configs = await db
        .select()
        .from(userConfigs)
        .where(
          and(
            eq(userConfigs.user_id, userId),
            eq(userConfigs.is_active, true)
          )
        );

      if (configs.length > 0) {
        const cachePromises = configs.map((config) => {
          const parsedConfig: ParsedUserConfig = {
            ...config,
            config_data: JSON.parse(config.config_data),
          };
          return this.setUserConfig(userId, config.channel_type, parsedConfig, env);
        });
        await Promise.all(cachePromises);
        
        this.logger.info('Cache warmed up for user', {
          userId,
          configCount: configs.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to warmup cache', error, { userId });
    }
  }

  static async getCacheStats(env: Env): Promise<{
    estimatedSize: number;
    keyCount: number;
  }> {
    try {
      const list = await env.CONFIG_CACHE.list({ limit: 1000 });
      
      return {
        estimatedSize: 0,
        keyCount: list.keys.length,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      return { estimatedSize: 0, keyCount: 0 };
    }
  }

  static async batchGetUserConfigs(
    userId: string,
    channelTypes: string[],
    env: Env,
  ): Promise<Map<string, ParsedUserConfig>> {
    const configs = new Map<string, ParsedUserConfig>();

    const cachePromises = channelTypes.map(async (channelType) => {
      const config = await this.getUserConfig(userId, channelType, env);
      if (config) {
        configs.set(channelType, config);
      }
    });

    await Promise.all(cachePromises);
    
    return configs;
  }
}