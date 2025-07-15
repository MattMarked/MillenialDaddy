import { errorTracker, ErrorPattern, ErrorAnalysis } from '@/lib/error-tracker';
import { logger } from '@/lib/logger';
import { alerting } from '@/lib/alerting';
import { database } from '@/lib/database';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    logError: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    critical: jest.fn()
  }
}));
jest.mock('@/lib/alerting', () => ({
  alerting: {
    alertHighErrorRate: jest.fn(),
    createAlert: jest.fn()
  }
}));
jest.mock('@/lib/database', () => ({
  database: {
    query: jest.fn()
  }
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockAlerting = alerting as jest.Mocked<typeof alerting>;
const mockDatabase = database as jest.Mocked<typeof database>;

describe('ErrorTracker', () => {
  const mockExecute = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.query.mockResolvedValue({ rows: [] } as any);
    mockLogger.logError.mockResolvedValue();
    mockAlerting.alertHighErrorRate.mockResolvedValue();
    mockAlerting.createAlert.mockResolvedValue();
  });

  describe('trackError', () => {
    it('should log error and analyze pattern', async () => {
      const error = new Error('Test error');
      const source = 'test-source';
      const context = { userId: '123' };

      // Mock recent error count (below threshold)
      mockExecute.mockResolvedValueOnce([[{ count: 2 }]]);

      await errorTracker.trackError(error, source, context, 'medium');

      expect(mockLogger.logError).toHaveBeenCalledWith(
        error,
        'Error tracked in test-source',
        expect.objectContaining({
          userId: '123',
          severity: 'medium',
          errorType: 'Error'
        }),
        source
      );

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        [source, 'Error']
      );
    });

    it('should trigger alert for high error rate', async () => {
      const error = new Error('Frequent error');
      const source = 'problematic-source';

      // Mock high error count (above threshold)
      mockExecute.mockResolvedValueOnce([[{ count: 15 }]]);

      await errorTracker.trackError(error, source, {}, 'medium');

      expect(mockAlerting.alertHighErrorRate).toHaveBeenCalledWith(
        source,
        15,
        10 // ERROR_RATE_THRESHOLD
      );
    });

    it('should trigger critical alert for high critical error rate', async () => {
      const error = new Error('Critical error');
      const source = 'critical-source';

      // Mock recent error count and critical error count
      mockExecute
        .mockResolvedValueOnce([[{ count: 3 }]]) // recent errors
        .mockResolvedValueOnce([[{ count: 6 }]]); // critical errors

      await errorTracker.trackError(error, source, {}, 'critical');

      expect(mockAlerting.createAlert).toHaveBeenCalledWith(
        'critical',
        'High Critical Error Rate',
        'critical-source has 6 critical errors in the last hour',
        'error-tracker',
        expect.objectContaining({
          source,
          criticalCount: 6,
          threshold: 5
        })
      );
    });

    it('should handle tracking errors gracefully', async () => {
      const error = new Error('Test error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockLogger.logError.mockRejectedValue(new Error('Logging failed'));

      // Should not throw
      await expect(errorTracker.trackError(error, 'test-source')).resolves.not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getErrorAnalysis', () => {
    it('should return comprehensive error analysis', async () => {
      const mockErrorPatterns = [
        {
          error_type: 'DatabaseError',
          source: 'database',
          count: 10,
          first_occurrence: new Date('2023-01-01T10:00:00Z'),
          last_occurrence: new Date('2023-01-01T11:00:00Z'),
          error_rate: 0.42
        }
      ];

      mockExecute
        .mockResolvedValueOnce([mockErrorPatterns]) // error patterns
        .mockResolvedValueOnce([[{ total: 25 }]]) // total errors
        .mockResolvedValueOnce([[{ critical_count: 5 }]]); // critical errors

      const analysis = await errorTracker.getErrorAnalysis(24);

      expect(analysis).toMatchObject({
        totalErrors: 25,
        errorRate: 25 / 24,
        topErrors: expect.arrayContaining([
          expect.objectContaining({
            errorType: 'DatabaseError',
            source: 'database',
            count: 10
          })
        ]),
        criticalErrors: 5,
        trends: {
          increasing: expect.any(Array),
          decreasing: expect.any(Array)
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Database error'));

      const analysis = await errorTracker.getErrorAnalysis();

      expect(analysis).toEqual({
        totalErrors: 0,
        errorRate: 0,
        topErrors: [],
        criticalErrors: 0,
        trends: { increasing: [], decreasing: [] }
      });

      expect(mockLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to get error analysis',
        {},
        'error-tracker'
      );
    });
  });

  describe('getErrorsBySource', () => {
    it('should return errors for specific source', async () => {
      const mockErrors = [
        {
          level: 'error',
          message: 'Database connection failed',
          context: '{"operation":"select"}',
          created_at: new Date()
        }
      ];

      mockExecute.mockResolvedValueOnce([mockErrors]);

      const errors = await errorTracker.getErrorsBySource('database', 10);

      expect(errors).toEqual(mockErrors);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE source = ?'),
        ['database', 10]
      );
    });

    it('should handle errors when fetching by source', async () => {
      mockExecute.mockRejectedValue(new Error('Query failed'));

      const errors = await errorTracker.getErrorsBySource('test-source');

      expect(errors).toEqual([]);
      expect(mockLogger.logError).toHaveBeenCalled();
    });
  });

  describe('getErrorTrends', () => {
    it('should return hourly error trends', async () => {
      const mockTrends = [
        {
          hour: '2023-01-01 10:00:00',
          level: 'error',
          count: 5
        },
        {
          hour: '2023-01-01 10:00:00',
          level: 'critical',
          count: 2
        }
      ];

      mockExecute.mockResolvedValueOnce([mockTrends]);

      const trends = await errorTracker.getErrorTrends(24);

      expect(trends).toEqual(mockTrends);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DATE_FORMAT(created_at'),
        [24]
      );
    });
  });

  describe('convenience methods', () => {
    it('should track database errors with correct context', async () => {
      const error = new Error('Connection timeout');
      const operation = 'SELECT';
      const context = { table: 'users' };

      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      await errorTracker.trackDatabaseError(error, operation, context);

      expect(mockLogger.logError).toHaveBeenCalledWith(
        error,
        'Error tracked in database',
        expect.objectContaining({
          operation,
          table: 'users',
          severity: 'high',
          errorType: 'Error'
        }),
        'database'
      );
    });

    it('should track API errors with endpoint information', async () => {
      const error = new Error('Request failed');
      const endpoint = '/api/test';
      const method = 'POST';

      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      await errorTracker.trackAPIError(error, endpoint, method);

      expect(mockLogger.logError).toHaveBeenCalledWith(
        error,
        'Error tracked in api',
        expect.objectContaining({
          endpoint,
          method,
          severity: 'medium'
        }),
        'api'
      );
    });

    it('should track publishing errors as critical', async () => {
      const error = new Error('Instagram API failed');
      const itemId = 'item-123';
      const platform = 'instagram';

      mockExecute
        .mockResolvedValueOnce([[{ count: 1 }]]) // recent errors
        .mockResolvedValueOnce([[{ count: 1 }]]); // critical errors

      await errorTracker.trackPublishingError(error, itemId, platform);

      expect(mockLogger.logError).toHaveBeenCalledWith(
        error,
        'Error tracked in publisher',
        expect.objectContaining({
          itemId,
          platform,
          severity: 'critical'
        }),
        'publisher'
      );
    });
  });
});