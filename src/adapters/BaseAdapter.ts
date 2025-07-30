import { NotificationConfig, NotificationSystemError } from '../types';
import { Logger } from '../utils/logger';

export abstract class BaseAdapter {
  protected logger = Logger.getInstance();

  abstract send(config: NotificationConfig, content: string, subject?: string): Promise<unknown>;

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = 30000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new NotificationSystemError(
          `HTTP ${response.status}: ${errorText}`,
          'HTTP_ERROR',
          response.status >= 500 || response.status === 429,
        );
      }

      return response;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new NotificationSystemError(
          'Request timeout',
          'TIMEOUT_ERROR',
          true,
        );
      }
      
      if (error instanceof NotificationSystemError) {
        throw error;
      }

      throw new NotificationSystemError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_ERROR',
        true,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected handleError(error: unknown, channelType: string): never {
    if (error instanceof NotificationSystemError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`${channelType} adapter error`, error);

    throw new NotificationSystemError(
      `${channelType} send failed: ${message}`,
      `${channelType.toUpperCase()}_ERROR`,
      true,
    );
  }
}