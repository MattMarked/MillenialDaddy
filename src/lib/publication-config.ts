import { PublicationConfig } from '@/types';
import { database } from './database';
import { z } from 'zod';

// Validation schema for publication configuration
const PublicationConfigSchema = z.object({
  frequency: z.enum(['daily', 'multiple-daily', 'every-x-days']),
  times: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM')),
  interval: z.number().min(1).max(30).optional(),
  timezone: z.string().min(1, 'Timezone is required')
}).refine((data) => {
  // If frequency is 'every-x-days', interval is required
  if (data.frequency === 'every-x-days' && !data.interval) {
    return false;
  }
  // If frequency is 'daily', only one time should be provided
  if (data.frequency === 'daily' && data.times.length !== 1) {
    return false;
  }
  // If frequency is 'multiple-daily', multiple times should be provided
  if (data.frequency === 'multiple-daily' && data.times.length < 2) {
    return false;
  }
  return true;
}, {
  message: 'Invalid configuration for the selected frequency'
});

export class PublicationConfigManager {
  private static readonly CONFIG_KEY = 'publication_config';
  private static readonly DEFAULT_CONFIG: PublicationConfig = {
    frequency: 'daily',
    times: ['09:00'],
    timezone: 'UTC'
  };

  /**
   * Get the current publication configuration
   */
  static async getConfig(): Promise<PublicationConfig> {
    try {
      const result = await database.query(
        'SELECT value FROM system_config WHERE key = $1',
        [this.CONFIG_KEY]
      );

      if (result.rows.length === 0) {
        // Return default config if none exists
        return this.DEFAULT_CONFIG;
      }

      const config = result.rows[0].value as PublicationConfig;
      return this.validateConfig(config);
    } catch (error) {
      console.error('Error fetching publication config:', error);
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update the publication configuration
   */
  static async updateConfig(config: PublicationConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate the configuration
      const validatedConfig = this.validateConfig(config);

      // Upsert the configuration
      await database.query(
        `INSERT INTO system_config (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = NOW()`,
        [this.CONFIG_KEY, JSON.stringify(validatedConfig)]
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating publication config:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Validate publication configuration
   */
  private static validateConfig(config: any): PublicationConfig {
    const result = PublicationConfigSchema.safeParse(config);
    
    if (!result.success) {
      throw new Error(`Invalid publication configuration: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Get the next scheduled publication time based on current configuration
   */
  static async getNextPublicationTime(): Promise<Date | null> {
    try {
      const config = await this.getConfig();
      const now = new Date();
      
      // Convert current time to the configured timezone
      const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
      
      switch (config.frequency) {
        case 'daily':
          return this.getNextDailyTime(nowInTimezone, config.times[0], config.timezone);
          
        case 'multiple-daily':
          return this.getNextMultipleDailyTime(nowInTimezone, config.times, config.timezone);
          
        case 'every-x-days':
          return this.getNextIntervalTime(nowInTimezone, config.times[0], config.interval!, config.timezone);
          
        default:
          return null;
      }
    } catch (error) {
      console.error('Error calculating next publication time:', error);
      return null;
    }
  }

  /**
   * Calculate next daily publication time
   */
  private static getNextDailyTime(now: Date, time: string, timezone: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const nextTime = new Date(now);
    nextTime.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }

    return nextTime;
  }

  /**
   * Calculate next multiple daily publication time
   */
  private static getNextMultipleDailyTime(now: Date, times: string[], timezone: string): Date {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Find the next time slot today
    for (const time of times.sort()) {
      const [hours, minutes] = time.split(':').map(Number);
      const timeInMinutes = hours * 60 + minutes;
      
      if (timeInMinutes > currentTime) {
        const nextTime = new Date(now);
        nextTime.setHours(hours, minutes, 0, 0);
        return nextTime;
      }
    }

    // If no more times today, use the first time tomorrow
    const [hours, minutes] = times.sort()[0].split(':').map(Number);
    const nextTime = new Date(now);
    nextTime.setDate(nextTime.getDate() + 1);
    nextTime.setHours(hours, minutes, 0, 0);
    
    return nextTime;
  }

  /**
   * Calculate next interval-based publication time
   */
  private static getNextIntervalTime(now: Date, time: string, interval: number, timezone: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const nextTime = new Date(now);
    nextTime.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, add the interval
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + interval);
    }

    return nextTime;
  }

  /**
   * Check if it's time to publish based on current configuration
   */
  static async shouldPublishNow(): Promise<boolean> {
    try {
      const nextTime = await this.getNextPublicationTime();
      if (!nextTime) return false;

      const now = new Date();
      const timeDiff = Math.abs(nextTime.getTime() - now.getTime());
      
      // Allow 5-minute window for publication
      return timeDiff <= 5 * 60 * 1000;
    } catch (error) {
      console.error('Error checking publication time:', error);
      return false;
    }
  }
}