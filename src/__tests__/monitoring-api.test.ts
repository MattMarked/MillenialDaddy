import { GET as getStatus } from '@/app/api/monitoring/status/route';
import { GET as getLogs } from '@/app/api/monitoring/logs/route';
import { GET as getMetrics, POST as postMetrics } from '@/app/api/monitoring/metrics/route';
import { GET as getHealth } from '@/app/api/health/route';
import { database } from '@/lib/database';
import { getRedisClient } from '@/lib/redis-queue';

// Mock dependencies
jest.mock('@/lib/database', () => ({
  database: {
    query: jest.fn()
  }
}));
jest.mock('@/lib/redis-queue', () => ({
  getRedisClient: jest.fn()
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    logError: jest.fn()
  }
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

describe('Monitoring API Endpoints', () => {
  const mockExecute = jest.fn();
  const mockRedisClient = {
    llen: jest.fn(),
    ping: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.query.mockResolvedValue({ rows: [] } as any);
    mockGetRedisClient.mockResolvedValue(mockRedisClient as any);
  });

  describe('/api/monitoring/status', () => {
    it('should return queue status and statistics', async () => {
      // Mock Redis queue lengths
      mockRedisClient.llen
        .mockResolvedValueOnce(5) // input_queue
        .mockResolvedValueOnce(3) // ready_to_publish_queue
        .mockResolvedValueOnce(1); // failed_queue

      // Mock database statistics
      mockExecute
        .mockResolvedValueOnce([[{
          total_items: 10,
          pending_count: 2,
          processing_count: 1,
          completed_count: 6,
          failed_count: 1,
          published_count: 5
        }]])
        .mockResolvedValueOnce([[
          { id: '1', url: 'https://example.com', platform: 'instagram', status: 'completed' }
        ]]);

      const request = new Request('http://localhost/api/monitoring/status');
      const response = await getStatus(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('queues');
      expect(data).toHaveProperty('statistics');
      expect(data).toHaveProperty('recentActivity');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('systemHealth');
      expect(data.queues.input).toBe(5);
      expect(data.queues.readyToPublish).toBe(3);
      expect(data.queues.failed).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockGetRedisClient.mockRejectedValue(new Error('Redis connection failed'));

      const request = new Request('http://localhost/api/monitoring/status');
      const response = await getStatus(request as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('/api/monitoring/logs', () => {
    it('should return filtered logs with pagination', async () => {
      const mockLogs = [
        { id: '1', level: 'info', message: 'Test log 1', context: '{}', created_at: new Date() },
        { id: '2', level: 'error', message: 'Test log 2', context: '{}', created_at: new Date() }
      ];

      mockExecute
        .mockResolvedValueOnce([mockLogs])
        .mockResolvedValueOnce([{ total: 2 }]);

      const request = new Request('http://localhost/api/monitoring/logs?level=error&limit=10');
      const response = await getLogs(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('logs');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.logs)).toBe(true);
      expect(data.logs).toHaveLength(2);
    });

    it('should handle pagination parameters', async () => {
      mockExecute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ total: 100 }]);

      const request = new Request('http://localhost/api/monitoring/logs?limit=20&offset=40');
      const response = await getLogs(request as any);
      const data = await response.json();

      expect(data.pagination).toMatchObject({
        limit: 20,
        offset: 40
      });
    });
  });

  describe('/api/monitoring/metrics', () => {
    it('should return performance metrics', async () => {
      const mockMetrics = [
        { operation: 'content-processing', count: 10, avg_duration: 150 }
      ];
      const mockErrors = [
        { source: 'api', level: 'error', count: 2 }
      ];
      const mockQueue = [
        { platform: 'instagram', status: 'completed', count: 5 }
      ];
      const mockActivity = [
        { hour: '2023-01-01 10:00:00', items_processed: 3, successful: 2, failed: 1 }
      ];

      mockExecute
        .mockResolvedValueOnce([mockMetrics])
        .mockResolvedValueOnce([mockErrors])
        .mockResolvedValueOnce([mockQueue])
        .mockResolvedValueOnce([mockActivity]);

      const request = new Request('http://localhost/api/monitoring/metrics?range=24h');
      const response = await getMetrics(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        timeRange: '24h',
        performance: mockMetrics,
        errors: mockErrors,
        queues: mockQueue,
        activity: mockActivity
      });
    });

    it('should record new performance metrics via POST', async () => {
      mockExecute.mockResolvedValueOnce([]);

      const request = new Request('http://localhost/api/monitoring/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'test-operation',
          duration: 100,
          context: { test: true }
        })
      });

      const response = await postMetrics(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO performance_metrics'),
        expect.arrayContaining(['test-operation', 100, '{"test":true}'])
      );
    });

    it('should validate required fields in POST request', async () => {
      const request = new Request('http://localhost/api/monitoring/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'test' }) // missing duration
      });

      const response = await postMetrics(request as any);
      expect(response.status).toBe(400);
    });
  });

  describe('/api/health', () => {
    it('should return healthy status when all services are up', async () => {
      mockExecute.mockResolvedValue([]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      
      // Mock environment variables
      process.env.INSTAGRAM_ACCESS_TOKEN = 'test-token';
      process.env.INSTAGRAM_ACCOUNT_ID = 'test-account';

      const request = new Request('http://localhost/api/health');
      const response = await getHealth(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.services).toMatchObject({
        database: { status: 'healthy' },
        redis: { status: 'healthy' },
        instagram: { status: 'healthy' }
      });
    });

    it('should return unhealthy status when services are down', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));
      mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));

      const request = new Request('http://localhost/api/health');
      const response = await getHealth(request as any);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.services.database.status).toBe('unhealthy');
      expect(data.services.redis.status).toBe('unhealthy');
    });

    it('should detect missing Instagram credentials', async () => {
      mockExecute.mockResolvedValue([]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      
      // Clear environment variables
      delete process.env.INSTAGRAM_ACCESS_TOKEN;
      delete process.env.INSTAGRAM_ACCOUNT_ID;

      const request = new Request('http://localhost/api/health');
      const response = await getHealth(request as any);
      const data = await response.json();

      expect(data.services.instagram.status).toBe('unhealthy');
      expect(data.services.instagram.error).toContain('Missing Instagram API credentials');
    });
  });
});