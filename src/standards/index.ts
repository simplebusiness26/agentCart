import type {ReadinessState} from "../providers/registry";
import type {AgentReadyReport} from "../agentready/types";
import type {DiscoveryFinding} from "../providers/discovery";
import type {ProviderAccessReport} from "../providers/robots";
import type {SafetyReport} from "../agentready/safety";
import type {PaymentReadiness} from "../agentready/payment";
import type {InteractionSignal} from "../agentready/interaction";

// Agent Standards: a SEPARATE diagnostic layer (Phase 12.2), not a replacement for the
// business-first score.
//
// The rule governing this whole file: a roofer must not be marked down for lacking ecommerce
// protocols, and an ordinary shop must not fail for lacking an optional protocol when a plain
// browser journey works. Standards are evidence that helps answer the business questions; they
// are not the product.

export type BusinessType="ecommerce"|"service"|"booking"|"content"|"unknown";

export interface SiteProfile {
  type:BusinessType;
  confidence:number;
  applicable:string[];
  reason:string;
}

export function profileSite(report:AgentReadyReport):SiteProfile{
  const has=(t:string)=>report.pages.some(p=>p.pageType===t);
  const sells=report.checks.some(c=>c.category==="catalog"&&c.status!=="na");
  const books=report.checks.some(c=>c.key==="action-book"&&c.status!=="na");

  if(sells)return {type:"ecommerce",confidence:.9,
    applicable:["discovery","content","interaction","payment","catalog_protocol"],
    reason:"This business sells products online, so catalogue and transaction standards apply."};
  if(books)return {type:"booking",confidence:.8,
    applicable:["discovery","content","interaction","booking"],
    reason:"This business takes bookings, so booking and interaction standards apply. Ecommerce protocols do not."};
  if(has("contact")||has("about"))return {type:"service",confidence:.7,
    applicable:["discovery","content","interaction","contact"],
    reason:"This looks like a service business. It is assessed on being found, understood and contactable -- not on ecommerce protocols it has no use for."};
  return {type:"content",confidence:.4,applicable:["discovery","content"],
    reason:"Not enough signal to classify the business, so only discovery and content standards are applied."};
}

export type FixPath="agentcart"|"developer"|"manual";

export interface StandardFinding {
  key:string;
  group:"discovery"|"content"|"interaction"|"payment"|"catalog_protocol"|"booking"|"contact"|"authentication";
  label:string;
  state:ReadinessState;
  evidence:string;
  detail:string;
  paths:FixPath[];
}

export interface StandardsReport {
  profile:SiteProfile;
  findings:StandardFinding[];
  applicable:number;
  passing:number;
  score:number;
  summary:string;
  note:string;
}

const NOT_PRODUCT_NOTE=
  "Agent Standards are a technical diagnostic. They are reported separately from your Agent Ready score, because passing a protocol check is not the same as an AI customer being able to use your business.";

