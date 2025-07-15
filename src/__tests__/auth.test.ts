/**
 * @jest-environment node
 */

// Mock Next.js server components before importing
class MockRequest {
  url: string;
  method: string;
  headers: Map<string, string>;
  _body: string;

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

class MockResponse {
  body: any;
  status: number;
  headers: Map<string, string>;

  constructor(body?: any, init?: any) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Map(Object.entries(init?.headers || {}));
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

Object.defineProperty(global, 'Request', { value: MockRequest });
Object.defineProperty(global, 'Response', { value: MockResponse });

import { NextRequest } from 'next/server';
import { validateAdminAuth, withAdminAuth, AuthenticationError, AuthorizationError } from '../lib/auth';
import { AdminRepository } from '../lib/database';

// Mock the database module
jest.mock('../lib/database', () => ({
  AdminRepository: {
    findByEmail: jest.fn(),
    updateLastActive: jest.fn(),
  },
}));

const mockAdminRepository = AdminRepository as jest.Mocked<typeof AdminRepository>;

describe('Authentication Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAdminAuth', () => {
    const mockAdmin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test Admin',
      is_active: true,
      created_at: new Date('2024-01-01T00:00:00Z'),
      last_active: null,
    };

    it('should validate admin successfully', async () => {
      mockAdminRepository.findByEmail.mockResolvedValueOnce(mockAdmin);
      mockAdminRepository.updateLastActive.mockResolvedValueOnce(undefined);

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-admin-email': 'test@example.com',
        },
      });

      const result = await validateAdminAuth(request);

      expect(result.email).toBe('test@example.com');
      expect(result.admin.id).toBe(mockAdmin.id);
      expect(mockAdminRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockAdminRepository.updateLastActive).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw AuthenticationError when email header is missing', async () => {
      const request = new NextRequest('http://localhost/api/test');

      await expect(validateAdminAuth(request)).rejects.toThrow(AuthenticationError);
      await expect(validateAdminAuth(request)).rejects.toThrow('Admin email header is required');
    });

    it('should throw AuthenticationError for invalid email format', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-admin-email': 'invalid-email',
        },
      });

      await expect(validateAdminAuth(request)).rejects.toThrow(AuthenticationError);
      await expect(validateAdminAuth(request)).rejects.toThrow('Invalid email format');
    });

    it('should throw AuthorizationError when admin not found', async () => {
      mockAdminRepository.findByEmail.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-admin-email': 'notfound@example.com',
        },
      });

      await expect(validateAdminAuth(request)).rejects.toThrow(AuthorizationError);
      await expect(validateAdminAuth(request)).rejects.toThrow('Admin not found');
    });

    it('should throw AuthorizationError when admin is inactive', async () => {
      const inactiveAdmin = { ...mockAdmin, is_active: false };
      mockAdminRepository.findByEmail.mockResolvedValue(inactiveAdmin);

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-admin-email': 'test@example.com',
        },
      });

      await expect(validateAdminAuth(request)).rejects.toThrow(AuthorizationError);
      await expect(validateAdminAuth(request)).rejects.toThrow('Admin account is inactive');
    });
  });

  describe('withAdminAuth', () => {
    const mockAdmin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test Admin',
      is_active: true,
      created_at: new Date('2024-01-01T00:00:00Z'),
      last_active: null,
    };

    it('should call handler with auth data when authentication succeeds', async () => {
      mockAdminRepository.findByEmail.mockResolvedValueOnce(mockAdmin);
      mockAdminRepository.updateLastActive.mockResolvedValueOnce(undefined);

      const mockHandler = jest.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const wrappedHandler = withAdminAuth(mockHandler);

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-admin-email': 'test@example.com',
        },
      });

      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(
        request,
        {
          email: 'test@example.com',
          admin: expect.objectContaining({
            id: mockAdmin.id,
            email: mockAdmin.email,
          }),
        }
      );
    });

    it('should return 401 for authentication errors', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAdminAuth(mockHandler);

      const request = new NextRequest('http://localhost/api/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin email header is required');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should return 403 for authorization errors', async () => {
      mockAdminRepository.findByEmail.mockResolvedValueOnce(null);

      const mockHandler = jest.fn();
      const wrappedHandler = withAdminAuth(mockHandler);

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-admin-email': 'notfound@example.com',
        },
      });

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Admin not found');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should return 500 for unexpected errors', async () => {
      mockAdminRepository.findByEmail.mockRejectedValueOnce(new Error('Database error'));

      const mockHandler = jest.fn();
      const wrappedHandler = withAdminAuth(mockHandler);

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-admin-email': 'test@example.com',
        },
      });

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Authentication failed');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});