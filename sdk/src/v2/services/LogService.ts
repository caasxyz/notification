import { ApiClient } from '../ApiClient';
import { NotificationLog, LogQuery } from '../types';

export class LogService {
  constructor(private client: ApiClient) {}

  async query(query: LogQuery): Promise<NotificationLog[]> {
    const params = new URLSearchParams();
    
    if (query.userId) params.set('userId', query.userId);
    if (query.templateKey) params.set('templateKey', query.templateKey);
    if (query.channel) params.set('channel', query.channel);
    if (query.status) params.set('status', query.status);
    if (query.fromDate) params.set('fromDate', query.fromDate.toString());
    if (query.toDate) params.set('toDate', query.toDate.toString());
    if (query.limit) params.set('limit', query.limit.toString());
    if (query.offset) params.set('offset', query.offset.toString());
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.client.get<NotificationLog[]>(`/api/notification-logs${queryString}`);
  }

  async get(logId: string): Promise<NotificationLog> {
    return this.client.get<NotificationLog>(`/api/notification-logs/${encodeURIComponent(logId)}`);
  }

  async cleanup(beforeDate: Date | string): Promise<{ deleted: number }> {
    return this.client.delete('/api/notification-logs/cleanup', { body: JSON.stringify({ beforeDate }), headers: { 'Content-Type': 'application/json' } } as any);
  }
}