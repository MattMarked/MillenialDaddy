import { NextRequest } from 'next/server';
import { AdminRepository } from './database';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Validates admin authentication from request headers
 * Expects 'x-admin-email' header with admin email
 */
export async function validateAdminAuth(request: NextRequest): Promise<{ email: string; admin: any }> {
  const adminEmail = request.headers.get('x-admin-email');
  
  if (!adminEmail) {
    throw new AuthenticationError('Admin email header is required');
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    throw new AuthenticationError('Invalid email format');
  }
  
  // Check if admin exists and is active
  const admin = await AdminRepository.findByEmail(adminEmail);
  
  if (!admin) {
    throw new AuthorizationError('Admin not found');
  }
  
  if (!admin.is_active) {
    throw new AuthorizationError('Admin account is inactive');
  }
  
  // Update last active timestamp
  await AdminRepository.updateLastActive(adminEmail);
  
  return {
    email: adminEmail,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      isActive: admin.is_active,
      createdAt: admin.created_at,
      lastActive: admin.last_active,
    }
  };
}

/**
 * Middleware wrapper for admin authentication
 */
export function withAdminAuth<T extends any[]>(
  handler: (request: NextRequest, auth: { email: string; admin: any }, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const auth = await validateAdminAuth(request);
      return await handler(request, auth, ...args);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return new Response(
          JSON.stringify({
            success: false,
            message: error.message,
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      if (error instanceof AuthorizationError) {
        return new Response(
          JSON.stringify({
            success: false,
            message: error.message,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      console.error('Unexpected authentication error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Authentication failed',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}