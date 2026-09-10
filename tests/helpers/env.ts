import type {Env} from "../../src/types";
import {makeDb} from "./d1";

export const TEST_SECRET="test-shopify-api-secret";
export const TEST_KEY="test-token-encryption-key";

export function fakeEnv(overrides:Partial<Env>={}){
  const {db,sqlite,close}=makeDb();
  const env={
    DB:db as unknown as D1Database,
    APP_URL:"https://agentcart.example",
    SHOPIFY_API_VERSION:"2026-07",
    SHOPIFY_API_KEY:"test-client-id",
    SHOPIFY_API_SECRET:TEST_SECRET,
    TOKEN_ENCRYPTION_KEY:TEST_KEY,
    ...overrides
  } as Env;
  return {env,sqlite,close};
}
