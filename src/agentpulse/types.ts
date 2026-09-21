import type {AuthorizationFinding} from "../standards/authorization";
import type {AgentSecurityFinding} from "../security/agent";

export type PulseRunStatus="pass"|"fail"|"blocked"|"unsupported";
export type PulseStepName="discover"|"connect"|"authenticate"|"invoke"|"validate"|"evidence";
export type PulseStepStatus="pass"|"fail"|"blocked"|"unsupported"|"unknown";

export interface PulseTarget {
  id:string;
  shop_domain:string|null;
  label:string;
  protocol:"mcp"|"http";
  transport:"streamable_http"|"https";
  endpoint:string;
  auth_mode:"public"|"oauth"|"bearer"|"unknown";
  journey:string;
  tool_name:string|null;
  tool_arguments_json:string|null;
  enabled:number;
  interval_ms:number;
  created_ms:number;
  updated_ms:number;
  last_run_ms:number|null;
}

export interface PulseStep {
  step:PulseStepName;
  status:PulseStepStatus;
  latencyMs:number;
  detail:string;
}

export interface PulseRun {
  id:string;
  targetId:string;
  shop:string|null;
  protocol:"mcp"|"http";
  journey:string;
  status:PulseRunStatus;
  era:"modern"|"legacy"|null;
  protocolVersion:string|null;
  startedMs:number;
  completedMs:number;
  latencyMs:number;
  errorCategory:string|null;
  errorCode:string|null;
  schemaFingerprint:string|null;
  toolCount:number|null;
  evidence:{
    versionBasis:"verified"|"declared"|"unknown";
    toolsList:{paginated:boolean;ttlMs:number|null;cacheScope:string|null};
    advertisedExtensions:string[];
    capabilities?:string[];
    authorization:AuthorizationFinding[];
    security:AgentSecurityFinding[];
    note:string;
  };
  steps:PulseStep[];
}
