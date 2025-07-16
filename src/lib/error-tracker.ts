import { logger } from './logger';
import { alerting } from './alerting';
import { database } from './database';

export interface ErrorPattern {
  errorType: string;
  source: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  errorRate: number; // errors per hour
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorRate: number;
  topErrors: ErrorPattern[];
  criticalErrors: number;
  trends: {
    increasing: ErrorPattern[];
    decreasing: ErrorPattern[];
  };
}

class ErrorTracker {
  private readonly ERROR_RATE_THRESHOLD = 10; // errors per hour
  private readonly CRITICAL_ERROR_THRESHOLD = 5; // critical errors per hour

  async trackError(
    error: Error,
    source: string,
    context?: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    try {
      // Log the error
      await logger.logError(error, `Error tracked in ${source}`, {
        ...context,
        severity,
        errorType: error.constructor.name,
        stackTrace: error.stack
      }, source);

      // Check if this error pattern is becoming frequent
      await this.analyzeErrorPattern(error, source, severity);

    } catch (trackingError) {
      // Don't let error tracking itself fail the application
      console.error('Failed to track error:', trackingError);
    }
  }

  async getErrorAnalysis(timeWindow: number = 24): Promise<ErrorAnalysis> {
    try {
      // Get error counts by type and source
      const errorPatterns = await database.query(`
        SELECT 
          context->>'errorType' as error_type,
          source,
          COUNT(*) as count,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence,
          COUNT(*) / $1 as error_rate
        FROM system_logs 
        WHERE level IN ('error', 'critical') 
          AND created_at >= NOW() - INTERVAL '${timeWindow} hours'
          AND context->>'errorType' IS NOT NULL
        GROUP BY context->>'errorType', source
        ORDER BY count DESC
        LIMIT 20
      `, [timeWindow]);

      // Get total error count
      const totalResult = await database.query(`
        SELECT COUNT(*) as total
        FROM system_logs 
        WHERE level IN ('error', 'critical') 
          AND created_at >= NOW() - INTERVAL '${timeWindow} hours'
      `);

      // Get critical error count
      const criticalResult = await database.query(`
        SELECT COUNT(*) as critical_count
        FROM system_logs 
        WHERE level = 'critical' 
          AND created_at >= NOW() - INTERVAL '${timeWindow} hours'
      `);

      const totalErrors = totalResult.rows[0]?.total || 0;
      const criticalErrors = criticalResult.rows[0]?.critical_count || 0;
      const errorRate = totalErrors / timeWindow;

      const patterns: ErrorPattern[] = (errorPatterns.rows || []).map(row => ({
        errorType: row.error_type || 'Unknown',
        source: row.source,
        count: row.count,
        firstOccurrence: new Date(row.first_occurrence),
        lastOccurrence: new Date(row.last_occurrence),
        errorRate: row.error_rate
      }));

      // Analyze trends (simplified - in production you'd want more sophisticated trend analysis)
      const increasing = patterns.filter(p => p.errorRate > this.ERROR_RATE_THRESHOLD);
      const decreasing = patterns.filter(p => p.errorRate < this.ERROR_RATE_THRESHOLD / 2);

      return {
        totalErrors,
        errorRate,
        topErrors: patterns,
        criticalErrors,
        trends: {
          increasing,
          decreasing
        }
      };
    } catch (error) {
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to get error analysis',
        {},
        'error-tracker'
      );
      
      return {
        totalErrors: 0,
        errorRate: 0,
        topErrors: [],
        criticalErrors: 0,
        trends: { increasing: [], decreasing: [] }
      };
    }
  }

  async getErrorsBySource(source: string, limit: number = 50): Promise<any[]> {
    try {
      const errors = await database.query(`
        SELECT 
          level,
          message,
          context,
          created_at
        FROM system_logs 
        WHERE source = $1 
          AND level IN ('error', 'critical')
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT $2
      `, [source, limit]);

      return errors.rows || [];
    } catch (error) {
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to get errors by source',
        { source },
        'error-tracker'
      );
      return [];
    }
  }

  async getErrorTrends(hours: number = 24): Promise<any[]> {
    try {
      const trends = await database.query(`
        SELECT 
          to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00:00') as hour,
          level,
          COUNT(*) as count
        FROM system_logs 
        WHERE level IN ('error', 'critical')
          AND created_at >= NOW() - INTERVAL '${hours} hours'
        GROUP BY date_trunc('hour', created_at), level
        ORDER BY hour DESC
      `);

      return trends.rows || [];
    } catch (error) {
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to get error trends',
        {},
        'error-tracker'
      );
      return [];
    }
  }

  private async analyzeErrorPattern(
    error: Error,
    source: string,
    severity: string
  ): Promise<void> {
    try {
      // Count recent occurrences of this error type from this source
      const recentErrors = await database.query(`
        SELECT COUNT(*) as count
        FROM system_logs 
        WHERE source = $1 
          AND context->>'errorType' = $2
          AND created_at >= NOW() - INTERVAL '1 hour'
      `, [source, error.constructor.name]);

      const recentCount = recentErrors.rows[0]?.count || 0;

      // Alert if error rate is high
      if (recentCount >= this.ERROR_RATE_THRESHOLD) {
        await alerting.alertHighErrorRate(
          source,
          recentCount,
          this.ERROR_RATE_THRESHOLD
        );
      }

      // Alert for critical errors
      if (severity === 'critical') {
        const criticalCount = await database.query(`
          SELECT COUNT(*) as count
          FROM system_logs 
          WHERE source = $1 
            AND level = 'critical'
            AND created_at >= NOW() - INTERVAL '1 hour'
        `, [source]);

        const criticalRecentCount = criticalCount.rows[0]?.count || 0;
        
        if (criticalRecentCount >= this.CRITICAL_ERROR_THRESHOLD) {
          await alerting.createAlert(
            'critical',
            'High Critical Error Rate',
            `${source} has ${criticalRecentCount} critical errors in the last hour`,
            'error-tracker',
            { source, criticalCount: criticalRecentCount, threshold: this.CRITICAL_ERROR_THRESHOLD }
          );
        }
      }
    } catch (analysisError) {
      console.error('Failed to analyze error pattern:', analysisError);
    }
  }

  // Convenience methods for common error scenarios
  async trackDatabaseError(error: Error, operation: string, context?: Record<string, any>): Promise<void> {
    await this.trackError(error, 'database', { operation, ...context }, 'high');
  }

  async trackAPIError(error: Error, endpoint: string, method: string, context?: Record<string, any>): Promise<void> {
    await this.trackError(error, 'api', { endpoint, method, ...context }, 'medium');
  }

  async trackQueueError(error: Error, queueName: string, operation: string, context?: Record<string, any>): Promise<void> {
    await this.trackError(error, 'queue', { queueName, operation, ...context }, 'high');
  }

  async trackProcessingError(error: Error, itemId: string, platform: string, context?: Record<string, any>): Promise<void> {
    await this.trackError(error, 'content-processor', { itemId, platform, ...context }, 'medium');
  }

  async trackPublishingError(error: Error, itemId: string, platform: string, context?: Record<string, any>): Promise<void> {
    await this.trackError(error, 'publisher', { itemId, platform, ...context }, 'critical');
  }

  async trackExternalAPIError(error: Error, service: string, endpoint: string, context?: Record<string, any>): Promise<void> {
    await this.trackError(error, `external-api-${service}`, { endpoint, ...context }, 'high');
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Convenience functions
export const trackDatabaseError = errorTracker.trackDatabaseError.bind(errorTracker);
export const trackAPIError = errorTracker.trackAPIError.bind(errorTracker);
export const trackQueueError = errorTracker.trackQueueError.bind(errorTracker);
export const trackProcessingError = errorTracker.trackProcessingError.bind(errorTracker);
export const trackPublishingError = errorTracker.trackPublishingError.bind(errorTracker);
export const trackExternalAPIError = errorTracker.trackExternalAPIError.bind(errorTracker);