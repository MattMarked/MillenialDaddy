import { logger } from './logger';
import { database } from './database';

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  source: string;
  context?: Record<string, any>;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  timeWindow: number; // minutes
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
}

class AlertingSystem {
  private readonly MAX_ALERTS_PER_HOUR = 10;
  private alertCounts: Map<string, { count: number; lastReset: number }> = new Map();

  async createAlert(
    type: Alert['type'],
    title: string,
    message: string,
    source: string,
    context?: Record<string, any>
  ): Promise<void> {
    // Rate limiting to prevent alert spam
    if (this.isRateLimited(source)) {
      await logger.warn(`Alert rate limited for source: ${source}`, { title, message });
      return;
    }

    const alert: Alert = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      source,
      context,
      createdAt: new Date(),
      acknowledged: false
    };

    try {
      // Persist alert to database
      await database.query(`
        INSERT INTO alerts (id, type, title, message, source, context, created_at, acknowledged)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        alert.id,
        alert.type,
        alert.title,
        alert.message,
        alert.source,
        JSON.stringify(alert.context || {}),
        alert.createdAt,
        alert.acknowledged
      ]);

      // Log the alert
      const logLevel = type === 'critical' ? 'critical' : type === 'warning' ? 'warn' : 'info';
      await logger[logLevel](`ALERT: ${title}`, {
        ...context,
        alertId: alert.id,
        alertType: type,
        alertSource: source
      }, 'alerting-system');

      // For critical alerts, also try to send notifications
      if (type === 'critical') {
        await this.sendCriticalAlertNotification(alert);
      }

      this.incrementAlertCount(source);
    } catch (error) {
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to create alert',
        { alert },
        'alerting-system'
      );
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    try {
      // Use database directly
      const result = await database.query(`
        UPDATE alerts 
        SET acknowledged = true, acknowledged_at = $1, acknowledged_by = $2
        WHERE id = $3 AND acknowledged = false
      `, [new Date(), acknowledgedBy, alertId]);

      const success = result.rowCount > 0;
      
      if (success) {
        await logger.info('Alert acknowledged', {
          alertId,
          acknowledgedBy
        }, 'alerting-system');
      }

      return success;
    } catch (error) {
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to acknowledge alert',
        { alertId, acknowledgedBy },
        'alerting-system'
      );
      return false;
    }
  }

  async getActiveAlerts(limit: number = 50): Promise<Alert[]> {
    try {
      // Use database directly
      const alerts = await database.query(`
        SELECT * FROM alerts 
        WHERE acknowledged = false 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);

      return (alerts.rows || []).map(this.mapDbAlertToAlert);
    } catch (error) {
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to get active alerts',
        {},
        'alerting-system'
      );
      return [];
    }
  }

  async getAlertHistory(limit: number = 100): Promise<Alert[]> {
    try {
      // Use database directly
      const alerts = await database.query(`
        SELECT * FROM alerts 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);

      return (alerts.rows || []).map(this.mapDbAlertToAlert);
    } catch (error) {
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to get alert history',
        {},
        'alerting-system'
      );
      return [];
    }
  }

  // Predefined alert methods for common scenarios
  async alertQueueBackup(queueName: string, count: number, threshold: number): Promise<void> {
    await this.createAlert(
      'warning',
      'Queue Backup Detected',
      `Queue ${queueName} has ${count} items (threshold: ${threshold})`,
      'queue-monitor',
      { queueName, count, threshold }
    );
  }

  async alertProcessingFailure(itemId: string, error: string, retryCount: number): Promise<void> {
    const severity = retryCount >= 3 ? 'critical' : 'warning';
    await this.createAlert(
      severity,
      'Processing Failure',
      `Item ${itemId} failed processing: ${error}`,
      'content-processor',
      { itemId, error, retryCount }
    );
  }

  async alertPublishingFailure(itemId: string, error: string, platform: string): Promise<void> {
    await this.createAlert(
      'critical',
      'Publishing Failure',
      `Failed to publish item ${itemId} to ${platform}: ${error}`,
      'publisher',
      { itemId, error, platform }
    );
  }

  async alertDatabaseConnection(): Promise<void> {
    await this.createAlert(
      'critical',
      'Database Connection Lost',
      'Unable to connect to database',
      'database',
      {}
    );
  }

  async alertRedisConnection(): Promise<void> {
    await this.createAlert(
      'critical',
      'Redis Connection Lost',
      'Unable to connect to Redis queue system',
      'redis',
      {}
    );
  }

  async alertInstagramAPIFailure(error: string, rateLimited: boolean = false): Promise<void> {
    await this.createAlert(
      'critical',
      'Instagram API Failure',
      `Instagram API error: ${error}`,
      'instagram-api',
      { error, rateLimited }
    );
  }

  async alertHighErrorRate(source: string, errorRate: number, threshold: number): Promise<void> {
    await this.createAlert(
      'warning',
      'High Error Rate Detected',
      `${source} has error rate of ${errorRate}% (threshold: ${threshold}%)`,
      'error-monitor',
      { source, errorRate, threshold }
    );
  }

  private isRateLimited(source: string): boolean {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    const sourceCount = this.alertCounts.get(source);
    if (!sourceCount) {
      return false;
    }

    // Reset count if it's been more than an hour
    if (sourceCount.lastReset < hourAgo) {
      this.alertCounts.set(source, { count: 0, lastReset: now });
      return false;
    }

    return sourceCount.count >= this.MAX_ALERTS_PER_HOUR;
  }

  private incrementAlertCount(source: string): void {
    const now = Date.now();
    const existing = this.alertCounts.get(source);
    
    if (!existing) {
      this.alertCounts.set(source, { count: 1, lastReset: now });
    } else {
      existing.count++;
    }
  }

  private async sendCriticalAlertNotification(alert: Alert): Promise<void> {
    // In a production system, this would send notifications via:
    // - Email
    // - Slack/Discord webhooks
    // - SMS
    // - Push notifications
    // For now, we'll just log it prominently
    
    await logger.critical(`🚨 CRITICAL ALERT: ${alert.title}`, {
      message: alert.message,
      source: alert.source,
      context: alert.context,
      alertId: alert.id
    }, 'critical-alerts');
  }

  private mapDbAlertToAlert(dbAlert: any): Alert {
    return {
      id: dbAlert.id,
      type: dbAlert.type,
      title: dbAlert.title,
      message: dbAlert.message,
      source: dbAlert.source,
      context: dbAlert.context ? JSON.parse(dbAlert.context) : undefined,
      createdAt: new Date(dbAlert.created_at),
      acknowledged: dbAlert.acknowledged,
      acknowledgedAt: dbAlert.acknowledged_at ? new Date(dbAlert.acknowledged_at) : undefined,
      acknowledgedBy: dbAlert.acknowledged_by
    };
  }
}

// Export singleton instance
export const alerting = new AlertingSystem();

// Convenience functions
export const alertQueueBackup = alerting.alertQueueBackup.bind(alerting);
export const alertProcessingFailure = alerting.alertProcessingFailure.bind(alerting);
export const alertPublishingFailure = alerting.alertPublishingFailure.bind(alerting);
export const alertDatabaseConnection = alerting.alertDatabaseConnection.bind(alerting);
export const alertRedisConnection = alerting.alertRedisConnection.bind(alerting);
export const alertInstagramAPIFailure = alerting.alertInstagramAPIFailure.bind(alerting);
export const alertHighErrorRate = alerting.alertHighErrorRate.bind(alerting);