import {
  AdminRepository,
  QueueItemRepository,
  SystemConfigRepository,
  DatabaseError,
  checkDatabaseConnection,
} from '../lib/database';

// Mock @vercel/postgres
jest.mock('@vercel/postgres', () => ({
  sql: {
    query: jest.fn(),
  },
}));

const mockSql = require('@vercel/postgres').sql;

describe('Database Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DatabaseError', () => {
    it('should create a DatabaseError with message and cause', () => {
      const originalError = new Error('Original error');
      const dbError = new DatabaseError('Database failed', originalError);
      
      expect(dbError.message).toBe('Database failed');
      expect(dbError.name).toBe('DatabaseError');
      expect(dbError.cause).toBe(originalError);
    });
  });

  describe('checkDatabaseConnection', () => {
    it('should return true when database connection is successful', async () => {
      mockSql.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      
      const result = await checkDatabaseConnection();
      
      expect(result).toBe(true);
      expect(mockSql.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should return false when database connection fails', async () => {
      mockSql.query.mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await checkDatabaseConnection();
      
      expect(result).toBe(false);
    });
  });

  describe('AdminRepository', () => {
    const mockAdmin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test Admin',
      is_active: true,
      created_at: new Date(),
      last_active: null,
    };

    describe('create', () => {
      it('should create a new admin successfully', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [mockAdmin] });
        
        const result = await AdminRepository.create({
          email: 'test@example.com',
          name: 'Test Admin',
          is_active: true,
        });
        
        expect(result).toEqual(mockAdmin);
        expect(mockSql.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO admins'),
          ['test@example.com', 'Test Admin', true]
        );
      });

      it('should throw DatabaseError when creation fails', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [] });
        
        await expect(AdminRepository.create({
          email: 'test@example.com',
          name: 'Test Admin',
          is_active: true,
        })).rejects.toThrow(DatabaseError);
      });
    });

    describe('findByEmail', () => {
      it('should return admin when found', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [mockAdmin] });
        
        const result = await AdminRepository.findByEmail('test@example.com');
        
        expect(result).toEqual(mockAdmin);
      });

      it('should return null when admin not found', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [] });
        
        const result = await AdminRepository.findByEmail('notfound@example.com');
        
        expect(result).toBeNull();
      });
    });

    describe('list', () => {
      it('should return list of admins', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [mockAdmin] });
        
        const result = await AdminRepository.list();
        
        expect(result).toEqual([mockAdmin]);
        expect(mockSql.query).toHaveBeenCalledWith(
          'SELECT * FROM admins ORDER BY created_at DESC',
          []
        );
      });
    });

    describe('delete', () => {
      it('should return true when admin is deleted', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [{}] });
        
        const result = await AdminRepository.delete('123');
        
        expect(result).toBe(true);
      });

      it('should return false when admin not found', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [] });
        
        const result = await AdminRepository.delete('123');
        
        expect(result).toBe(false);
      });
    });
  });

  describe('QueueItemRepository', () => {
    const mockQueueItem = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      url: 'https://www.youtube.com/watch?v=test',
      platform: 'youtube' as const,
      submitted_by: 'test@example.com',
      status: 'pending' as const,
      queue_type: 'input' as const,
      content: null,
      created_at: new Date(),
      processed_at: null,
      published_at: null,
    };

    describe('create', () => {
      it('should create a new queue item successfully', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [mockQueueItem] });
        
        const result = await QueueItemRepository.create({
          url: 'https://www.youtube.com/watch?v=test',
          platform: 'youtube',
          submitted_by: 'test@example.com',
        });
        
        expect(result).toEqual(mockQueueItem);
      });
    });

    describe('findByQueueType', () => {
      it('should return items from specified queue', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [mockQueueItem] });
        
        const result = await QueueItemRepository.findByQueueType('input');
        
        expect(result).toEqual([mockQueueItem]);
        expect(mockSql.query).toHaveBeenCalledWith(
          'SELECT * FROM queue_items WHERE queue_type = $1 ORDER BY created_at ASC',
          ['input']
        );
      });
    });

    describe('getQueueCounts', () => {
      it('should return queue counts', async () => {
        mockSql.query.mockResolvedValueOnce({
          rows: [
            { queue_type: 'input', status: 'pending', count: '5' },
            { queue_type: 'ready_to_publish', status: 'completed', count: '3' },
            { queue_type: 'input', status: 'failed', count: '2' },
          ],
        });
        
        const result = await QueueItemRepository.getQueueCounts();
        
        expect(result).toEqual({
          input: 7, // 5 pending + 2 failed in input queue
          ready_to_publish: 3,
          failed: 2, // total failed items across all queues
        });
      });
    });
  });

  describe('SystemConfigRepository', () => {
    const mockConfig = {
      key: 'test_config',
      value: { setting: 'value' },
      updated_at: new Date(),
    };

    describe('set', () => {
      it('should set configuration successfully', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [mockConfig] });
        
        const result = await SystemConfigRepository.set('test_config', { setting: 'value' });
        
        expect(result).toEqual(mockConfig);
      });
    });

    describe('get', () => {
      it('should return configuration when found', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [mockConfig] });
        
        const result = await SystemConfigRepository.get('test_config');
        
        expect(result).toEqual(mockConfig);
      });

      it('should return null when configuration not found', async () => {
        mockSql.query.mockResolvedValueOnce({ rows: [] });
        
        const result = await SystemConfigRepository.get('nonexistent');
        
        expect(result).toBeNull();
      });
    });
  });
});