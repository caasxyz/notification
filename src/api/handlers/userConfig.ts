import { Env } from '../../types';
import { UserConfigService as StaticUserConfigService } from '../../services/UserConfigService';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

// Get all user configurations
export async function getUserConfigsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    
    if (userId) {
      // Get configurations for specific user
      const configs = await StaticUserConfigService.getUserConfigs(env, userId);
      return new Response(
        JSON.stringify({
          success: true,
          data: configs,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      // Get all configurations (for development/admin use)
      const allConfigs = await StaticUserConfigService.getUserConfigs(env);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: allConfigs,
          meta: {
            total: allConfigs.length,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    logger.error('Failed to get user configs', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user configurations',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Create or update user configuration
export async function upsertUserConfigHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await request.json() as {
      user_id: string;
      channel_type: string;
      config_data: Record<string, unknown>;
      is_active?: boolean;
    };
    
    // Validate required fields
    if (!body.user_id || !body.channel_type || !body.config_data) {
      throw new ValidationError('Missing required fields: user_id, channel_type, config_data');
    }
    
    // Validate channel type
    const validChannels = ['webhook', 'telegram', 'lark', 'slack'];
    if (!validChannels.includes(body.channel_type)) {
      throw new ValidationError(`Invalid channel_type. Must be one of: ${validChannels.join(', ')}`);
    }
    
    // Validate config data based on channel type
    validateConfigData(body.channel_type, body.config_data);
    
    // Check if config exists
    const existing = await StaticUserConfigService.getUserConfig(
      body.user_id, 
      body.channel_type, 
      env
    );
    
    if (existing) {
      // Update existing config
      const updatedConfig = await StaticUserConfigService.updateUserConfig(
        body.user_id,
        body.channel_type,
        {
          config_data: JSON.stringify(body.config_data),
          is_active: body.is_active ?? true,
        },
        env
      );
      
      logger.info('Updated user config', { userId: body.user_id, channelType: body.channel_type });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'User configuration updated successfully',
          data: updatedConfig,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      // Create new config
      const newConfig = await StaticUserConfigService.createUserConfig(
        {
          user_id: body.user_id,
          channel_type: body.channel_type,
          config_data: JSON.stringify(body.config_data),
          is_active: body.is_active ?? true,
        },
        env
      );
      
      logger.info('Created user config', { userId: body.user_id, channelType: body.channel_type });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'User configuration created successfully',
          data: newConfig,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    logger.error('Failed to upsert user config', error);
    
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save user configuration',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Delete user configuration
export async function deleteUserConfigHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const channelType = url.searchParams.get('channel_type');
    
    if (!userId || !channelType) {
      throw new ValidationError('Missing required parameters: user_id, channel_type');
    }
    
    // Check if config exists
    const existing = await StaticUserConfigService.getUserConfig(userId, channelType, env);
    if (!existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuration not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    const deleted = await StaticUserConfigService.deleteUserConfig(userId, channelType, env);
    
    if (deleted) {
      logger.info('Deleted user config', { userId, channelType });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'User configuration deleted successfully',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      throw new Error('Failed to delete configuration');
    }
  } catch (error) {
    logger.error('Failed to delete user config', error);
    
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user configuration',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Helper function to validate config data
function validateConfigData(channelType: string, configData: Record<string, unknown>): void {
  switch (channelType) {
    case 'webhook':
      if (!configData['webhook_url'] || typeof configData['webhook_url'] !== 'string') {
        throw new ValidationError('webhook_url is required for webhook channel');
      }
      if (!configData['webhook_url'].startsWith('http://') && !configData['webhook_url'].startsWith('https://')) {
        throw new ValidationError('webhook_url must be a valid HTTP(S) URL');
      }
      break;
      
    case 'telegram':
      if (!configData['bot_token'] || typeof configData['bot_token'] !== 'string') {
        throw new ValidationError('bot_token is required for telegram channel');
      }
      if (!configData['chat_id'] || (typeof configData['chat_id'] !== 'string' && typeof configData['chat_id'] !== 'number')) {
        throw new ValidationError('chat_id is required for telegram channel');
      }
      break;
      
    case 'lark':
      if (!configData['webhook_url'] || typeof configData['webhook_url'] !== 'string') {
        throw new ValidationError('webhook_url is required for lark channel');
      }
      break;
      
    case 'slack':
      if (!configData['webhook_url'] || typeof configData['webhook_url'] !== 'string') {
        throw new ValidationError('webhook_url is required for slack channel');
      }
      break;
      
    default:
      throw new ValidationError(`Unsupported channel type: ${channelType}`);
  }
}