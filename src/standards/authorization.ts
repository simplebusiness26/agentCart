import type {EvidenceBasis} from "./registry";

export type AuthorizationState="pass"|"fail"|"unsupported"|"unknown";

export interface AuthorizationFinding {
  key:"public_private_boundary"|"authentication"|"scoped_writes"|"approval_boundary"|
    "secret_leakage"|"tenant_isolation"|"credential_persistence";
  state:AuthorizationState;
  evidence:EvidenceBasis;
  detail:string;
}

export interface ObservableTool {
  name?:unknown;
  description?:unknown;
  inputSchema?:unknown;
  annotations?:Record<string,unknown>;
}

const WRITE=/^(create|update|delete|remove|send|pay|purchase|book|cancel|refund|publish|execute|run|set|add)_/i;
const SECRET_VALUE=/(?:bearer\s+|sk-|shpat_|api[_-]?key["']?\s*[:=]\s*["'])[a-z0-9_\-.]{12,}/i;

/** Assess only what a public synthetic journey can actually observe. Unknown is intentional. */
export function assessAuthorizationReadiness(input:{
  authMode:"public"|"oauth"|"bearer"|"unknown";
  tools:ObservableTool[];
  observedText?:string;
  credentialsSupplied?:boolean;
}):AuthorizationFinding[]{
  const tools=input.tools||[];
  const writes=tools.filter(t=>WRITE.test(String(t.name||""))||t.annotations?.readOnlyHint===false);
  const everyReadOnly=tools.length>0&&tools.every(t=>t.annotations?.readOnlyHint===true||!WRITE.test(String(t.name||"")));
  const leaked=SECRET_VALUE.test(input.observedText||"");

  return [
    {key:"public_private_boundary",state:input.authMode==="unknown"?"unknown":"pass",evidence:"declared",
      detail:input.authMode==="public"?"Target is explicitly configured as public."
        :input.authMode==="unknown"?"The target's public/private boundary is not declared."
        :`Target is explicitly configured to require ${input.authMode}.`},
    {key:"authentication",state:input.authMode==="public"?"unsupported":input.authMode==="unknown"?"unknown":"pass",
      evidence:"declared",detail:input.authMode==="public"?"Authentication is not applicable to this public journey."
        :input.authMode==="unknown"?"Authentication requirements could not be established."
        :`The configured authentication mode is ${input.authMode}; token validity is assessed separately.`},
    {key:"scoped_writes",state:writes.length?"unknown":everyReadOnly?"unsupported":"unknown",evidence:"inferred",
      detail:writes.length?`${writes.length} potentially mutating tool(s) need a credentialed scope audit.`
        :everyReadOnly?"No mutating tool is exposed in this journey.":"Tool annotations are insufficient to establish write scope."},
    {key:"approval_boundary",state:writes.length?"unknown":"unsupported",evidence:"inferred",
      detail:writes.length?"A public probe cannot prove that user approval is enforced before writes."
        :"No mutating tool is exposed, so a write approval boundary is not applicable."},
    {key:"secret_leakage",state:leaked?"fail":"unknown",evidence:leaked?"verified":"unknown",
      detail:leaked?"A credential-like value appeared in the observable response. The value was not retained."
        :"No obvious credential was observed, but a public probe cannot prove that secrets never leak."},
    {key:"tenant_isolation",state:"unknown",evidence:"unknown",
      detail:"Tenant isolation cannot be proven by a single public synthetic journey."},
    {key:"credential_persistence",state:input.credentialsSupplied?"unknown":"unsupported",evidence:"declared",
      detail:input.credentialsSupplied?"The probe does not retain the credential, but cannot prove server-side persistence behaviour."
        :"No credential was supplied or stored for this public journey."}
  ];
}
