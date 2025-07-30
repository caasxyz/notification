/**
 * Grafana Webhook Types
 * 
 * Type definitions for Grafana Alerting webhook payloads
 * Based on Grafana Alerting v9+ webhook format
 */

export interface GrafanaAlert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
  silenceURL?: string;
  dashboardURL?: string;
  panelURL?: string;
  values?: Record<string, number>;
}

export interface GrafanaWebhookPayload {
  receiver: string; // This will be used as user_id
  status: 'firing' | 'resolved';
  alerts: GrafanaAlert[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
  truncatedAlerts?: number;
  orgId?: number;
  title?: string;
  state?: string;
  message?: string;
}

export interface GrafanaNotificationData {
  template_key?: string;
  variables: Record<string, any>;
  custom_content?: {
    subject: string;
    content: string;
  };
}