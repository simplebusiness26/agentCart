export interface Env {
  DB: D1Database;
  APP_URL: string;
  SHOPIFY_API_VERSION: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
}

export type FindingStatus = "good" | "warn" | "bad";

export interface Finding {
  key: string;
  title: string;
  status: FindingStatus;
  points: number;
  maxPoints: number;
  detail: string;
  fix?: string;
}

export interface ScanResult {
  url: string;
  domain: string;
  score: number;
  grade: "Excellent" | "Good" | "Needs work" | "Poor";
  findings: Finding[];
  scannedAt: string;
}

export interface PixelEventPayload {
  shop: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  referrer?: string;
  landingUrl?: string;
  sessionId?: string;
  productId?: string;
  productTitle?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  raw?: unknown;
}

export interface WebhookBody {
  shop_domain?: string;
  customer?: { id?: string|number; email?: string };
  orders_requested?: Array<string|number>;
  orders_to_redact?: Array<string|number>;
}
