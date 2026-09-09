import type {Env} from "../types";

export type FixStatus="detected"|"proposed"|"approved"|"applying"|"applied"|"verified"|"failed"|"skipped";

export interface FixPreview {
  targetId:string;
  targetTitle:string;
  summary:string;
  before:Record<string,unknown>;
  after:Record<string,unknown>;
}

export interface FixContext { env:Env; shop:string; token:string }

// A fix declares everything about itself, so routes never contain platform mutations and
// nothing can be applied without a preview, an approval rule and a verification step.
export interface FixDefinition {
  key:string;
  findingKey:string;
  platform:string;
  title:string;
  description:string;
  // "automatic" may be applied without asking; anything that changes what a customer
  // reads is approval_required. hosted_layer touches nothing on the merchant's store.
  fixType:"automatic"|"approval_required"|"hosted_layer";
  risk:"low"|"medium"|"high";
  requiredScopes:string[];
  preview(ctx:FixContext,limit?:number):Promise<FixPreview[]>;
  apply(ctx:FixContext,preview:FixPreview):Promise<Record<string,unknown>>;
  // Re-reads the platform and confirms the intended result. A mutation returning 200 is
  // NOT verification; this must independently observe the change.
  verify(ctx:FixContext,preview:FixPreview):Promise<{verified:boolean;detail:string}>;
}
