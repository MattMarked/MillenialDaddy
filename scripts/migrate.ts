#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { join } from 'path';
import { sql } from '@vercel/postgres';

interface Migration {
  id: string;
  filename: string;
  content: string;
}

async function createMigrationsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await sql`SELECT id FROM migrations ORDER BY executed_at`;
  return result.rows.map(row => row.id as string);
}

async function executeMigration(migration: Migration): Promise<void> {
  console.log(`Executing migration: ${migration.filename}`);
  
  try {
    // Execute the migration SQL
    await sql.query(migration.content);
    
    // Record the migration as executed
    await sql`
      INSERT INTO migrations (id, filename, executed_at)
      VALUES (${migration.id}, ${migration.filename}, NOW())
    `;
    
    console.log(`✅ Migration ${migration.filename} executed successfully`);
  } catch (error) {
    console.error(`❌ Migration ${migration.filename} failed:`, error);
    throw error;
  }
}

async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Create migrations table if it doesn't exist
    await createMigrationsTable();
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations();
    console.log(`📋 Found ${executedMigrations.length} executed migrations`);
    
    // Load migration files
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = ['001_initial_schema.sql']; // Add more as needed
    
    const migrations: Migration[] = migrationFiles.map(filename => {
      const id = filename.replace('.sql', '');
      const content = readFileSync(join(migrationsDir, filename), 'utf-8');
      return { id, filename, content };
    });
    
    // Execute pending migrations
    const pendingMigrations = migrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }
    
    console.log(`📦 Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };