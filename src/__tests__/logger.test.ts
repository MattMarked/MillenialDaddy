import { logger, LogLevel } from '@/lib/logger';
import { database } from '@/lib/database';

// Mock the database
jest.mock('@/lib/database', () => ({
  database: {
    query: jest.fn()
  }
}));
const mockDatabase = database as jest.Mocked<typeof database>;

describe('Logger', () => {
  const mockExecute = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock database query method
    mockDatabase.query.mockResolvedValue({ rows: [] } as any);
    
    // Mock console methods
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('info logging', () => {
    it('should log info message to console and database', async () => {
      const message = 'Test info message';
      const context = { userId: '123', action: 'test' };

      await logger.info(message, context, 'test-source');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_logs'),
        expect.arrayContaining(['info', message, JSON.stringify(context), 'test-source'])
      );
    });
  });

  describe('error logging', () => {
    it('should log error message to console and database', async () => {
      const message = 'Test error message';
      const context = { errorCode: 500 };

      await logger.error(message, context);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_logs'),
        expect.arrayContaining(['error', message, JSON.stringify(context), 'system'])
      );
    });

    it('should handle Error objects with logError method', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      const message = 'Custom error message';

      await logger.logError(error, message, { userId: '123' });

      expect(console.error).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_logs'),
        expect.arrayContaining([
          'error',
          message,
          expect.stringContaining('"name":"Error"'),
          'system'
        ])
      );
    });
  });

  describe('performance logging', () => {
    it('should log performance metrics', async () => {
      const operation = 'test-operation';
      const duration = 150;
      const context = { itemCount: 5 };

      await logger.logPerformance(operation, duration, context, 'performance-test');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(`Performance: ${operation} completed in ${duration}ms`)
      );
      
      // Should log to both system_logs and performance_metrics tables
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('queue operation logging', () => {
    it('should log queue operations with proper context', async () => {
      const operation = 'add-item';
      const queueName = 'input_queue';
      const itemId = 'item-123';

      await logger.logQueueOperation(operation, queueName, itemId, { platform: 'instagram' });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(`Queue operation: ${operation}`)
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_logs'),
        expect.arrayContaining([
          'info',
          `Queue operation: ${operation}`,
          expect.stringContaining('"type":"queue"'),
          'queue-system'
        ])
      );
    });
  });

  describe('API operation logging', () => {
    it('should log successful API operations as info', async () => {
      await logger.logApiOperation('GET', '/api/test', 200, 50, { userId: '123' });

      expect(console.info).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_logs'),
        expect.arrayContaining([
          'info',
          'API GET /api/test - 200',
          expect.stringContaining('"type":"api"'),
          'api'
        ])
      );
    });

    it('should log failed API operations as error', async () => {
      await logger.logApiOperation('POST', '/api/test', 500, 100);

      expect(console.error).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_logs'),
        expect.arrayContaining([
          'error',
          'API POST /api/test - 500',
          expect.stringContaining('"statusCode":500'),
          'api'
        ])
      );
    });
  });

  describe('database failure handling', () => {
    it('should fallback to console logging when database fails', async () => {
      mockExecute.mockRejectedValue(new Error('Database connection failed'));

      await logger.info('Test message');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      );
      expect(console.error).toHaveBeenCalledWith(
        'Failed to persist log to database:',
        expect.any(Error)
      );
    });
  });

  describe('debug logging', () => {
    it('should only log to console for debug messages', async () => {
      await logger.debug('Debug message', { test: true });

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
      // Debug messages should not be persisted to database
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });
});