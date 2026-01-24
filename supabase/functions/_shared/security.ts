/**
 * Shared Security Utilities for Edge Functions
 *
 * This module provides:
 * - Rate limiting (in-memory for edge functions)
 * - CORS helpers with dynamic origin checking
 * - Input validation utilities
 *
 * Usage:
 * import { checkRateLimit, getCorsHeaders, validateInput } from '../_shared/security.ts';
 */

// ============================================================================
// CORS Configuration
// ============================================================================

/**
 * Allowed origins for CORS
 * Add your production domains here
 */
const ALLOWED_ORIGINS = [
  // Production domains (add your actual domains here)
  'https://gamify-family-planboard.vercel.app',
  'https://family-planboard.com',
  // Localhost for development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

/**
 * Get CORS headers with dynamic origin checking
 *
 * Native mobile apps (iOS/Android) don't send Origin headers and are NOT
 * affected by CORS restrictions. This only affects browser-based requests.
 *
 * @param req - The incoming request
 * @returns CORS headers object
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';

  // Check if origin is in allowed list
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  // In development, allow all localhost origins
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
  const isLocalhost =
    origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');

  const allowedOrigin = isAllowed || (isDevelopment && isLocalhost) ? origin : ALLOWED_ORIGINS[0]; // Default to first allowed origin

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  };
}

/**
 * Legacy CORS headers for backward compatibility during transition
 * @deprecated Use getCorsHeaders(req) instead
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit storage
 * Note: This resets when the edge function cold starts
 * For production, consider using Upstash Redis or similar
 */
const rateLimits = new Map<string, RateLimitRecord>();

/**
 * Rate limit configuration per function
 */
export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
}

/**
 * Default rate limits by function type
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'pin-login': { maxRequests: 5, windowMs: 60_000 }, // 5 per minute (brute force protection)
  'create-child': { maxRequests: 10, windowMs: 3_600_000 }, // 10 per hour
  'join-family': { maxRequests: 5, windowMs: 60_000 }, // 5 per minute (code enumeration protection)
  'join-family-as-parent': { maxRequests: 5, windowMs: 60_000 },
  'toggle-admin': { maxRequests: 5, windowMs: 60_000 }, // 5 per minute
  'deduct-points': { maxRequests: 20, windowMs: 3_600_000 }, // 20 per hour
  'deduct-points-with-evidence': { maxRequests: 20, windowMs: 3_600_000 }, // 20 per hour
  'reset-child-pin': { maxRequests: 5, windowMs: 60_000 }, // 5 per minute
  'regenerate-invite-code': { maxRequests: 5, windowMs: 60_000 },
  'award-birthday-points': { maxRequests: 10, windowMs: 3_600_000 },
  'disable-member': { maxRequests: 10, windowMs: 60_000 },
  'export-family-data': { maxRequests: 3, windowMs: 3_600_000 }, // 3 per hour (expensive operation)
  'create-dispute': { maxRequests: 10, windowMs: 3_600_000 }, // 10 per hour (prevent spam)
  'resolve-dispute': { maxRequests: 20, windowMs: 3_600_000 }, // 20 per hour (admin action)
  'purchase-streak-freeze': { maxRequests: 5, windowMs: 3_600_000 }, // 5 per hour (prevent accidental purchases)
  'request-redemption': { maxRequests: 10, windowMs: 3_600_000 }, // 10 per hour (prevent redemption spam)
};

/**
 * Get client identifier for rate limiting
 * Uses X-Forwarded-For header (set by Supabase edge) or falls back to 'unknown'
 *
 * @param req - The incoming request
 * @returns Client identifier string
 */
export function getClientId(req: Request): string {
  // X-Forwarded-For may contain multiple IPs; use the first one (client)
  const forwardedFor = req.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to X-Real-IP
  const realIp = req.headers.get('X-Real-IP');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Check if a request is rate limited
 *
 * @param key - Unique key for the rate limit bucket (e.g., "pin-login:192.168.1.1")
 * @param config - Rate limit configuration
 * @returns Object with allowed boolean and remaining requests
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimits.get(key);

  // Clean up expired entries periodically (every 100th check)
  if (Math.random() < 0.01) {
    cleanupExpiredRateLimits();
  }

  // No existing record or window expired - create new
  if (!record || now > record.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetAt - now,
    };
  }

  // Increment counter
  record.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetIn: record.resetAt - now,
  };
}

/**
 * Clean up expired rate limit records
 */
