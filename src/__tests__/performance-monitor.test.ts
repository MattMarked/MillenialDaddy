import { PerformanceTimer, startTimer, measureAsync, measure, timed } from '@/lib/performance-monitor';
import { logger } from '@/lib/logger';

// Mock the logger
jest.mock('@/lib/logger');
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Performance Monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger.logPerformance.mockResolvedValue();
  });

  describe('PerformanceTimer', () => {
    it('should measure execution time', async () => {
      const timer = new PerformanceTimer('test-operation', { test: true });
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const duration = await timer.end({ result: 'success' });
      
      expect(duration).toBeGreaterThan(0);
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'test-operation',
        duration,
        { test: true, result: 'success' }
      );
    });

    it('should get current duration without ending timer', () => {
      const timer = new PerformanceTimer('test-operation');
      const duration = timer.getDuration();
      
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(mockLogger.logPerformance).not.toHaveBeenCalled();
    });
  });

  describe('startTimer', () => {
    it('should create and return a PerformanceTimer', () => {
      const timer = startTimer('test-operation', { userId: '123' });
      expect(timer).toBeInstanceOf(PerformanceTimer);
    });
  });

  describe('measureAsync', () => {
    it('should measure async function execution', async () => {
      const testFunction = jest.fn().mockResolvedValue('test-result');
      
      const result = await measureAsync('async-test', testFunction, { test: true });
      
      expect(result).toBe('test-result');
      expect(testFunction).toHaveBeenCalled();
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'async-test',
        expect.any(Number),
        { test: true, success: true }
      );
    });

    it('should handle async function errors', async () => {
      const error = new Error('Test error');
      const testFunction = jest.fn().mockRejectedValue(error);
      
      await expect(measureAsync('async-error-test', testFunction)).rejects.toThrow('Test error');
      
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'async-error-test',
        expect.any(Number),
        { success: false, error: 'Test error' }
      );
    });
  });

  describe('measure', () => {
    it('should measure synchronous function execution', () => {
      const testFunction = jest.fn().mockReturnValue('sync-result');
      
      const result = measure('sync-test', testFunction, { test: true });
      
      expect(result).toBe('sync-result');
      expect(testFunction).toHaveBeenCalled();
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'sync-test',
        expect.any(Number),
        { test: true, success: true }
      );
    });

    it('should handle synchronous function errors', () => {
      const error = new Error('Sync error');
      const testFunction = jest.fn().mockImplementation(() => {
        throw error;
      });
      
      expect(() => measure('sync-error-test', testFunction)).toThrow('Sync error');
      
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'sync-error-test',
        expect.any(Number),
        { success: false, error: 'Sync error' }
      );
    });
  });

  describe('timed decorator', () => {
    it('should be available for use (decorator syntax not testable in Jest)', () => {
      expect(timed).toBeDefined();
      expect(typeof timed).toBe('function');
    });
  });

  describe('integration with real timing', () => {
    it('should measure actual execution time', async () => {
      const startTime = Date.now();
      
      await measureAsync('real-timing-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'done';
      });
      
      const actualDuration = Date.now() - startTime;
      const loggedDuration = mockLogger.logPerformance.mock.calls[0][1];
      
      // Allow some tolerance for timing variations
      expect(loggedDuration).toBeGreaterThan(40);
      expect(loggedDuration).toBeLessThan(actualDuration + 10);
    });
  });
});