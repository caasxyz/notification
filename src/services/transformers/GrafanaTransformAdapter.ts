import { GrafanaWebhookPayload, GrafanaAlert, GrafanaNotificationData } from '../../types/grafana';
import { Logger } from '../../utils/logger';

/**
 * GrafanaTransformAdapter
 * 
 * Transforms Grafana alert webhook payloads into notification system format
 */
export class GrafanaTransformAdapter {
  private static logger = Logger.getInstance();

  /**
   * Transform Grafana webhook payload to notification data
   */
  transform(payload: GrafanaWebhookPayload): GrafanaNotificationData {
    try {
      // Determine if we should use a template or custom content
      const useTemplate = this.shouldUseTemplate(payload);
      
      if (useTemplate) {
        return this.transformToTemplate(payload);
      } else {
        return this.transformToCustomContent(payload);
      }
    } catch (error) {
      GrafanaTransformAdapter.logger.error('Failed to transform Grafana payload', error);
      throw error;
    }
  }

  /**
   * Check if we should use a predefined template
   */
  private shouldUseTemplate(payload: GrafanaWebhookPayload): boolean {
    // Use template if there's a specific label indicating template preference
    // Check commonLabels first
    if (payload.commonLabels?.['notification_template']) {
      return true;
    }
    
    // Check if any alert has a notification_template label
    if (payload.alerts && payload.alerts.length > 0) {
      return payload.alerts.some(alert => !!alert.labels['notification_template']);
    }
    
    return false;
  }

  /**
   * Transform to template-based notification
   */
  private transformToTemplate(payload: GrafanaWebhookPayload): GrafanaNotificationData {
    // Try to get template from commonLabels first
    let templateKey = payload.commonLabels?.['notification_template'];
    
    // If not in commonLabels, try to get from first alert that has it
    if (!templateKey && payload.alerts && payload.alerts.length > 0) {
      for (const alert of payload.alerts) {
        if (alert.labels['notification_template']) {
          templateKey = alert.labels['notification_template'];
          break;
        }
      }
    }
    
    // Default to grafana-alert if no template specified
    templateKey = templateKey || 'grafana-alert';
    
    // Extract all relevant variables for the template
    const variables: Record<string, any> = {
      status: payload.status,
      alertCount: payload.alerts.length,
      groupKey: payload.groupKey,
      externalURL: payload.externalURL,
      ...this.extractCommonVariables(payload),
    };
    
    // For templates, we typically want the first alert's variables at the root level
    if (payload.alerts && payload.alerts.length > 0) {
      const firstAlert = payload.alerts[0];
      // Add alert-specific variables at root level for template access
      variables.alertname = firstAlert.labels['alertname'] || 'Unknown';
      variables.severity = firstAlert.labels['severity'] || 'info';
      variables.summary = firstAlert.annotations['summary'] || '';
      variables.description = firstAlert.annotations['description'] || '';
      variables.service = firstAlert.labels['service'] || '';
      variables.instance = firstAlert.labels['instance'] || '';
      variables.runbook_url = firstAlert.annotations['runbook_url'] || '';
      
      // Add values if present
      if (firstAlert.values) {
        Object.entries(firstAlert.values).forEach(([key, value]) => {
          variables[key] = value;
        });
      }
    }
    
    // Still include all alerts for more complex templates
    variables.alerts = payload.alerts.map(alert => this.extractAlertVariables(alert));

    return {
      template_key: templateKey,
      variables
    };
  }

  /**
   * Transform to custom content notification
   */
  private transformToCustomContent(payload: GrafanaWebhookPayload): GrafanaNotificationData {
    const subject = this.generateSubject(payload);
    const content = this.generateContent(payload);

    return {
      variables: {
        status: payload.status,
        alertCount: payload.alerts.length
      },
      custom_content: {
        subject,
        content
      }
    };
  }

