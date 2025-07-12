import { logger } from './logger';
import { alerting } from './alerting';
import { getDatabase } from './database';

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
      const db = await getDatabase();
      
      // Get error counts by type and source
      const [errorPatterns] = await db.execute(`
        SELECT 
          JSON_EXTRACT(context, '$.errorType') as error_type,
          source,
          COUNT(*) as count,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence,
          COUNT(*) / ? as error_rate
        FROM system_logs 
        WHERE level IN ('error', 'critical') 
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND JSON_EXTRACT(context, '$.errorType') IS NOT NULL
        GROUP BY JSON_EXTRACT(context, '$.errorType'), source
        ORDER BY count DESC
        LIMIT 20
      `, [timeWindow, timeWindow]);

      // Get total error count
      const [totalResult] = await db.execute(`
        SELECT COUNT(*) as total
        FROM system_logs 
        WHERE level IN ('error', 'critical') 
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      `, [timeWindow]);

      // Get critical error count
      const [criticalResult] = await db.execute(`
        SELECT COUNT(*) as critical_count
        FROM system_logs 
        WHERE level = 'critical' 
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      `, [timeWindow]);

      const totalErrors = (totalResult as any)[0]?.total || 0;
      const criticalErrors = (criticalResult as any)[0]?.critical_count || 0;
      const errorRate = totalErrors / timeWindow;

      const patterns: ErrorPattern[] = (errorPatterns as any[]).map(row => ({
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
      const db = await getDatabase();
      const [errors] = await db.execute(`
        SELECT 
          level,
          message,
          context,
          created_at
        FROM system_logs 
        WHERE source = ? 
          AND level IN ('error', 'critical')
          AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY created_at DESC
        LIMIT ?
      `, [source, limit]);

      return errors as any[];
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
      const db = await getDatabase();
      const [trends] = await db.execute(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
          level,
          COUNT(*) as count
        FROM system_logs 
        WHERE level IN ('error', 'critical')
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00'), level
        ORDER BY hour DESC
      `, [hours]);

      return trends as any[];
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
      const db = await getDatabase();
      
      // Count recent occurrences of this error type from this source
      const [recentErrors] = await db.execute(`
        SELECT COUNT(*) as count
        FROM system_logs 
        WHERE source = ? 
          AND JSON_EXTRACT(context, '$.errorType') = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `, [source, error.constructor.name]);

      const recentCount = (recentErrors as any)[0]?.count || 0;

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
        const [criticalCount] = await db.execute(`
          SELECT COUNT(*) as count
          FROM system_logs 
          WHERE source = ? 
            AND level = 'critical'
            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `, [source]);

        const criticalRecentCount = (criticalCount as any)[0]?.count || 0;
        
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