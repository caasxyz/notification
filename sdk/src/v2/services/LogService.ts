import { ApiClient } from '../ApiClient';
import { NotificationLog, LogQuery } from '../types';

export class LogService {
  constructor(private client: ApiClient) {}

  async query(query: LogQuery): Promise<NotificationLog[]> {
    const params = new URLSearchParams();
    
    if (query.userId !== undefined) params.set('userId', query.userId);
    if (query.templateKey !== undefined) params.set('templateKey', query.templateKey);
    if (query.channel !== undefined) params.set('channel', query.channel);
    if (query.status !== undefined) params.set('status', query.status);
    if (query.fromDate !== undefined) params.set('fromDate', query.fromDate.toString());
    if (query.toDate !== undefined) params.set('toDate', query.toDate.toString());
    if (query.limit !== undefined) params.set('limit', query.limit.toString());
    if (query.offset !== undefined) params.set('offset', query.offset.toString());
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.client.get<NotificationLog[]>(`/api/notification-logs${queryString}`);
  }

  async get(logId: string): Promise<NotificationLog> {
    return this.client.get<NotificationLog>(`/api/notification-logs/${encodeURIComponent(logId)}`);
  }

  async cleanup(beforeDate: Date | string): Promise<{ deleted: number }> {
    return this.client.delete('/api/notification-logs/cleanup', { 
      body: JSON.stringify({ beforeDate }), 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}