  /**
   * Generate subject line for the notification
   */
  private generateSubject(payload: GrafanaWebhookPayload): string {
    const status = payload.status === 'firing' ? '🚨 ALERT' : '✅ RESOLVED';
    const count = payload.alerts.length;
    const alertName = payload.commonLabels?.['alertname'] || 'Alert';
    
    if (count === 1) {
      return `${status}: ${alertName}`;
    } else {
      return `${status}: ${count} alerts (${alertName})`;
    }
  }

  /**
   * Generate notification content
   */
  private generateContent(payload: GrafanaWebhookPayload): string {
    const lines: string[] = [];
    
    // Status summary
    lines.push(`**Status**: ${payload.status.toUpperCase()}`);
    lines.push(`**Alert Count**: ${payload.alerts.length}`);
    
    // Common labels
    if (payload.commonLabels && Object.keys(payload.commonLabels).length > 0) {
      lines.push('\n**Common Labels**:');
      Object.entries(payload.commonLabels).forEach(([key, value]) => {
        lines.push(`- ${key}: ${value}`);
      });
    }

    // Individual alerts
    lines.push('\n**Alerts**:');
    payload.alerts.forEach((alert, index) => {
      lines.push(`\n${index + 1}. **${alert.labels['alertname'] || 'Alert'}**`);
      
      // Alert status and timing
      lines.push(`   Status: ${alert.status}`);
      lines.push(`   Started: ${this.formatDate(alert.startsAt)}`);
      if (alert.status === 'resolved') {
        lines.push(`   Ended: ${this.formatDate(alert.endsAt)}`);
      }
      
      // Annotations (description, summary, etc.)
      if (alert.annotations['summary']) {
        lines.push(`   Summary: ${alert.annotations['summary']}`);
      }
      if (alert.annotations['description']) {
        lines.push(`   Description: ${alert.annotations['description']}`);
      }
      
      // Important labels
      const importantLabels = ['severity', 'instance', 'job', 'namespace', 'pod'];
      importantLabels.forEach(label => {
        if (alert.labels[label]) {
          lines.push(`   ${this.capitalize(label)}: ${alert.labels[label]}`);
        }
      });
      
      // Values if present
      if (alert.values && Object.keys(alert.values).length > 0) {
        lines.push('   Values:');
        Object.entries(alert.values).forEach(([metric, value]) => {
          lines.push(`   - ${metric}: ${value}`);
        });
      }
      
      // Links
      if (alert.generatorURL) {
        lines.push(`   [View in Grafana](${alert.generatorURL})`);
      }
    });
    
    // Footer with external URL
    if (payload.externalURL) {
      lines.push(`\n[Alert Manager](${payload.externalURL})`);
    }
    
    return lines.join('\n');
  }

  /**
   * Extract common variables from payload
   */
  private extractCommonVariables(payload: GrafanaWebhookPayload): Record<string, any> {
    return {
      title: payload.title || payload.commonLabels?.['alertname'] || 'Alert',
      state: payload.state || payload.status,
      message: payload.message || '',
      orgId: payload.orgId,
      truncatedAlerts: payload.truncatedAlerts || 0,
      commonLabels: payload.commonLabels,
      commonAnnotations: payload.commonAnnotations,
      groupLabels: payload.groupLabels
    };
  }

  /**
   * Extract variables from individual alert
   */
  private extractAlertVariables(alert: GrafanaAlert): Record<string, any> {
    return {
      status: alert.status,
      fingerprint: alert.fingerprint,
      labels: alert.labels,
      annotations: alert.annotations,
      startsAt: alert.startsAt,
      endsAt: alert.endsAt,
      generatorURL: alert.generatorURL,
      values: alert.values || {},
      // Extracted common fields for easier access
      alertname: alert.labels['alertname'] || 'Unknown',
      severity: alert.labels['severity'] || 'info',
      summary: alert.annotations['summary'] || '',
      description: alert.annotations['description'] || ''
    };
  }

  /**
   * Format date string to readable format
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      // Check if it's the zero date (0001-01-01T00:00:00Z)
      if (date.getFullYear() === 1) {
        return 'N/A';
      }
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}