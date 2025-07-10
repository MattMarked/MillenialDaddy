import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/links/route';
import { AdminRepository, QueueItemRepository } from '@/lib/database';

// Mock the database modules
jest.mock('@/lib/database', () => ({
  AdminRepository: {
    findByEmail: jest.fn(),
    updateLastActive: jest.fn(),
  },
  QueueItemRepository: {
    create: jest.fn(),
    findByQueueType: jest.fn(),
    getQueueCounts: jest.fn(),
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, public cause?: Error) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

const mockAdminRepository = AdminRepository as jest.Mocked<typeof AdminRepository>;
const mockQueueItemRepository = QueueItemRepository as jest.Mocked<typeof QueueItemRepository>;

describe('/api/links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/links', () => {
    const mockAdmin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'admin@example.com',
      name: 'Test Admin',
      is_active: true,
      created_at: new Date(),
      last_active: new Date(),
    };

    beforeEach(() => {
      mockAdminRepository.findByEmail.mockResolvedValue(mockAdmin);
      mockAdminRepository.updateLastActive.mockResolvedValue();
      mockQueueItemRepository.findByQueueType.mockResolvedValue([]);
    });

    it('should successfully submit a valid Instagram Reel URL', async () => {
      const mockQueueItem = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        url: 'https://www.instagram.com/reel/ABC123/',
        platform: 'instagram' as const,
        submitted_by: 'admin@example.com',
        status: 'pending' as const,
        queue_type: 'input' as const,
        content: null,
        created_at: new Date(),
        processed_at: null,
        published_at: null,
      };

      mockQueueItemRepository.create.mockResolvedValue(mockQueueItem);

      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com',
        },
        body: JSON.stringify({
          url: 'https://www.instagram.com/reel/ABC123/',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Video link submitted successfully');
      expect(data.queueId).toBe(mockQueueItem.id);
      expect(data.data.platform).toBe('instagram');
      expect(data.data.videoId).toBe('ABC123');
    });

    it('should successfully submit a valid YouTube URL', async () => {
      const mockQueueItem = {
        id: '456e7890-e89b-12d3-a456-426614174002',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        platform: 'youtube' as const,
        submitted_by: 'admin@example.com',
        status: 'pending' as const,
        queue_type: 'input' as const,
        content: null,
        created_at: new Date(),
        processed_at: null,
        published_at: null,
      };

      mockQueueItemRepository.create.mockResolvedValue(mockQueueItem);

      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com',
        },
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.platform).toBe('youtube');
      expect(data.data.videoId).toBe('dQw4w9WgXcQ');
    });

    it('should successfully submit a valid TikTok URL', async () => {
      const mockQueueItem = {
        id: '456e7890-e89b-12d3-a456-426614174003',
        url: 'https://www.tiktok.com/@username/video/1234567890',
        platform: 'tiktok' as const,
        submitted_by: 'admin@example.com',
        status: 'pending' as const,
        queue_type: 'input' as const,
        content: null,
        created_at: new Date(),
        processed_at: null,
        published_at: null,
      };

      mockQueueItemRepository.create.mockResolvedValue(mockQueueItem);

      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com',
        },
        body: JSON.stringify({
          url: 'https://www.tiktok.com/@username/video/1234567890',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.platform).toBe('tiktok');
      expect(data.data.videoId).toBe('1234567890');
      expect(data.data.username).toBe('username');
    });

    it('should reject invalid URLs', async () => {
      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com',
        },
        body: JSON.stringify({
          url: 'https://example.com/invalid',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation error');
    });

    it('should reject duplicate URLs', async () => {
      const existingItem = {
        id: '456e7890-e89b-12d3-a456-426614174004',
        url: 'https://www.instagram.com/reel/ABC123/',
        platform: 'instagram' as const,
        submitted_by: 'admin@example.com',
        status: 'pending' as const,
        queue_type: 'input' as const,
        content: null,
        created_at: new Date(),
        processed_at: null,
        published_at: null,
      };

      mockQueueItemRepository.findByQueueType.mockResolvedValue([existingItem]);

      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com',
        },
        body: JSON.stringify({
          url: 'https://www.instagram.com/reel/ABC123/',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toBe('This video URL has already been submitted');
    });

    it('should require admin authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://www.instagram.com/reel/ABC123/',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin email header is required');
    });

    it('should reject inactive admin', async () => {
      const inactiveAdmin = {
        ...mockAdmin,
        is_active: false,
      };

      mockAdminRepository.findByEmail.mockResolvedValue(inactiveAdmin);

      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com',
        },
        body: JSON.stringify({
          url: 'https://www.instagram.com/reel/ABC123/',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin account is inactive');
    });

    it('should reject non-existent admin', async () => {
      mockAdminRepository.findByEmail.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'nonexistent@example.com',
        },
        body: JSON.stringify({
          url: 'https://www.instagram.com/reel/ABC123/',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin not found');
    });

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com',
        },
        body: JSON.stringify({
          // Missing url field
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation error');
      expect(data.errors).toBeDefined();
    });
  });

  describe('GET /api/links', () => {
    const mockAdmin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'admin@example.com',
      name: 'Test Admin',
      is_active: true,
      created_at: new Date(),
      last_active: new Date(),
    };

    beforeEach(() => {
      mockAdminRepository.findByEmail.mockResolvedValue(mockAdmin);
      mockAdminRepository.updateLastActive.mockResolvedValue();
    });

    it('should return queue status and recent submissions', async () => {
      const mockCounts = {
        input: 5,
        ready_to_publish: 3,
        failed: 1,
      };

      const mockRecentItems = [
        {
          id: '456e7890-e89b-12d3-a456-426614174001',
          url: 'https://www.instagram.com/reel/ABC123/',
          platform: 'instagram' as const,
          submitted_by: 'admin@example.com',
          status: 'pending' as const,
          queue_type: 'input' as const,
          content: null,
          created_at: new Date(),
          processed_at: null,
          published_at: null,
        },
      ];

      mockQueueItemRepository.getQueueCounts.mockResolvedValue(mockCounts);
      mockQueueItemRepository.findByQueueType.mockResolvedValue(mockRecentItems);

      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'GET',
        headers: {
          'x-admin-email': 'admin@example.com',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.queueCounts).toEqual(mockCounts);
      expect(data.data.recentSubmissions).toHaveLength(1);
      expect(data.data.recentSubmissions[0].url).toBe('https://www.instagram.com/reel/ABC123/');
    });

    it('should require admin authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/links', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin email header is required');
    });
  });
});