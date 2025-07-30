import { ApiClient } from '../ApiClient';
import { ChannelType, ChannelConfig } from '../types';

export class ConfigService {
  constructor(private client: ApiClient) {}

  async set(userId: string, channel: ChannelType, config: ChannelConfig): Promise<{ success: boolean }> {
    // The actual API uses POST /api/user-configs not PUT
    return this.client.post(
      '/api/user-configs',
      { user_id: userId, channel_type: channel, ...config }
    );
  }

  async get(userId: string, channel: ChannelType): Promise<ChannelConfig> {
    // The actual API uses query params
    return this.client.get<ChannelConfig>(
      `/api/user-configs?userId=${encodeURIComponent(userId)}&channelType=${channel}`
    );
  }

  async list(userId: string): Promise<ChannelConfig[]> {
    // The actual API uses query params
    return this.client.get<ChannelConfig[]>(
      `/api/user-configs?userId=${encodeURIComponent(userId)}`
    );
  }

  async delete(userId: string, channel: ChannelType): Promise<{ success: boolean }> {
    // The actual API uses query params
    return this.client.delete(
      `/api/user-configs?userId=${encodeURIComponent(userId)}&channelType=${channel}`
    );
  }

  activate(_userId: string, _channel: ChannelType): Promise<{ success: boolean }> {
    // Note: Activate endpoint not implemented in the actual API
    return Promise.reject(new Error('Config activate endpoint not implemented in the server'));
  }

  deactivate(_userId: string, _channel: ChannelType): Promise<{ success: boolean }> {
    // Note: Deactivate endpoint not implemented in the actual API
    return Promise.reject(new Error('Config deactivate endpoint not implemented in the server'));
  }
}