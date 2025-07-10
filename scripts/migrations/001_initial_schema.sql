-- Initial database schema for Video Link Queue Service
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(is_active);

-- Create queue_items table
CREATE TABLE IF NOT EXISTS queue_items (
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

-- Create indexes for queue_items
CREATE INDEX IF NOT EXISTS idx_queue_items_queue_type ON queue_items(queue_type);
CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status);
CREATE INDEX IF NOT EXISTS idx_queue_items_platform ON queue_items(platform);
CREATE INDEX IF NOT EXISTS idx_queue_items_submitted_by ON queue_items(submitted_by);
CREATE INDEX IF NOT EXISTS idx_queue_items_created_at ON queue_items(created_at);

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on updated_at for system_config
CREATE INDEX IF NOT EXISTS idx_system_config_updated_at ON system_config(updated_at);

-- Add foreign key constraint to link queue_items to admins
ALTER TABLE queue_items 
ADD CONSTRAINT fk_queue_items_submitted_by 
FOREIGN KEY (submitted_by) REFERENCES admins(email) 
ON DELETE CASCADE;