import { logger } from './logger';

export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private context?: Record<string, any>;

  constructor(operation: string, context?: Record<string, any>) {
    this.operation = operation;
    this.context = context;
    this.startTime = Date.now();
  }

  async end(additionalContext?: Record<string, any>): Promise<number> {
    const duration = Date.now() - this.startTime;
    const finalContext = { ...this.context, ...additionalContext };
    
    await logger.logPerformance(this.operation, duration, finalContext);
    return duration;
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

export function startTimer(operation: string, context?: Record<string, any>): PerformanceTimer {
  return new PerformanceTimer(operation, context);
}

// Decorator for timing async functions
export function timed(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operationName = operation || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const timer = startTimer(operationName, {
        className: target.constructor.name,
        methodName: propertyName,
        args: args.length
      });

      try {
        const result = await method.apply(this, args);
        await timer.end({ success: true });
        return result;
      } catch (error) {
        await timer.end({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        throw error;
      }
    };

    return descriptor;
  };
}

// Utility for measuring code blocks
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const timer = startTimer(operation, context);
  
  try {
    const result = await fn();
    await timer.end({ success: true });
    return result;
  } catch (error) {
    await timer.end({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
}

export function measure<T>(
  operation: string,
  fn: () => T,
  context?: Record<string, any>
): T {
  const startTime = Date.now();
  
  try {
    const result = fn();
    const duration = Date.now() - startTime;
    
    // Log synchronously for sync operations
    logger.logPerformance(operation, duration, { ...context, success: true });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logPerformance(operation, duration, { 
      ...context, 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
}