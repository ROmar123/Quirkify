/**
 * Retry utility with exponential backoff
 * Automatically retries failed operations with increasing delays
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    // Don't retry auth errors, validation errors, or permission errors
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toLowerCase() || '';

    const noRetryErrors = [
      'permission-denied',
      'unauthenticated',
      'invalid',
      'not-found',
      'already-exists',
    ];

    return !noRetryErrors.some(e => code.includes(e) || message.includes(e));
  }
};

export async function retryAsync<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if we shouldn't
      if (!opts.shouldRetry(error)) {
        throw error;
      }

      // Don't wait after last attempt
      if (attempt < opts.maxAttempts) {
        const jitteredDelay = delayMs + Math.random() * (delayMs * 0.1); // Add 10% jitter
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
      }
    }
  }

  // All retries failed
  const error = new Error(`Operation failed after ${opts.maxAttempts} attempts`);
  (error as any).cause = lastError;
  throw error;
}

/**
 * Specific retry for Firestore operations
 */
export async function retryFirestoreOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'Firestore operation'
): Promise<T> {
  try {
    return await retryAsync(operation, {
      maxAttempts: 3,
      initialDelayMs: 500,
      shouldRetry: (error) => {
        // Retry on network errors, timeouts, unavailable
        const code = error?.code?.toLowerCase() || '';
        const retryableCodes = ['unavailable', 'deadline-exceeded', 'internal', 'unknown'];
        return retryableCodes.some(c => code.includes(c));
      }
    });
  } catch (error) {
    const cause = (error as any)?.cause;
    const message = cause?.message || (error as any).message;
    const code = cause?.code || (error as any).code;

    throw new Error(`${operationName} failed: ${code ? `[${code}] ` : ''}${message}`);
  }
}
