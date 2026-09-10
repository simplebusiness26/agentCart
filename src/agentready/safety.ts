import type {ReadinessState} from "../providers/registry";

// Agent Safety / Content Integrity (Phase 10.8). Agent browsers are exposed to prompt injection
// and hostile page content, so AgentCart reports whether a merchant's own pages contain content
// that could make an agent stop, distrust the page, or ask for extra confirmation.
//
// TWO RULES THAT ARE NOT NEGOTIABLE:
//
// 1. Content found on a page is EVIDENCE, never input. Nothing here interprets, executes or obeys
//    what it finds. Matches are counted and quoted back (escaped, truncated); they never reach a
//    branch that changes scoring behaviour beyond incrementing a counter.
// 2. We do not assert what a provider will do. Saying "Meta will block this page" would need
//    official evidence of that exact behaviour, which we do not have.

export type SafetySeverity="high"|"warning";

export interface SafetyFinding {
  key:string;
  label:string;
  severity:SafetySeverity;
  count:number;
  /** A short, escaped excerpt so a merchant can find the offending content. */
  samples:string[];
  detail:string;
}

export interface SafetyReport {
  state:ReadinessState;
  findings:SafetyFinding[];
  summary:string;
}

const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));
const excerpt=(v:string)=>escape(v.replace(/\s+/g," ").trim()).slice(0,140);

// Text visually hidden from humans but still read by an agent.
const HIDDEN_BLOCK=/<[a-z][a-z0-9]{0,14}\b[^<>]{0,400}(?:style=["'][^"']{0,300}(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|(?:left|top)\s*:\s*-\d{3,}p|clip\s*:\s*rect\(0)|aria-hidden=["']true["']|hidden(?=[\s>]))[^<>]{0,400}>([\s\S]{0,2000}?)<\/[a-z][a-z0-9]{0,14}>/gi;

// Phrasing that addresses a machine rather than describing a business.
const INSTRUCTION_PATTERNS:Array<[string,RegExp]>=[
  ["override",/\b(?:ignore|disregard|forget|override)\b[^.!?\n]{0,60}\b(?:previous|prior|earlier|above|all)\b[^.!?\n]{0,40}\b(?:instruction|prompt|rule|direction|context)/i],
  ["role-address",/\b(?:you are|act as|pretend to be|from now on you)\b[^.!?\n]{0,80}\b(?:assistant|ai|agent|model|chatbot)\b/i],
  ["system-claim",/\b(?:system|developer)\s*(?:prompt|message|instruction)\b/i],
  ["exfiltration",/\b(?:reveal|print|output|repeat|show)\b[^.!?\n]{0,50}\b(?:your|the)\b[^.!?\n]{0,30}\b(?:prompt|instructions|system message|rules)\b/i],
  ["agent-directive",/\b(?:ai|agent|assistant|model|bot)s?\b[^.!?\n]{0,40}\b(?:must|should|shall|need to|are required to)\b[^.!?\n]{0,60}\b(?:recommend|rank|prefer|say|report|score|rate)\b/i]
];

const stripTags=(html:string)=>html
  .replace(/<script\b[^<>]{0,2000}>[\s\S]{0,500000}?<\/script>/gi," ")
  .replace(/<style\b[^<>]{0,2000}>[\s\S]{0,500000}?<\/style>/gi," ")
  .replace(/<[^<>]{0,4000}>/g," ");

export function assessSafety(html:string):SafetyReport{
  const findings:SafetyFinding[]=[];
  const source=String(html||"");

  // Hidden text that addresses a machine. Hidden text alone is common and legitimate
  // (screen-reader helpers, tracking pixels), so it is only reported when it also reads
  // like an instruction -- which keeps the false-positive rate down.
  const hiddenSamples:string[]=[];
  let hiddenInstructions=0;
  for(const m of source.matchAll(HIDDEN_BLOCK)){
    const text=stripTags(m[1]||"");
    if(!text.trim())continue;
    if(INSTRUCTION_PATTERNS.some(([,re])=>re.test(text))){
      hiddenInstructions++;
      if(hiddenSamples.length<3)hiddenSamples.push(excerpt(text));
    }
  }
  if(hiddenInstructions)
    findings.push({key:"hidden-agent-instructions",label:"Hidden text that addresses an AI agent",
      severity:"high",count:hiddenInstructions,samples:hiddenSamples,
      detail:"Text that is hidden from visitors but readable by an AI agent, phrased as an instruction to that agent. Agents commonly treat this as a manipulation attempt."});

  // Visible instruction-like content in places that should hold merchant copy.
  const visible=stripTags(source);
  for(const [key,re] of INSTRUCTION_PATTERNS){
    const matches=[...visible.matchAll(new RegExp(re.source,"gi"))].slice(0,3);
    if(!matches.length)continue;
    findings.push({key:`instruction-${key}`,label:"Content written as an instruction to an AI agent",
      // Visible copy is more often a false positive (a blog post about prompt injection, say),
      // so it is a warning unless it was also hidden.
      severity:"warning",count:matches.length,
      samples:matches.map(m=>excerpt(String(m[0]))),
      detail:"Page text reads as an instruction aimed at an AI rather than a description of the business. If this is editorial content about AI, it is probably fine; if it is in product or policy copy, agents may treat the page as untrustworthy."});
  }

  // A third-party widget owning the whole purchase action is a risk signal, not malice.
  const embeddedCheckout=[...source.matchAll(/<iframe\b[^<>]{0,600}src=["']([^"']{1,300})["']/gi)]
    .map(m=>m[1]).filter(src=>/checkout|payment|cart|buy/i.test(src));
  if(embeddedCheckout.length)
    findings.push({key:"third-party-checkout-widget",label:"Checkout happens inside an embedded widget",
      severity:"warning",count:embeddedCheckout.length,
      samples:embeddedCheckout.slice(0,3).map(s=>excerpt(s)),
      detail:"A core purchase step is inside a third-party embed. That is not a problem in itself, but agents often cannot operate inside embedded frames, so the journey may stop there."});

  const state:ReadinessState=findings.some(f=>f.severity==="high")?"fail"
    :findings.length?"unknown":"pass";

  // Careful wording, per the spec: what agents may do, never what a named provider will do.
  const summary=state==="fail"
    ? "This site contains content that may cause AI agents to distrust the page, stop, or require extra confirmation before acting."
    :state==="unknown"
    ? "Some content here might cause an AI agent to pause or ask for confirmation. Review the examples below; several of these patterns are legitimate in editorial content."
    : "Nothing was found that would be likely to make an AI agent distrust these pages.";

  return {state,findings,summary};
}
