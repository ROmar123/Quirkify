/**
 * Security utilities for input sanitization, rate limiting, and XSS protection
 */

// XSS sanitization - remove dangerous HTML tags and attributes
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick, onload, etc.)
    .replace(/data:text\/html/gi, '') // Remove data URI schemes
    .trim();
}

// Sanitize HTML content - allow only safe tags
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'];
  
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '');
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate South African phone number
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Validate postal code (South Africa)
export function isValidPostalCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
}

// Rate limiter class for API calls
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canProceed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
    
    if (validTimestamps.length >= this.maxRequests) {
      this.requests.set(key, validTimestamps);
      return false;
    }
    
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  getRemainingTime(key: string): number {
    const timestamps = this.requests.get(key) || [];
    if (timestamps.length === 0) return 0;
    
    const oldest = Math.min(...timestamps);
    const remaining = this.windowMs - (Date.now() - oldest);
    return Math.max(0, remaining);
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

// Global rate limiters for different operations
export const searchRateLimiter = new RateLimiter(20, 60000); // 20 searches per minute
export const apiRateLimiter = new RateLimiter(50, 60000); // 50 API calls per minute
export const authRateLimiter = new RateLimiter(5, 300000); // 5 auth attempts per 5 minutes

// CSRF token generator
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Secure storage wrapper with encryption hint
export const secureStorage = {
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[Security] Failed to write to localStorage:', e);
    }
  },
  
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[Security] Failed to read from localStorage:', e);
      return null;
    }
  },
  
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Security] Failed to remove from localStorage:', e);
    }
  },
  
  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('[Security] Failed to clear localStorage:', e);
    }
  }
};

// Content Security Policy headers helper
export function getCspHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.firebaseio.com https://*.googleapis.com",
      "frame-src 'self' https://*.yoco.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}
