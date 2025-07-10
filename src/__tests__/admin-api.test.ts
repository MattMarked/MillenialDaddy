/**
 * @jest-environment node
 */

// Mock Next.js server components before importing
Object.defineProperty(global, 'Request', {
  value: class MockRequest {
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this._body = init?.body;
    }
    async json() {
      return JSON.parse(this._body);
    }
  }
});

Object.defineProperty(global, 'Response', {
  value: class MockResponse {
    constructor(body?: any, init?: any) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = new Map(Object.entries(init?.headers || {}));
    }
    async json() {
      return JSON.parse(this.body);
    }
  }
});

import { NextRequest } from 'next/server';
import { POST as addAdmin } from '../app/api/admin/add/route';
import { DELETE as removeAdmin } from '../app/api/admin/remove/route';
import { GET as listAdmins } from '../app/api/admin/list/route';
import { AdminRepository } from '../lib/database';

// Mock the database module
jest.mock('../lib/database', () => ({
  AdminRepository: {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, cause?: Error) {
      super(message);
      this.name = 'DatabaseError';
      this.cause = cause;
    }
  },
}));

const mockAdminRepository = AdminRepository as jest.Mocked<typeof AdminRepository>;

describe('Admin Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/add', () => {
    const mockAdmin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test Admin',
      is_active: true,
      created_at: new Date('2024-01-01T00:00:00Z'),
      last_active: null,
    };

    it('should create a new admin successfully', async () => {
      mockAdminRepository.findByEmail.mockResolvedValueOnce(null);
      mockAdminRepository.create.mockResolvedValueOnce(mockAdmin);

      const request = new NextRequest('http://localhost/api/admin/add', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test Admin',
          isActive: true,
        }),
      });

      const response = await addAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Admin added successfully');
      expect(data.admin.email).toBe('test@example.com');
      expect(mockAdminRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockAdminRepository.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test Admin',
        isActive: true,
      });
    });

    it('should return 409 when admin already exists', async () => {
      mockAdminRepository.findByEmail.mockResolvedValueOnce(mockAdmin);

      const request = new NextRequest('http://localhost/api/admin/add', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test Admin',
        }),
      });

      const response = await addAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin with this email already exists');
    });

    it('should return 400 for invalid email', async () => {
      const request = new NextRequest('http://localhost/api/admin/add', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          name: 'Test Admin',
        }),
      });

      const response = await addAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation error');
      expect(data.errors).toBeDefined();
    });

    it('should return 400 for missing name', async () => {
      const request = new NextRequest('http://localhost/api/admin/add', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      });

      const response = await addAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation error');
    });
  });

  describe('DELETE /api/admin/remove', () => {
    const mockAdmin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test Admin',
      is_active: true,
      created_at: new Date('2024-01-01T00:00:00Z'),
      last_active: null,
    };

    it('should remove admin successfully', async () => {
      mockAdminRepository.findById.mockResolvedValueOnce(mockAdmin);
      mockAdminRepository.delete.mockResolvedValueOnce(true);

      const request = new NextRequest('http://localhost/api/admin/remove', {
        method: 'DELETE',
        body: JSON.stringify({
          id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const response = await removeAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Admin removed successfully');
      expect(data.removedAdmin.email).toBe('test@example.com');
      expect(mockAdminRepository.findById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(mockAdminRepository.delete).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return 404 when admin not found', async () => {
      mockAdminRepository.findById.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/admin/remove', {
        method: 'DELETE',
        body: JSON.stringify({
          id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const response = await removeAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin not found');
    });

    it('should return 400 for invalid UUID', async () => {
      const request = new NextRequest('http://localhost/api/admin/remove', {
        method: 'DELETE',
        body: JSON.stringify({
          id: 'invalid-uuid',
        }),
      });

      const response = await removeAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation error');
    });

    it('should return 500 when deletion fails', async () => {
      mockAdminRepository.findById.mockResolvedValueOnce(mockAdmin);
      mockAdminRepository.delete.mockResolvedValueOnce(false);

      const request = new NextRequest('http://localhost/api/admin/remove', {
        method: 'DELETE',
        body: JSON.stringify({
          id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const response = await removeAdmin(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to remove admin');
    });
  });

  describe('GET /api/admin/list', () => {
    const mockAdmins = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin1@example.com',
        name: 'Admin One',
        is_active: true,
        created_at: new Date('2024-01-01T00:00:00Z'),
        last_active: new Date('2024-01-02T00:00:00Z'),
      },
      {
        id: '456e7890-e89b-12d3-a456-426614174001',
        email: 'admin2@example.com',
        name: 'Admin Two',
        is_active: false,
        created_at: new Date('2024-01-03T00:00:00Z'),
        last_active: null,
      },
    ];

    it('should return list of admins successfully', async () => {
      mockAdminRepository.list.mockResolvedValueOnce(mockAdmins);

      const response = await listAdmins();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.admins).toHaveLength(2);
      expect(data.admins[0].email).toBe('admin1@example.com');
      expect(data.admins[1].email).toBe('admin2@example.com');
      expect(mockAdminRepository.list).toHaveBeenCalled();
    });

    it('should return empty list when no admins exist', async () => {
      mockAdminRepository.list.mockResolvedValueOnce([]);

      const response = await listAdmins();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(0);
      expect(data.admins).toHaveLength(0);
    });
  });
});