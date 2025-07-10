import { sql } from '@vercel/postgres';
import { z } from 'zod';

// Database connection and error handling
export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Connection utility with error handling
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const result = await sql.query(query, params);
    return result.rows as T[];
  } catch (error) {
    throw new DatabaseError(
      `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

// Admin model and validation
export const AdminSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  is_active: z.boolean(),
  created_at: z.date(),
  last_active: z.date().nullable(),
});

export type Admin = z.infer<typeof AdminSchema>;

export const CreateAdminSchema = AdminSchema.omit({
  id: true,
  created_at: true,
  last_active: true,
}).extend({
  is_active: z.boolean().default(true),
});

export type CreateAdmin = z.infer<typeof CreateAdminSchema>;

// Queue Item model and validation
export const QueueItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  platform: z.enum(['instagram', 'youtube', 'tiktok']),
  submitted_by: z.string().email(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  queue_type: z.enum(['input', 'ready_to_publish']),
  content: z.record(z.any()).nullable(),
  created_at: z.date(),
  processed_at: z.date().nullable(),
  published_at: z.date().nullable(),
});

export type QueueItem = z.infer<typeof QueueItemSchema>;

export const CreateQueueItemSchema = QueueItemSchema.omit({
  id: true,
  created_at: true,
  processed_at: true,
  published_at: true,
}).extend({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  queue_type: z.enum(['input', 'ready_to_publish']).default('input'),
  content: z.record(z.any()).nullable().default(null),
});

export type CreateQueueItem = z.infer<typeof CreateQueueItemSchema>;

// System Config model and validation
export const SystemConfigSchema = z.object({
  key: z.string().max(255),
  value: z.record(z.any()),
  updated_at: z.date(),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

export const CreateSystemConfigSchema = SystemConfigSchema.omit({
  updated_at: true,
});

export type CreateSystemConfig = z.infer<typeof CreateSystemConfigSchema>;

// Database utility functions for Admins
export class AdminRepository {
  static async create(admin: CreateAdmin): Promise<Admin> {
    const validated = CreateAdminSchema.parse(admin);
    
    const query = `
      INSERT INTO admins (id, email, name, is_active, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW())
      RETURNING *
    `;
    
    const result = await executeQuery<Admin>(query, [
      validated.email,
      validated.name,
      validated.is_active,
    ]);
    
    if (result.length === 0) {
      throw new DatabaseError('Failed to create admin');
    }
    
    return AdminSchema.parse(result[0]);
  }

  static async findByEmail(email: string): Promise<Admin | null> {
    const query = 'SELECT * FROM admins WHERE email = $1';
    const result = await executeQuery<Admin>(query, [email]);
    
    if (result.length === 0) {
      return null;
    }
    
    return AdminSchema.parse(result[0]);
  }

  static async findById(id: string): Promise<Admin | null> {
    const query = 'SELECT * FROM admins WHERE id = $1';
    const result = await executeQuery<Admin>(query, [id]);
    
    if (result.length === 0) {
      return null;
    }
    
    return AdminSchema.parse(result[0]);
  }

  static async list(): Promise<Admin[]> {
    const query = 'SELECT * FROM admins ORDER BY created_at DESC';
    const result = await executeQuery<Admin>(query);
    
    return result.map(admin => AdminSchema.parse(admin));
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM admins WHERE id = $1';
    const result = await executeQuery(query, [id]);
    
    return result.length > 0;
  }

  static async updateLastActive(email: string): Promise<void> {
    const query = 'UPDATE admins SET last_active = NOW() WHERE email = $1';
    await executeQuery(query, [email]);
  }

  static async setActive(id: string, isActive: boolean): Promise<boolean> {
    const query = 'UPDATE admins SET is_active = $1 WHERE id = $2';
    const result = await executeQuery(query, [isActive, id]);
    
    return result.length > 0;
  }
}

// Database utility functions for Queue Items
export class QueueItemRepository {
  static async create(item: CreateQueueItem): Promise<QueueItem> {
    const validated = CreateQueueItemSchema.parse(item);
    
    const query = `
      INSERT INTO queue_items (id, url, platform, submitted_by, status, queue_type, content, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
    
    const result = await executeQuery<QueueItem>(query, [
      validated.url,
      validated.platform,
      validated.submitted_by,
      validated.status,
      validated.queue_type,
      JSON.stringify(validated.content),
    ]);
    
    if (result.length === 0) {
      throw new DatabaseError('Failed to create queue item');
    }
    
    return QueueItemSchema.parse(result[0]);
  }

  static async findById(id: string): Promise<QueueItem | null> {
    const query = 'SELECT * FROM queue_items WHERE id = $1';
    const result = await executeQuery<QueueItem>(query, [id]);
    
    if (result.length === 0) {
      return null;
    }
    
    return QueueItemSchema.parse(result[0]);
  }

  static async findByQueueType(queueType: 'input' | 'ready_to_publish'): Promise<QueueItem[]> {
    const query = 'SELECT * FROM queue_items WHERE queue_type = $1 ORDER BY created_at ASC';
    const result = await executeQuery<QueueItem>(query, [queueType]);
    
    return result.map(item => QueueItemSchema.parse(item));
  }

  static async findByStatus(status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<QueueItem[]> {
    const query = 'SELECT * FROM queue_items WHERE status = $1 ORDER BY created_at ASC';
    const result = await executeQuery<QueueItem>(query, [status]);
    
    return result.map(item => QueueItemSchema.parse(item));
  }

  static async updateStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<boolean> {
    const query = 'UPDATE queue_items SET status = $1 WHERE id = $2';
    const result = await executeQuery(query, [status, id]);
    
    return result.length > 0;
  }

  static async updateContent(id: string, content: Record<string, any>): Promise<boolean> {
    const query = 'UPDATE queue_items SET content = $1, processed_at = NOW() WHERE id = $2';
    const result = await executeQuery(query, [JSON.stringify(content), id]);
    
    return result.length > 0;
  }

  static async moveToQueue(id: string, queueType: 'input' | 'ready_to_publish'): Promise<boolean> {
    const query = 'UPDATE queue_items SET queue_type = $1 WHERE id = $2';
    const result = await executeQuery(query, [queueType, id]);
    
    return result.length > 0;
  }

  static async markPublished(id: string): Promise<boolean> {
    const query = 'UPDATE queue_items SET status = $1, published_at = NOW() WHERE id = $2';
    const result = await executeQuery(query, ['completed', id]);
    
    return result.length > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM queue_items WHERE id = $1';
    const result = await executeQuery(query, [id]);
    
    return result.length > 0;
  }

  static async getQueueCounts(): Promise<{ input: number; ready_to_publish: number; failed: number }> {
    const query = `
      SELECT 
        queue_type,
        status,
        COUNT(*) as count
      FROM queue_items 
      GROUP BY queue_type, status
    `;
    
    const result = await executeQuery<{ queue_type: string; status: string; count: string }>(query);
    
    const counts = {
      input: 0,
      ready_to_publish: 0,
      failed: 0,
    };
    
    result.forEach(row => {
      const count = parseInt(row.count, 10);
      if (row.queue_type === 'input') {
        counts.input += count;
      } else if (row.queue_type === 'ready_to_publish') {
        counts.ready_to_publish += count;
      }
      
      if (row.status === 'failed') {
        counts.failed += count;
      }
    });
    
    return counts;
  }
}

// Database utility functions for System Config
export class SystemConfigRepository {
  static async set(key: string, value: Record<string, any>): Promise<SystemConfig> {
    const validated = CreateSystemConfigSchema.parse({ key, value });
    
    const query = `
      INSERT INTO system_config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) 
      DO UPDATE SET value = $2, updated_at = NOW()
      RETURNING *
    `;
    
    const result = await executeQuery<SystemConfig>(query, [
      validated.key,
      JSON.stringify(validated.value),
    ]);
    
    if (result.length === 0) {
      throw new DatabaseError('Failed to set system config');
    }
    
    return SystemConfigSchema.parse(result[0]);
  }

  static async get(key: string): Promise<SystemConfig | null> {
    const query = 'SELECT * FROM system_config WHERE key = $1';
    const result = await executeQuery<SystemConfig>(query, [key]);
    
    if (result.length === 0) {
      return null;
    }
    
    return SystemConfigSchema.parse(result[0]);
  }

  static async getAll(): Promise<SystemConfig[]> {
    const query = 'SELECT * FROM system_config ORDER BY key';
    const result = await executeQuery<SystemConfig>(query);
    
    return result.map(config => SystemConfigSchema.parse(config));
  }

  static async delete(key: string): Promise<boolean> {
    const query = 'DELETE FROM system_config WHERE key = $1';
    const result = await executeQuery(query, [key]);
    
    return result.length > 0;
  }
}

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}