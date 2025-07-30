import { RateLimitOptions } from '../types';

export class RateLimiter {
  private requests: number[] = [];
  private throttledUntil: Date | null = null;
  private options: Required<RateLimitOptions>;

  constructor(options?: RateLimitOptions) {
    this.options = {
      maxRequests: options?.maxRequests || 100,
      windowMs: options?.windowMs || 60000, // 1 minute
      throttleMs: options?.throttleMs || 1000 // 1 second between requests when throttled
    };
  }

  async checkLimit(): Promise<void> {
    // Check if we're throttled
    if (this.throttledUntil && this.throttledUntil > new Date()) {
      const waitTime = this.throttledUntil.getTime() - Date.now();
      await this.sleep(waitTime);
      this.throttledUntil = null;
    }

    // Remove old requests outside the window
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    this.requests = this.requests.filter(time => time > windowStart);

    // Check if we've exceeded the limit
    if (this.requests.length >= this.options.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.options.windowMs - now;
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    // Add current request
    this.requests.push(now);

    // Apply throttling if we're close to the limit
    if (this.requests.length > this.options.maxRequests * 0.8) {
      await this.sleep(this.options.throttleMs);
    }
  }

  setThrottled(seconds: number): void {
    this.throttledUntil = new Date(Date.now() + seconds * 1000);
  }

  updateFromHeaders(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');
    const retryAfter = headers.get('Retry-After');

    if (retryAfter) {
      this.setThrottled(parseInt(retryAfter));
    } else if (remaining === '0' && reset) {
      const resetTime = parseInt(reset) * 1000;
      const waitTime = Math.max(0, resetTime - Date.now());
      this.setThrottled(Math.ceil(waitTime / 1000));
    }
  }

  getStatus(): {
    remaining: number;
    reset: Date;
    limit: number;
  } {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    const currentRequests = this.requests.filter(time => time > windowStart);

    return {
      remaining: Math.max(0, this.options.maxRequests - currentRequests.length),
      reset: new Date(now + this.options.windowMs),
      limit: this.options.maxRequests
    };
  }

  reset(): void {
    this.requests = [];
    this.throttledUntil = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}