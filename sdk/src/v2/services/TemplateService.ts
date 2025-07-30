import { ApiClient } from '../ApiClient';
import {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ChannelType
} from '../types';

export class TemplateService {
  constructor(private client: ApiClient) {}

  /**
   * Get all templates
   */
  async list(options?: {
    isActive?: boolean;
    channel?: ChannelType;
    limit?: number;
    offset?: number;
  }): Promise<Template[]> {
    const params = new URLSearchParams();
    
    if (options?.isActive !== undefined) {
      params.set('isActive', options.isActive.toString());
    }
    if (options?.channel !== undefined) {
      params.set('channel', options.channel);
    }
    if (options?.limit !== undefined && options.limit !== 0) {
      params.set('limit', options.limit.toString());
    }
    if (options?.offset !== undefined && options.offset !== 0) {
      params.set('offset', options.offset.toString());
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.client.get<Template[]>(`/api/templates${query}`);
  }

  /**
   * Get a template by key
   */
  async get(key: string): Promise<Template> {
    return this.client.get<Template>(`/api/templates/${encodeURIComponent(key)}`);
  }

  /**
   * Create a new template
   */
  async create(template: CreateTemplateRequest): Promise<Template> {
    // The actual API uses POST /api/templates with key in body
    return this.client.post<Template>('/api/templates', template);
  }

  /**
   * Update an existing template
   */
  async update(key: string, updates: UpdateTemplateRequest): Promise<Template> {
    // The actual API uses POST not PUT for updates
    return this.client.post<Template>(
      `/api/templates/${encodeURIComponent(key)}`,
      updates
    );
  }

  /**
   * Delete a template
   */
  async delete(key: string): Promise<{ success: boolean }> {
    return this.client.delete(`/api/templates/${encodeURIComponent(key)}`);
  }

  /**
   * Activate a template
   * Note: This endpoint is not implemented in the actual API
   */
  activate(_key: string): Promise<Template> {
    return Promise.reject(new Error('Template activate endpoint not implemented in the server'));
  }

  /**
   * Deactivate a template
   * Note: This endpoint is not implemented in the actual API
   */
  deactivate(_key: string): Promise<Template> {
    return Promise.reject(new Error('Template deactivate endpoint not implemented in the server'));
  }

  /**
   * Preview template rendering
   * Note: This endpoint is not implemented in the actual API
   */
  preview(
    _key: string,
    _variables: Record<string, unknown>,
    _channel?: ChannelType
  ): Promise<{
    subject?: string;
    content: string;
    contentType: string;
  }> {
    return Promise.reject(new Error('Template preview endpoint not implemented in the server'));
  }

  /**
   * Validate template syntax
   * Note: This endpoint is not implemented in the actual API
   */
  validate(_template: CreateTemplateRequest): Promise<{
    valid: boolean;
    errors?: Array<{
      channel: ChannelType;
      field: string;
      message: string;
    }>;
  }> {
    return Promise.reject(new Error('Template validate endpoint not implemented in the server'));
  }

  /**
   * Clone an existing template
   * Note: This endpoint is not implemented in the actual API
   */
  clone(
    _sourceKey: string,
    _targetKey: string,
    _options?: {
      name?: string;
      description?: string;
    }
  ): Promise<Template> {
    return Promise.reject(new Error('Template clone endpoint not implemented in the server'));
  }

  /**
   * Get template usage statistics
   * Note: This endpoint is not implemented in the actual API
   */
  getStats(_key: string, _options?: {
    fromDate?: Date | string;
    toDate?: Date | string;
  }): Promise<{
    totalSent: number;
    successRate: number;
    channelBreakdown: Record<ChannelType, {
      sent: number;
      failed: number;
    }>;
    dailyStats: Array<{
      date: string;
      sent: number;
      failed: number;
    }>;
  }> {
    return Promise.reject(new Error('Template stats endpoint not implemented in the server'));
  }

  /**
   * Bulk operations
   */
  bulk = {
    /**
     * Create multiple templates at once
     */
    create: (_templates: CreateTemplateRequest[]): Promise<{
      created: Template[];
      failed: Array<{
        template: CreateTemplateRequest;
        error: string;
      }>;
    }> => {
      // Note: Bulk create endpoint not implemented in the actual API
      return Promise.reject(new Error('Template bulk create endpoint not implemented in the server'));
    },

    /**
     * Update multiple templates at once
     */
    update: (_updates: Array<{
      key: string;
      updates: UpdateTemplateRequest;
    }>): Promise<{
      updated: Template[];
      failed: Array<{
        key: string;
        error: string;
      }>;
    }> => {
      // Note: Bulk update endpoint not implemented in the actual API
      return Promise.reject(new Error('Template bulk update endpoint not implemented in the server'));
    },

    /**
     * Delete multiple templates at once
     */
    delete: (_keys: string[]): Promise<{
      deleted: string[];
      failed: Array<{
        key: string;
        error: string;
      }>;
    }> => {
      // Note: Bulk delete endpoint not implemented in the actual API
      return Promise.reject(new Error('Template bulk delete endpoint not implemented in the server'));
    }
  };
}