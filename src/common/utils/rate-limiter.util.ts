import { Injectable, Logger } from '@nestjs/common';

interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
}

interface RequestRecord {
  timestamp: number;
}

@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private requests: Map<string, RequestRecord[]> = new Map();

  /**
   * Check if request is allowed based on rate limits
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Clean up old requests (older than 1 minute)
    const recentRequests = requests.filter(
      (req) => now - req.timestamp < 60000,
    );

    // Check per-second limit
    const requestsLastSecond = recentRequests.filter(
      (req) => now - req.timestamp < 1000,
    ).length;

    if (requestsLastSecond >= config.requestsPerSecond) {
      const oldestInSecond = recentRequests.find(
        (req) => now - req.timestamp < 1000,
      );
      const retryAfter = oldestInSecond
        ? 1000 - (now - oldestInSecond.timestamp)
        : 1000;

      this.logger.warn(`Rate limit exceeded for ${key} (per second)`);
      return { allowed: false, retryAfter };
    }

    // Check per-minute limit
    const requestsLastMinute = recentRequests.length;

    if (requestsLastMinute >= config.requestsPerMinute) {
      const oldestInMinute = recentRequests[0];
      const retryAfter = oldestInMinute
        ? 60000 - (now - oldestInMinute.timestamp)
        : 60000;

      this.logger.warn(`Rate limit exceeded for ${key} (per minute)`);
      return { allowed: false, retryAfter };
    }

    // Record this request
    recentRequests.push({ timestamp: now });
    this.requests.set(key, recentRequests);

    return { allowed: true };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Get current request count
   */
  getRequestCount(key: string, windowMs: number = 60000): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    return requests.filter((req) => now - req.timestamp < windowMs).length;
  }
}
