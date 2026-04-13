/**
 * Retry utility with exponential backoff for API calls
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  onRetry: () => {},
};

// Check if an error is retryable
export function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof Response) {
    return retryableStatuses.includes(error.status);
  }
  
  if (error instanceof Error) {
    // Network errors are retryable
    const networkErrors = [
      'networkerror',
      'fetch error',
      'failed to fetch',
      'network request failed',
      'timeout',
      'aborted',
    ];
    const errorMessage = error.message.toLowerCase();
    return networkErrors.some(msg => errorMessage.includes(msg));
  }
  
  return false;
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate delay with exponential backoff and jitter
export function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

// Main retry function
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on the last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }
      
      // Check if error is retryable
      const response = error instanceof Response ? error : null;
      const status = response?.status;
      
      if (status && !opts.retryableStatuses.includes(status)) {
        // Non-retryable status code
        throw error;
      }
      
      if (!status && !isRetryableError(error, opts.retryableStatuses)) {
        // Non-retryable error
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );
      
      opts.onRetry(attempt + 1, lastError, delay);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Retry failed');
}

// Retry wrapper for fetch
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(
    () => fetch(url, init),
    retryOptions
  );
}

// Circuit breaker pattern for failing services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private resetTimeoutMs = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - service temporarily unavailable');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  getState() {
    return this.state;
  }
}

// Create circuit breakers for different services
export const supabaseCircuitBreaker = new CircuitBreaker(5, 30000);
export const yocoCircuitBreaker = new CircuitBreaker(3, 60000);