function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    if (now > record.resetAt) {
      rateLimits.delete(key);
    }
  }
}

/**
 * Create a rate-limited response
 *
 * @param corsHeaders - CORS headers to include
 * @param resetIn - Milliseconds until rate limit resets
 * @returns Response object with 429 status
 */
export function rateLimitedResponse(
  corsHeaders: Record<string, string>,
  resetIn: number
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retry_after_seconds: Math.ceil(resetIn / 1000),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(resetIn / 1000)),
      },
    }
  );
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Maximum input lengths for common fields
 */
export const MAX_INPUT_LENGTHS = {
  name: 255,
  email: 320, // RFC 5321 max
  pin: 6,
  invite_code: 32,
  reason: 1000,
  description: 5000,
  uuid: 36,
  general: 10000, // General text fields
};

/**
 * Validate a string input
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field (for error messages)
 * @param maxLength - Maximum allowed length
 * @param required - Whether the field is required
 * @returns Error message or null if valid
 */
export function validateInput(
  value: unknown,
  fieldName: string,
  maxLength: number,
  required: boolean = true
): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return `${fieldName} is required`;
    }
    return null; // Optional field, empty is OK
  }

  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }

  if (value.length > maxLength) {
    return `${fieldName} exceeds maximum length of ${maxLength} characters`;
  }

  return null;
}

/**
 * Validate a UUID format
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Error message or null if valid
 */
export function validateUuid(value: unknown, fieldName: string): string | null {
  const basicValidation = validateInput(value, fieldName, MAX_INPUT_LENGTHS.uuid, true);
  if (basicValidation) return basicValidation;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value as string)) {
    return `${fieldName} must be a valid UUID`;
  }

  return null;
}

/**
 * Validate a PIN format (4-6 digits)
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Error message or null if valid
 */
export function validatePin(value: unknown, fieldName: string = 'PIN'): string | null {
  const basicValidation = validateInput(value, fieldName, MAX_INPUT_LENGTHS.pin, true);
  if (basicValidation) return basicValidation;

  if (!/^\d{4,6}$/.test(value as string)) {
    return `${fieldName} must be 4-6 digits`;
  }

  return null;
}

/**
 * Validate a positive integer
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field (for error messages)
 * @param max - Optional maximum value
 * @returns Error message or null if valid
 */
export function validatePositiveInt(
  value: unknown,
  fieldName: string,
  max?: number
): string | null {
  if (value === undefined || value === null) {
    return `${fieldName} is required`;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return `${fieldName} must be an integer`;
  }

  if (value <= 0) {
    return `${fieldName} must be a positive number`;
  }

  if (max !== undefined && value > max) {
    return `${fieldName} exceeds maximum value of ${max}`;
  }

  return null;
}

/**
 * Validate email format
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Error message or null if valid
 */
export function validateEmail(value: unknown, fieldName: string = 'Email'): string | null {
  const basicValidation = validateInput(value, fieldName, MAX_INPUT_LENGTHS.email, true);
  if (basicValidation) return basicValidation;

  // Basic email regex - not exhaustive but catches most issues
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value as string)) {
    return `${fieldName} must be a valid email address`;
  }

  return null;
}

/**
 * Safely parse JSON body with size limit
 *
 * @param req - The incoming request
 * @param maxSize - Maximum body size in bytes (default 100KB)
 * @returns Parsed JSON or throws error
 */
export async function parseJsonBody<T>(req: Request, maxSize: number = 100_000): Promise<T> {
  // Check content-length header first (may not be accurate but good first check)
  const contentLength = req.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new Error(`Request body too large (max ${maxSize} bytes)`);
  }

  const text = await req.text();
  if (text.length > maxSize) {
    throw new Error(`Request body too large (max ${maxSize} bytes)`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid JSON in request body');
  }
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Create a standardized error response
 *
 * @param message - Error message
 * @param status - HTTP status code
 * @param corsHeaders - CORS headers to include
 * @returns Response object
 */
export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create a standardized success response
 *
 * @param data - Response data
 * @param corsHeaders - CORS headers to include
 * @returns Response object
 */
export function successResponse(data: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Security Constants
// ============================================================================

/**
 * JWT expiry times in seconds
 */
export const JWT_EXPIRY = {
  PIN_USER: 24 * 60 * 60, // 24 hours for PIN users (reduced from 7 days)
  REGULAR_USER: 7 * 24 * 60 * 60, // 7 days for regular users
};
