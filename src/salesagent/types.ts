export type FactConfidence="verified"|"merchant_approved"|"inferred"|"unknown";

export interface BusinessFact {
  key:string;
  type:"identity"|"catalog"|"policy"|"location"|"contact"|"action";
  value:unknown;
  source:string;
  sourceRecordId?:string;
  confidence:FactConfidence;
  merchantApproved:boolean;
  publicSafe:boolean;
  verifiedMs:number;
  freshnessMs?:number;
}

export interface BrainItem {
  id:string;handle:string;title:string;description:string;category:string;vendor:string;
  url:string;priceMin:number|null;priceMax:number|null;currency:string|null;available:boolean;
  imageUrl?:string;imageAlt?:string;
  variants?:Array<{id:string;title:string;price:number|null;available:boolean;sku:string}>;
  syncedMs:number;source:string;
}

export interface BusinessBrain {
  shop:string;
  version:string;
  name:string;
  description:string;
  website:string;
  contact:{email:string|null;phone:string|null};
  location:Record<string,unknown>;
  policies:Record<string,unknown>;
  items:BrainItem[];
  facts:BusinessFact[];
  generatedMs:number;
}

export type SalesAgentStatus="draft"|"active"|"paused";
export interface SalesAgentConfig {
  id:string;shop:string;publicId:string;status:SalesAgentStatus;displayName:string;purpose:string;
  tone:string[];supportedIntents:string[];allowedScopes:string[];allowedActions:string[];
  escalation:{message?:string;url?:string};unsupportedTopics:string[];locale:string;version:number;
  createdMs:number;updatedMs:number;
}

export interface SalesAgentAction {
  type:string;mode:"read"|"handoff"|"write";url?:string;authorizationRequired:boolean;
  approvalRequired:boolean;testSupported:boolean;verification:string[];
}

export interface GroundedReply {
  text:string;
  intent:string;
  factsUsed:string[];
  itemIds:string[];
  action?:SalesAgentAction;
  unknown:boolean;
  escalation:boolean;
  warnings:string[];
}

export interface ConversationScenario {
  id:string;intent:string;prompt:string;expected:{factKeys?:string[];itemId?:string;actionType?:string;mustRefuse?:boolean};severity:"low"|"medium"|"high";
}

export interface ConversationEvaluation {
  passed:boolean;
  factualAccuracy:number;
  unsupportedClaimRate:number;
  actionCorrect:boolean;
  reasons:string[];
}

export type ChannelState="demo"|"provider_not_available"|"advertiser_not_eligible"|"ready_for_provider"|"provider_onboarding_required"|"active"|"degraded"|"unknown";
