# Database Setup and Usage

This document describes the database schema, utilities, and setup procedures for the Video Link Queue Service.

## Overview

The service uses PostgreSQL as the primary database, with support for Vercel Postgres in production. The database consists of three main tables:

- `admins`: Manages system administrators who can submit links
- `queue_items`: Stores video links and their processing status
- `system_config`: Stores system configuration settings

## Database Schema

### Admins Table

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP
);
```

### Queue Items Table

```sql
CREATE TABLE queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok')),
  submitted_by VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  queue_type VARCHAR(50) NOT NULL DEFAULT 'input' CHECK (queue_type IN ('input', 'ready_to_publish')),
  content JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  published_at TIMESTAMP
);
```

### System Config Table

```sql
CREATE TABLE system_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Setup Instructions

### 1. Environment Variables

Set up your database connection string in `.env.local`:

```bash
# For Vercel Postgres
POSTGRES_URL="postgres://username:password@host:port/database"
POSTGRES_PRISMA_URL="postgres://username:password@host:port/database?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgres://username:password@host:port/database"

# For local development
DATABASE_URL="postgresql://username:password@localhost:5432/video_queue_dev"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Migrations

```bash
npm run db:migrate
```

### 4. Seed Initial Data

```bash
npm run db:seed
```

### 5. Complete Setup (Migration + Seeding)

```bash
npm run db:setup
```

## Database Utilities

### AdminRepository

Manages admin users with the following methods:

```typescript
// Create a new admin
const admin = await AdminRepository.create({
  email: 'admin@example.com',
  name: 'Admin Name',
  is_active: true
});

// Find admin by email
const admin = await AdminRepository.findByEmail('admin@example.com');

// List all admins
const admins = await AdminRepository.list();

// Delete admin
await AdminRepository.delete(adminId);

// Update last active timestamp
await AdminRepository.updateLastActive('admin@example.com');
```

### QueueItemRepository

Manages queue items with the following methods:

```typescript
// Create a new queue item
const item = await QueueItemRepository.create({
  url: 'https://www.youtube.com/watch?v=example',
  platform: 'youtube',
  submitted_by: 'admin@example.com'
});

// Find items by queue type
const inputItems = await QueueItemRepository.findByQueueType('input');
const readyItems = await QueueItemRepository.findByQueueType('ready_to_publish');

// Update item status
await QueueItemRepository.updateStatus(itemId, 'processing');

// Move item between queues
await QueueItemRepository.moveToQueue(itemId, 'ready_to_publish');

// Get queue counts for monitoring
const counts = await QueueItemRepository.getQueueCounts();
// Returns: { input: 5, ready_to_publish: 3, failed: 2 }
```

### SystemConfigRepository

Manages system configuration:

```typescript
// Set configuration
await SystemConfigRepository.set('publication_config', {
  frequency: 'daily',
  times: ['09:00'],
  timezone: 'UTC'
});

// Get configuration
const config = await SystemConfigRepository.get('publication_config');

// Get all configurations
const allConfigs = await SystemConfigRepository.getAll();
```

## Error Handling

The database utilities include comprehensive error handling:

```typescript
try {
  const admin = await AdminRepository.create(adminData);
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('Database operation failed:', error.message);
    console.error('Caused by:', error.cause);
  }
}
```

## Connection Health Check

Check database connectivity:

```typescript
const isHealthy = await checkDatabaseConnection();
if (!isHealthy) {
  console.error('Database connection failed');
}
```

## Migration Management

The migration system tracks executed migrations in a `migrations` table:

```sql
CREATE TABLE migrations (
  id VARCHAR(255) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

### Adding New Migrations

1. Create a new SQL file in `scripts/migrations/` with format `XXX_description.sql`
2. Add the filename to the `migrationFiles` array in `scripts/migrate.ts`
3. Run `npm run db:migrate`

## Testing

Run database tests:

```bash
npm test src/__tests__/database.test.ts
```

The tests use mocked database connections to ensure they run without requiring a live database.

## Production Considerations

### Vercel Postgres

- Uses connection pooling automatically
- Limited to 60 concurrent connections on free tier
- Supports up to 1GB storage on free tier

### Connection Pooling

The `@vercel/postgres` package handles connection pooling automatically. For other environments, consider using a connection pooler like PgBouncer.

### Monitoring

Monitor database performance using:

- Queue count metrics via `QueueItemRepository.getQueueCounts()`
- Connection health via `checkDatabaseConnection()`
- Error logs from `DatabaseError` instances

### Backup and Recovery

For production deployments:

1. Enable automated backups on your PostgreSQL provider
2. Test backup restoration procedures
3. Monitor disk usage and connection limits
4. Set up alerting for database errors