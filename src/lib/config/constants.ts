export const CONSTANTS = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTokens: 8000,
  maxCharsApprox: 24000, // ~8000 tokens * 3 chars/token
  rateLimit: 20, // requests per hour per IP
  rateLimitWindow: 60 * 60 * 1000, // 1 hour in ms
  angleCount: 3,
  maxHeadlineLength: 70,
  chartPreviewHeight: 200, // px
  apiTimeout: 30000, // 30s
  retryDelay: 1000, // 1s before retry
} as const;
