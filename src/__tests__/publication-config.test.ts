import { PublicationConfigManager } from '@/lib/publication-config';
import { PublicationConfig } from '@/types';
import { database } from '@/lib/database';

// Mock the database module
jest.mock('@/lib/database', () => ({
  database: {
    query: jest.fn()
  }
}));

const mockDatabase = database as jest.Mocked<typeof database>;

describe('PublicationConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current time to a fixed date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getConfig', () => {
    it('should return default config when no config exists', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const config = await PublicationConfigManager.getConfig();

      expect(config).toEqual({
        frequency: 'daily',
        times: ['09:00'],
        timezone: 'UTC'
      });
    });

    it('should return stored config when it exists', async () => {
      const storedConfig: PublicationConfig = {
        frequency: 'multiple-daily',
        times: ['09:00', '15:00', '21:00'],
        timezone: 'America/New_York'
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ value: storedConfig }]
      });

      const config = await PublicationConfigManager.getConfig();

      expect(config).toEqual(storedConfig);
    });

    it('should return default config on database error', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      const config = await PublicationConfigManager.getConfig();

      expect(config).toEqual({
        frequency: 'daily',
        times: ['09:00'],
        timezone: 'UTC'
      });
    });
  });

  describe('updateConfig', () => {
    it('should successfully update valid daily configuration', async () => {
      const validConfig: PublicationConfig = {
        frequency: 'daily',
        times: ['14:30'],
        timezone: 'Europe/London'
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await PublicationConfigManager.updateConfig(validConfig);

      expect(result.success).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_config'),
        ['publication_config', JSON.stringify(validConfig)]
      );
    });

    it('should successfully update valid multiple-daily configuration', async () => {
      const validConfig: PublicationConfig = {
        frequency: 'multiple-daily',
        times: ['08:00', '12:00', '18:00'],
        timezone: 'Asia/Tokyo'
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await PublicationConfigManager.updateConfig(validConfig);

      expect(result.success).toBe(true);
    });

    it('should successfully update valid every-x-days configuration', async () => {
      const validConfig: PublicationConfig = {
        frequency: 'every-x-days',
        times: ['10:00'],
        interval: 3,
        timezone: 'UTC'
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await PublicationConfigManager.updateConfig(validConfig);

      expect(result.success).toBe(true);
    });

    it('should reject invalid time format', async () => {
      const invalidConfig = {
        frequency: 'daily',
        times: ['25:00'], // Invalid hour
        timezone: 'UTC'
      } as PublicationConfig;

      const result = await PublicationConfigManager.updateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid time format');
    });

    it('should reject daily config with multiple times', async () => {
      const invalidConfig = {
        frequency: 'daily',
        times: ['09:00', '15:00'], // Daily should have only one time
        timezone: 'UTC'
      } as PublicationConfig;

      const result = await PublicationConfigManager.updateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should reject multiple-daily config with single time', async () => {
      const invalidConfig = {
        frequency: 'multiple-daily',
        times: ['09:00'], // Multiple-daily should have multiple times
        timezone: 'UTC'
      } as PublicationConfig;

      const result = await PublicationConfigManager.updateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should reject every-x-days config without interval', async () => {
      const invalidConfig = {
        frequency: 'every-x-days',
        times: ['09:00'],
        timezone: 'UTC'
        // Missing interval
      } as PublicationConfig;

      const result = await PublicationConfigManager.updateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should handle database errors gracefully', async () => {
      const validConfig: PublicationConfig = {
        frequency: 'daily',
        times: ['09:00'],
        timezone: 'UTC'
      };

      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await PublicationConfigManager.updateConfig(validConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('getNextPublicationTime', () => {
    it('should calculate next daily publication time correctly', async () => {
      const config: PublicationConfig = {
        frequency: 'daily',
        times: ['14:00'],
        timezone: 'UTC'
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ value: config }]
      });

      // Current time is 10:00, next publication should be 14:00 today
      const nextTime = await PublicationConfigManager.getNextPublicationTime();

      expect(nextTime).toBeDefined();
      expect(nextTime!.getHours()).toBe(14);
      expect(nextTime!.getMinutes()).toBe(0);
    });

    it('should schedule for next day if time has passed', async () => {
      const config: PublicationConfig = {
        frequency: 'daily',
        times: ['08:00'],
        timezone: 'UTC'
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ value: config }]
      });

      // Current time is 10:00, next publication should be 08:00 tomorrow
      const nextTime = await PublicationConfigManager.getNextPublicationTime();

      expect(nextTime).toBeDefined();
      expect(nextTime!.getDate()).toBe(16); // Tomorrow
      expect(nextTime!.getHours()).toBe(8);
    });

    it('should find next available time for multiple-daily', async () => {
      const config: PublicationConfig = {
        frequency: 'multiple-daily',
        times: ['08:00', '12:00', '16:00'],
        timezone: 'UTC'
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ value: config }]
      });

      // Current time is 10:00, next publication should be 12:00 today
      const nextTime = await PublicationConfigManager.getNextPublicationTime();

      expect(nextTime).toBeDefined();
      expect(nextTime!.getHours()).toBe(12);
      expect(nextTime!.getMinutes()).toBe(0);
    });

    it('should handle every-x-days interval correctly', async () => {
      const config: PublicationConfig = {
        frequency: 'every-x-days',
        times: ['09:00'],
        interval: 2,
        timezone: 'UTC'
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ value: config }]
      });

      // Current time is 10:00, next publication should be in 2 days at 09:00
      const nextTime = await PublicationConfigManager.getNextPublicationTime();

      expect(nextTime).toBeDefined();
      expect(nextTime!.getDate()).toBe(17); // 2 days from now
      expect(nextTime!.getHours()).toBe(9);
    });
  });

  describe('shouldPublishNow', () => {
    it('should return true when within publication window', async () => {
      const config: PublicationConfig = {
        frequency: 'daily',
        times: ['10:02'], // 2 minutes from current time
        timezone: 'UTC'
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ value: config }]
      });

      const shouldPublish = await PublicationConfigManager.shouldPublishNow();

      expect(shouldPublish).toBe(true);
    });

    it('should return false when outside publication window', async () => {
      const config: PublicationConfig = {
        frequency: 'daily',
        times: ['14:00'], // 4 hours from current time
        timezone: 'UTC'
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ value: config }]
      });

      const shouldPublish = await PublicationConfigManager.shouldPublishNow();

      expect(shouldPublish).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      const shouldPublish = await PublicationConfigManager.shouldPublishNow();

      expect(shouldPublish).toBe(false);
    });
  });
});