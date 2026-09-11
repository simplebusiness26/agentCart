import {PROVIDERS,isScoredPurpose} from "./registry";
import type {CrawlerAgent,ProviderDefinition,ReadinessState} from "./registry";

// robots.txt parsed per user-agent, not by treating "User-agent: *" as the only meaningful group.
//
// The rule that matters most here: blocking a training-only crawler is a legitimate merchant
// decision about AI training and must never reduce the Agent Ready score. Only discovery and
// agentic-fetch access are scored.

export interface RobotsGroup { agents:string[]; allow:string[]; disallow:string[] }

export function parseRobots(text:string):RobotsGroup[]{
  const groups:RobotsGroup[]=[];
  let current:RobotsGroup|null=null;
  let lastLineWasAgent=false;
  for(const raw of String(text||"").split(/\r?\n/)){
    const line=raw.replace(/#.*$/,"").trim();
    if(!line){continue;}
    const m=line.match(/^([A-Za-z-]{1,32})\s*:\s*(.{0,2000})$/);
    if(!m)continue;
    const field=m[1].toLowerCase(),value=m[2].trim();
    if(field==="user-agent"){
      // Consecutive User-agent lines share one group of rules.
      if(!current||!lastLineWasAgent){current={agents:[],allow:[],disallow:[]};groups.push(current);}
      current.agents.push(value.toLowerCase());
      lastLineWasAgent=true;
      continue;
    }
    lastLineWasAgent=false;
    if(!current)continue;
    if(field==="allow")current.allow.push(value);
    else if(field==="disallow")current.disallow.push(value);
  }
  return groups;
}

/** Robots.txt matches the most specific (longest) user-agent token, falling back to "*". */
export function groupForAgent(groups:RobotsGroup[],token:string){
  const lower=token.toLowerCase();
  let best:RobotsGroup|null=null,bestLen=-1;
  for(const g of groups){
    for(const agent of g.agents){
      if(agent==="*"){if(bestLen<0){best=g;bestLen=0;}continue;}
      // Meta documents its tokens with a version suffix in robots directives, so match on prefix.
      if(lower===agent||lower.startsWith(`${agent}/`)||agent.startsWith(`${lower}/`)){
        if(agent.length>bestLen){best=g;bestLen=agent.length;}
      }
    }
  }
  return best;
}

const pathMatches=(rule:string,path:string)=>{
  if(rule==="")return false;
  // Longest-match semantics with the common "*" and "$" extensions.
  if(!rule.includes("*")&&!rule.endsWith("$"))return path.startsWith(rule);
  const anchored=rule.endsWith("$");
  const body=anchored?rule.slice(0,-1):rule;
  const pattern="^"+body.split("*").map(s=>s.replace(/[.+?^${}()|[\]\\]/g,"\\$&")).join(".*")+(anchored?"$":"");
  try{return new RegExp(pattern).test(path);}catch{return false;}
};

export interface AgentAccess {
  provider:string;
  agent:CrawlerAgent;
  /** Whether robots.txt permits this agent to fetch `path`. */
  allowed:boolean;
  /** The exact directive the conclusion rests on, for the evidence record. */
  evidence:string;
  /** True when the merchant disallowed it but the agent is documented as possibly ignoring that. */
  statedPreferenceOnly:boolean;
  scored:boolean;
}

export function accessForAgent(groups:RobotsGroup[],provider:ProviderDefinition,agent:CrawlerAgent,path="/"):AgentAccess{
  const group=groupForAgent(groups,agent.token);
  const base={provider:provider.id,agent,scored:isScoredPurpose(agent.purpose)};
  if(!group)
    return {...base,allowed:true,evidence:"No robots.txt rule matches this agent.",statedPreferenceOnly:false};

  const disallow=group.disallow.filter(r=>pathMatches(r,path)).sort((a,b)=>b.length-a.length)[0];
  const allow=group.allow.filter(r=>pathMatches(r,path)).sort((a,b)=>b.length-a.length)[0];
  const matchedAgent=group.agents.join(", ");

  // An equally- or more-specific Allow wins over Disallow.
  if(disallow&&(!allow||allow.length<disallow.length)){
    return {...base,allowed:false,
      evidence:`User-agent: ${matchedAgent} / Disallow: ${disallow}`,
      // The merchant said no, but the provider documents that it may fetch anyway. Reporting this
      // as "blocked" would assert something the provider's own docs contradict.
      statedPreferenceOnly:!agent.respectsRobots};
  }
  return {...base,allowed:true,
    evidence:allow?`User-agent: ${matchedAgent} / Allow: ${allow}`:`User-agent: ${matchedAgent} / no matching Disallow`,
    statedPreferenceOnly:false};
}

export interface ProviderAccessReport {
  provider:string;
  label:string;
  agentProduct?:string;
  /** Discovery readiness, which is what the score reflects. */
  discovery:ReadinessState;
  /** Agentic fetch readiness -- reported, and honest about robots-bypassing agents. */
  agenticFetch:ReadinessState;
  /** Training access, reported for transparency and deliberately NOT scored. */
  training:"allowed"|"blocked_by_choice"|"unknown";
  agents:AgentAccess[];
  notes:string[];
}

export function providerAccess(robotsText:string|undefined,path="/"):ProviderAccessReport[]{
  const known=robotsText!==undefined;
  const groups=known?parseRobots(robotsText):[];
  return PROVIDERS.map(provider=>{
    const agents=provider.crawlers.map(a=>accessForAgent(groups,provider,a,path));
    const notes:string[]=[];

    const pick=(purpose:string):ReadinessState=>{
      const relevant=agents.filter(a=>a.agent.purpose===purpose);
      if(!relevant.length)return "unsupported";
      if(!known)return "unknown";
      if(relevant.some(a=>a.allowed))return "pass";
      // Every relevant agent is disallowed. If they are all documented as possibly ignoring
      // robots, we cannot honestly call the business unreachable.
      if(relevant.every(a=>a.statedPreferenceOnly)){
        notes.push(`${provider.label} ${purpose.replace("_"," ")} is disallowed in robots.txt, but ${provider.label} documents this agent as able to fetch at a user's request regardless. Treat this as your stated preference, not as proof the agent cannot reach you.`);
        return "unknown";
      }
      return "fail";
    };

    const trainingAgents=agents.filter(a=>a.agent.purpose==="training");
    const training=!known||!trainingAgents.length?"unknown"
      :trainingAgents.every(a=>!a.allowed)?"blocked_by_choice":"allowed";
    if(training==="blocked_by_choice")
      notes.push(`${provider.label} AI training access is blocked. That is a legitimate choice and does not reduce your score.`);

    return {provider:provider.id,label:provider.label,agentProduct:provider.agentProduct,
      discovery:pick("discovery"),agenticFetch:pick("agentic_fetch"),training,agents,notes};
  });
}