export function buildStandards(input:{
  report:AgentReadyReport;
  discovery:DiscoveryFinding[];
  providers:ProviderAccessReport[];
  safety:SafetyReport;
  payment:PaymentReadiness;
  interaction:InteractionSignal[];
}):StandardsReport{
  const profile=profileSite(input.report);
  const findings:StandardFinding[]=[];
  const applies=(group:StandardFinding["group"])=>profile.applicable.includes(group);

  const add=(f:StandardFinding)=>{
    // Anything outside this business's profile is not applicable, never a failure.
    if(!applies(f.group))findings.push({...f,state:"unsupported",
      detail:`Not applicable to a ${profile.type} business. ${profile.reason}`,paths:[]});
    else findings.push(f);
  };

  for(const d of input.discovery)
    add({key:`discovery.${d.kind}`,group:"discovery",label:`${d.path} published`,
      state:d.state,evidence:d.evidence,detail:d.detail,
      paths:d.state==="pass"?[]:d.kind==="agents_md"?["agentcart","developer","manual"]:["developer","manual"]});

  for(const p of input.providers)
    add({key:`discovery.provider.${p.provider}`,group:"discovery",
      label:`${p.label} can discover this business`,state:p.discovery,
      evidence:p.agents.filter(a=>a.scored).map(a=>a.evidence).join(" | ").slice(0,300),
      detail:p.notes.join(" ")||`Discovery access for ${p.label}.`,
      paths:p.discovery==="fail"?["developer","manual"]:[]});

  add({key:"content.integrity",group:"content",label:"Pages contain no agent-hostile content",
    state:input.safety.state,evidence:input.safety.findings.map(f=>`${f.key} x${f.count}`).join(", ")||"none",
    detail:input.safety.summary,paths:input.safety.state==="pass"?[]:["manual","developer"]});

  const weak=input.interaction.filter(s=>s.state==="fail"||s.state==="unknown");
  add({key:"interaction.controls",group:"interaction",label:"Controls are operable by an agent",
    state:input.interaction.some(s=>s.state==="fail")?"fail":weak.length?"unknown":"pass",
    evidence:weak.map(s=>`${s.key}: ${s.evidence}`).join(" | ").slice(0,300)||"all controls operable",
    detail:weak.length?`${weak.length} control area(s) an agent may not be able to operate.`
      :"An agent can operate the primary controls.",
    paths:weak.length?["developer","manual"]:[]});

  add({key:"payment.path",group:"payment",label:"A transaction path is reachable",
    state:input.payment.purchaseCapable?"pass":input.payment.stages[0]?.state==="unsupported"?"unsupported":"fail",
    evidence:`reached stage ${input.payment.furthestStage} of ${input.payment.stages.length}`,
    detail:input.payment.purchaseCapable?"An agent can reach a usable checkout."
      :"An agent cannot reach a complete checkout path.",
    paths:input.payment.purchaseCapable?[]:["manual","developer"]});

  add({key:"catalog_protocol.ucp",group:"catalog_protocol",
    label:"A machine-readable catalogue protocol is published",
    state:input.discovery.find(d=>d.kind==="ucp_manifest")?.state==="pass"?"pass":"unsupported",
    evidence:input.discovery.find(d=>d.kind==="ucp_manifest")?.evidence||"no UCP manifest",
    // Explicitly optional: a working browser journey is enough today.
    detail:"Optional. A working browser journey is sufficient for most agents today; a catalogue protocol makes it more reliable.",
    paths:["agentcart","developer"]});

  const scored=findings.filter(f=>f.state!=="unsupported"&&f.state!=="not_available_in_region");
  const passing=scored.filter(f=>f.state==="pass").length;
  const score=scored.length?Math.round(passing/scored.length*100):0;

  return {profile,findings,applicable:scored.length,passing,score,note:NOT_PRODUCT_NOTE,
    summary:`${passing} of ${scored.length} applicable standards are met for this ${profile.type} business.`};
}

// --- Three fix paths (Phase 12.4) ------------------------------------------------------

export interface FixInstructions { path:FixPath; title:string; body:string }

/** A precise prompt for a developer or coding agent, built from AgentCart's own evidence. */
export function developerInstructions(f:StandardFinding,site:string):FixInstructions{
  return {path:"developer",title:"Give this to your developer or coding agent",body:[
    `# Fix: ${f.label}`,"",
    `Site: ${site}`,`Check: ${f.key}`,`Current result: ${f.state}`,"",
    "## What AgentCart observed",f.evidence||"(no evidence recorded)","",
    "## Why it matters",f.detail,"",
    "## Desired end state",
    `The check "${f.label}" should return pass when the site is re-scanned.`,"",
    "## How to verify",
    "- Re-run the AgentCart scan and confirm this check reports pass.",
    "- Confirm the observed evidence above no longer applies.","",
    "## Constraints",
    "- Preserve all existing behaviour and content; do not remove or rewrite working copy.",
    "- Do not add credentials, tokens or secrets to the page or repository.",
    "- These standards are new and change often: confirm the current official specification before implementing anything protocol-specific.",
    "- This is a set of instructions, not a change that has been made. Nothing here has been applied."
  ].join("\n")};
}

export function manualInstructions(f:StandardFinding):FixInstructions{
  return {path:"manual",title:"Fix it yourself",
    body:`${f.detail}\n\nWhat AgentCart saw: ${f.evidence||"no evidence recorded"}\n\nOnce changed, re-run the scan to confirm.`};
}

export function pathsFor(f:StandardFinding,site:string):FixInstructions[]{
  const out:FixInstructions[]=[];
  // AgentCart's own fix is the primary route wherever it genuinely exists.
  if(f.paths.includes("agentcart"))
    out.push({path:"agentcart",title:"Fix with AgentCart",
      body:"AgentCart can make this change for you. Changes to anything your customers read are shown for approval first, and can be undone."});
  if(f.paths.includes("developer"))out.push(developerInstructions(f,site));
  if(f.paths.includes("manual"))out.push(manualInstructions(f));
  return out;
}
