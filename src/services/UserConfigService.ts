import { eq, and } from 'drizzle-orm';
import { getDb, userConfigs, type UserConfig, type NewUserConfig } from '../db';
import { Env } from '../types';
import { Logger } from '../utils/logger';
import { ConfigCache } from './ConfigCache';

interface ParsedUserConfig extends Omit<UserConfig, 'config_data'> {
  config_data: any;
}

export class UserConfigService {
  private static logger = Logger.getInstance();

  static async getUserConfig(
    userId: string,
    channelType: string,
    env: Env
  ): Promise<ParsedUserConfig | null> {
    try {
      // Try cache first
      const cached = await ConfigCache.getUserConfig(userId, channelType, env);
      if (cached) {
        return cached;
      }

      // Query from database using Drizzle
      const db = getDb(env);
      const result = await db
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

      const config = result[0] || null;
      
      if (config) {
        const parsedConfig = {
          ...config,
          config_data: JSON.parse(config.config_data),
        };
        await ConfigCache.setUserConfig(userId, channelType, parsedConfig, env);
        return parsedConfig;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get user config', error);
      throw error;
    }
  }

  static async createUserConfig(
    data: Omit<NewUserConfig, 'id' | 'created_at' | 'updated_at'>,
    env: Env
  ): Promise<ParsedUserConfig> {
    try {
      const db = getDb(env);
      
      // Insert new config
      const result = await db
        .insert(userConfigs)
        .values({
          user_id: data.user_id,
          channel_type: data.channel_type,
          config_data: typeof data.config_data === 'string' ? data.config_data : JSON.stringify(data.config_data),
          is_active: data.is_active ?? true,
        })
        .returning();

      const newConfig = result[0];
      if (!newConfig) {
        throw new Error('Failed to create user config');
      }
      
      // Parse the config data before returning
      const parsedConfig: ParsedUserConfig = {
        ...newConfig,
        config_data: JSON.parse(newConfig.config_data),
      };
      
      // Update cache
      await ConfigCache.setUserConfig(parsedConfig.user_id, parsedConfig.channel_type, parsedConfig, env);
      
      this.logger.info('Created user config', { 
        userId: parsedConfig.user_id, 
        channelType: parsedConfig.channel_type 
      });
      
      return parsedConfig;
    } catch (error) {
      this.logger.error('Failed to create user config', error);
      throw error;
    }
  }

  static async updateUserConfig(
    userId: string,
    channelType: string,
    updates: Partial<Omit<UserConfig, 'id' | 'user_id' | 'channel_type' | 'created_at'>>,
    env: Env
  ): Promise<ParsedUserConfig | null> {
    try {
      const db = getDb(env);
      
      // Update config
      const result = await db
        .update(userConfigs)
        .set({
          ...updates,
          config_data: updates.config_data ? (typeof updates.config_data === 'string' ? updates.config_data : JSON.stringify(updates.config_data)) : undefined,
          updated_at: new Date().toISOString(),
        })
        .where(
          and(
            eq(userConfigs.user_id, userId),
            eq(userConfigs.channel_type, channelType)
          )
        )
        .returning();

      const updatedConfig = result[0] || null;
      
      if (updatedConfig) {
        // Invalidate cache
        await ConfigCache.invalidateUserConfig(userId, env, channelType);
        
        // Parse the config data before returning
        const parsedConfig = {
          ...updatedConfig,
          config_data: JSON.parse(updatedConfig.config_data),
        };
        
        this.logger.info('Updated user config', { 
          userId, 
          channelType 
        });
        
        return parsedConfig;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to update user config', error);
      throw error;
    }
  }

  static async deleteUserConfig(
    userId: string,
    channelType: string,
    env: Env
  ): Promise<boolean> {
    try {
      const db = getDb(env);
      
      // Delete config
      await db
        .delete(userConfigs)
        .where(
          and(
            eq(userConfigs.user_id, userId),
            eq(userConfigs.channel_type, channelType)
          )
        );

      // Invalidate cache
      await ConfigCache.invalidateUserConfig(userId, env, channelType);
      
      this.logger.info('Deleted user config', { 
        userId, 
        channelType 
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to delete user config', error);
      throw error;
    }
  }

  static async getUserConfigs(
    env: Env,
    userId?: string
  ): Promise<ParsedUserConfig[]> {
    try {
      const db = getDb(env);
      
      const configs = userId
        ? await db.select().from(userConfigs).where(eq(userConfigs.user_id, userId))
        : await db.select().from(userConfigs);
      
      // Parse config_data for each config
      return configs.map(config => ({
        ...config,
        config_data: JSON.parse(config.config_data),
      }));
    } catch (error) {
      this.logger.error('Failed to get user configs', error);
      throw error;
    }
  }
}