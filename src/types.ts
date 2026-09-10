export interface Env {
  DB: D1Database;
  APP_URL: string;
  SHOPIFY_API_VERSION: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
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
  id?: string|number;
  admin_graphql_api_id?: string;
  current_total_price?: string|number;
  total_price?: string|number;
  currency?: string;
  processed_at?: string;
  created_at?: string;
  customer?: { id?: string|number; email?: string };
  orders_requested?: Array<string|number>;
  orders_to_redact?: Array<string|number>;
}
