#!/usr/bin/env tsx

import { AdminRepository, SystemConfigRepository } from '../src/lib/database';

interface SeedData {
  admins: Array<{
    email: string;
    name: string;
    is_active: boolean;
  }>;
  systemConfig: Array<{
    key: string;
    value: Record<string, any>;
  }>;
}

const seedData: SeedData = {
  admins: [
    {
      email: 'admin@example.com',
      name: 'System Administrator',
      is_active: true,
    },
  ],
  systemConfig: [
    {
      key: 'publication_config',
      value: {
        frequency: 'daily',
        times: ['09:00'],
        timezone: 'UTC',
      },
    },
    {
      key: 'processing_config',
      value: {
        maxRetries: 3,
        timeoutMs: 30000,
      },
    },
    {
      key: 'instagram_config',
      value: {
        accessToken: '',
        accountId: '',
        // These will need to be set manually via environment variables
      },
    },
    {
      key: 'ai_config',
      value: {
        openaiApiKey: '',
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        // This will need to be set manually via environment variables
      },
    },
  ],
};

async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Seed admins
    console.log('👥 Seeding admins...');
    for (const adminData of seedData.admins) {
      try {
        // Check if admin already exists
        const existingAdmin = await AdminRepository.findByEmail(adminData.email);
        if (existingAdmin) {
          console.log(`⏭️  Admin ${adminData.email} already exists, skipping`);
          continue;
        }
        
        const admin = await AdminRepository.create(adminData);
        console.log(`✅ Created admin: ${admin.email}`);
      } catch (error) {
        console.error(`❌ Failed to create admin ${adminData.email}:`, error);
      }
    }
    
    // Seed system configuration
    console.log('⚙️  Seeding system configuration...');
    for (const configData of seedData.systemConfig) {
      try {
        const config = await SystemConfigRepository.set(configData.key, configData.value);
        console.log(`✅ Set config: ${config.key}`);
      } catch (error) {
        console.error(`❌ Failed to set config ${configData.key}:`, error);
      }
    }
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('💥 Database seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase, seedData };