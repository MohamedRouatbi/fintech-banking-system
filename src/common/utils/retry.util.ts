import { Logger } from '@nestjs/common';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export class RetryUtil {
  private static readonly logger = new Logger(RetryUtil.name);

  /**
   * Execute function with exponential backoff retry
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    context?: string,
  ): Promise<T> {
    let lastError: Error;
    let delay = config.initialDelayMs;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (config.retryableErrors && error.message) {
          const isRetryable = config.retryableErrors.some((retryableError) =>
            error.message.includes(retryableError),
          );

          if (!isRetryable) {
            this.logger.warn(
              `Non-retryable error in ${context || 'operation'}: ${error.message}`,
            );
            throw error;
          }
        }

        if (attempt < config.maxRetries) {
          this.logger.warn(
            `Retry attempt ${attempt + 1}/${config.maxRetries} for ${context || 'operation'} after ${delay}ms. Error: ${error.message}`,
          );

          await this.sleep(delay);

          // Exponential backoff with jitter
          delay = Math.min(
            delay * config.backoffMultiplier + Math.random() * 1000,
            config.maxDelayMs,
          );
        }
      }
    }

    this.logger.error(
      `All retry attempts failed for ${context || 'operation'}`,
    );
    throw lastError!;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create default retry config
   */
  static defaultConfig(): RetryConfig {
    return {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'rate limit',
        'timeout',
        '429',
        '503',
        '504',
      ],
    };
  }
}
