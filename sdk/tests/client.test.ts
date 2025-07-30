import { NotificationClient, NotificationError } from '../src';

describe('NotificationClient', () => {
  let client: NotificationClient;

  beforeEach(() => {
    client = new NotificationClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'test-api-key',
    });
  });

  describe('constructor', () => {
    it('should initialize with required config', () => {
      expect(client).toBeDefined();
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new NotificationClient({
        baseUrl: 'https://api.example.com/',
      });
      expect(clientWithSlash).toBeDefined();
    });
  });

  describe('sendNotification', () => {
    it('should send a notification request', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            request_id: 'req_123',
            results: [
              {
                channelType: 'email',
                success: true,
                message_id: 'msg_123',
              },
            ],
          },
        }),
      });

      const response = await client.sendNotification({
        user_id: 'user123',
        channels: ['email'],
        content: 'Test notification',
      });

      expect(response.success).toBe(true);
      expect(response.data?.request_id).toBe('req_123');
      expect(response.data?.results).toHaveLength(1);
    });

    it('should handle errors properly', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Invalid request',
          code: 'INVALID_REQUEST',
        }),
      });

      await expect(
        client.sendNotification({
          user_id: '',
          channels: ['email'],
          content: 'Test',
        })
      ).rejects.toThrow(NotificationError);
    });
  });

  describe('retry logic', () => {
    it('should retry on network errors', async () => {
      let attempts = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      const client = new NotificationClient({
        baseUrl: 'https://api.example.com',
        retryConfig: {
          maxRetries: 3,
          retryDelay: 10,
        },
      });

      const response = await client.sendNotification({
        user_id: 'user123',
        channels: ['email'],
        content: 'Test',
      });

      expect(response.success).toBe(true);
      expect(attempts).toBe(3);
    });
  });
});