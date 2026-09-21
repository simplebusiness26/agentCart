import type {Env} from "../types";

export type SecurityState="pass"|"fail"|"unknown"|"not_applicable";
export interface AgentSecurityFinding {key:"untrusted_metadata"|"untrusted_output"|"identity"|"scope"|"approval"|"input_validation"|"idempotency"|"rollback"|"verification"|"rate_abuse"|"secret_exposure";state:SecurityState;detail:string;tools:string[];}
export interface SecurityTool {name?:unknown;description?:unknown;inputSchema?:unknown;outputSchema?:unknown;annotations?:Record<string,unknown>;}

const CONSEQUENTIAL=/(^|_)(create|update|delete|remove|send|pay|purchase|buy|book|cancel|refund|publish|execute|run|set|add|submit|place|order|checkout|cart|booking|reservation|quote|message|email|write|mutation)(_|$)/i;
const INJECTION=[
  /\bignore\b[^.!?\n]{0,80}\b(?:instruction|prompt|rule|policy|safety)/i,
  /\b(?:system|developer)\s*(?:prompt|message|instruction)/i,
  /\b(?:reveal|print|output|repeat|show)\b[^.!?\n]{0,80}\b(?:prompt|instructions|system message|secrets?)/i,
  /\b(?:you are|act as|pretend to be|from now on)\b[^.!?\n]{0,100}\b(?:assistant|agent|model|chatbot)/i
];
const SECRET=/\b(?:sk-[a-z0-9_-]{16,}|shpat_[a-z0-9]{16,}|api[_-]?key\s*[:=]\s*["']?[a-z0-9_-]{16,}|bearer\s+[a-z0-9._~-]{20,})/i;
const text=(v:unknown,max=20_000)=>String(v??"").slice(0,max);
const schemaProps=(tool:SecurityTool)=>{const schema=tool.inputSchema as any;return schema&&typeof schema==="object"&&schema.properties&&typeof schema.properties==="object"?Object.keys(schema.properties).map(k=>k.toLowerCase()):[];};
const flagged=(value:string)=>INJECTION.some(re=>re.test(value));

const normalisedName=(value:unknown)=>text(value,128).replace(/([a-z0-9])([A-Z])/g,"$1_$2").replace(/[^a-z0-9]+/gi,"_").toLowerCase();

export function assessAgentInteractionSecurity(input:{tools:SecurityTool[];outputText?:string;declaredIdentity?:string;verifiedIdentity?:string;identity?:string}){
  const tools=(input.tools||[]).slice(0,500),names=tools.map(t=>text(t.name,128)).filter(Boolean);
  // Only an explicit true is safe to monitor as read-only. Names help explain risk, but a
  // friendly or ambiguous name can never downgrade an unannotated tool to harmless.
  const mutating=tools.filter(t=>t.annotations?.readOnlyHint!==true||CONSEQUENTIAL.test(normalisedName(t.name)));
  const metadataRisks=tools.filter(t=>flagged(`${text(t.name,256)} ${text(t.description)} ${text(JSON.stringify(t.inputSchema))} ${text(JSON.stringify(t.outputSchema))}`)).map(t=>text(t.name,128)||"unnamed");
  const secretRisks=tools.filter(t=>SECRET.test(`${text(t.description)} ${text(JSON.stringify(t.inputSchema))} ${text(JSON.stringify(t.outputSchema))}`)).map(t=>text(t.name,128)||"unnamed");
  const outputRisk=flagged(text(input.outputText));
  const outputSecret=SECRET.test(text(input.outputText));
  const applicable=mutating.length>0,mutatingNames=mutating.map(t=>text(t.name,128)||"unnamed");
  const all=(predicate:(tool:SecurityTool)=>boolean)=>mutating.length>0&&mutating.every(predicate);
  const findings:AgentSecurityFinding[]=[
    {key:"untrusted_metadata",state:metadataRisks.length?"fail":"pass",tools:metadataRisks,detail:metadataRisks.length?"Instruction-like text was found inside tool metadata. Treat it as untrusted and do not execute it.":"No common prompt-injection pattern was found in tool names, descriptions or schemas."},
    {key:"untrusted_output",state:outputRisk?"fail":input.outputText?"pass":"unknown",tools:[],detail:outputRisk?"Instruction-like text was found in returned third-party content.":input.outputText?"No common prompt-injection pattern was found in the inspected output.":"No tool output was supplied for inspection."},
    {key:"identity",state:input.verifiedIdentity?"pass":"unknown",tools:names,detail:input.verifiedIdentity?`The independently verified server identity is ${text(input.verifiedIdentity,160)}.`:(input.declaredIdentity||input.identity)?`The server declares itself as ${text(input.declaredIdentity||input.identity,160)}, but that label has not been independently verified.`:"No independently verified tool-server identity was supplied."},
    {key:"scope",state:!applicable?"not_applicable":all(t=>Array.isArray(t.annotations?.requiredScopes)&&t.annotations!.requiredScopes.length>0)?"pass":"unknown",tools:mutatingNames,detail:!applicable?"No mutating tool is exposed.":"Every mutating tool must declare and enforce the narrow scopes it needs."},
    {key:"approval",state:!applicable?"not_applicable":all(t=>t.annotations?.confirmationRequired===true||t.annotations?.approvalRequired===true)?"pass":"fail",tools:mutatingNames,detail:!applicable?"No consequential action needs confirmation.":"Consequential actions must require explicit confirmation immediately before execution."},
    {key:"input_validation",state:tools.length&&tools.every(t=>{const schema=t.inputSchema as any;return schema&&schema.type==="object"&&schema.additionalProperties===false;})?"pass":"unknown",tools:names,detail:"Tool inputs need narrow object schemas that reject undeclared properties; server-side validation remains required."},
    {key:"idempotency",state:!applicable?"not_applicable":all(t=>t.annotations?.idempotentHint===true||schemaProps(t).some(p=>/idempotency|requestid|operationid/.test(p)))?"pass":"unknown",tools:mutatingNames,detail:!applicable?"No mutating tool is exposed.":"Mutating tools should expose an idempotency key or an equivalent duplicate-action guard."},
    {key:"rollback",state:!applicable?"not_applicable":all(t=>t.annotations?.rollbackSupported===true||typeof t.annotations?.rollbackTool==="string")?"pass":"unknown",tools:mutatingNames,detail:!applicable?"No mutation needs rollback.":"A rollback route or an explicit non-reversible warning is required."},
    {key:"verification",state:!applicable?"not_applicable":all(t=>t.annotations?.verificationRequired===true||typeof t.annotations?.verificationTool==="string"||!!t.outputSchema)?"pass":"unknown",tools:mutatingNames,detail:!applicable?"No post-action verification is needed.":"Every action should return or link to evidence that the requested outcome actually occurred."}
    ,{key:"rate_abuse",state:!applicable?"not_applicable":all(t=>t.annotations?.rateLimitHint===true||typeof t.annotations?.rateLimitPolicy==="string")?"pass":"unknown",tools:mutatingNames,detail:!applicable?"No consequential action is exposed.":"Consequential actions need enforced rate and abuse controls, not only client-side throttling."}
    ,{key:"secret_exposure",state:secretRisks.length||outputSecret?"fail":"pass",tools:secretRisks,detail:secretRisks.length||outputSecret?"A credential-like value appeared in inspected metadata or output. Remove and rotate it before use.":"No common credential pattern was found in the inspected metadata or output."}
  ];
  const status=metadataRisks.length||outputRisk||secretRisks.length||outputSecret||findings.some(f=>f.state==="fail")?"fail":findings.some(f=>f.state==="unknown")?"unknown":"pass";
  return {status,applicable,toolCount:tools.length,mutatingToolCount:mutating.length,findings,
    rule:"A callable tool is not action-ready until identity, scope, approval, idempotency, rollback and verification are evidenced where applicable."};
}

export async function saveAgentSecurityAssessment(env:Env,shop:string,targetLabel:string,assessment:ReturnType<typeof assessAgentInteractionSecurity>,nowMs=Date.now()){
  const id=`sec_${nowMs.toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  await env.DB.prepare(`INSERT INTO agent_security_assessments(id,shop_domain,target_label,applicable,tool_count,mutating_tool_count,status,findings_json,checked_ms)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,shop,text(targetLabel,200),assessment.applicable?1:0,assessment.toolCount,assessment.mutatingToolCount,assessment.status,
      JSON.stringify(assessment.findings),nowMs).run();return {id,...assessment,checkedMs:nowMs};
}

export async function securityReport(env:Env,shop:string){
  const rows=await env.DB.prepare("SELECT id,target_label,applicable,tool_count,mutating_tool_count,status,findings_json,checked_ms FROM agent_security_assessments WHERE shop_domain=? ORDER BY checked_ms DESC LIMIT 100")
    .bind(shop).all<any>();return {assessments:rows.results.map(row=>({...row,findings:JSON.parse(String(row.findings_json||"[]"))})),
      scoring:"Security is applicability-gated and is not deducted from a brochure site's business-readiness score."};
}
