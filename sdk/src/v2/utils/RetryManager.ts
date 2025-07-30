import { RetryOptions, SDKError } from '../types';

export class RetryManager {
  private options: Required<RetryOptions>;

  constructor(options?: RetryOptions) {
    this.options = {
      maxRetries: options?.maxRetries || 3,
      retryDelay: options?.retryDelay || 1000,
      backoffMultiplier: options?.backoffMultiplier || 2,
      maxRetryDelay: options?.maxRetryDelay || 30000,
      retryableStatuses: options?.retryableStatuses || [429, 502, 503, 504],
      retryableErrors: options?.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
    };
  }

  shouldRetry(error: SDKError | Error, attempt: number): boolean {
    if (attempt >= this.options.maxRetries) {
      return false;
    }

    // Check if it's a retryable status code
    if (error instanceof SDKError && error.statusCode) {
      return this.options.retryableStatuses.includes(error.statusCode);
    }

    // Check if it's a retryable network error
    if ('code' in error && typeof error.code === 'string') {
      return this.options.retryableErrors.includes(error.code);
    }

    // Retry on timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return true;
    }

    return false;
  }

  getDelay(attempt: number): number {
    const exponentialDelay = this.options.retryDelay * Math.pow(this.options.backoffMultiplier, attempt);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, this.options.maxRetryDelay);
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (!this.shouldRetry(error as SDKError, attempt)) {
          throw error;
        }

        if (attempt < this.options.maxRetries) {
          const delay = this.getDelay(attempt);
          
          if (onRetry) {
            onRetry(attempt + 1, error as Error);
          }

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}