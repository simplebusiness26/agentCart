import type {BusinessBrain,ChannelState,SalesAgentConfig} from "./types";

export interface ChannelCapability {id:string;label:string;state:ChannelState;canPublish:boolean;limitations:string[];verifiedOn:string;}

export function channelCapabilities():ChannelCapability[]{return [
  {id:"agentready_hosted",label:"AgentReady Hosted",state:"ready_for_provider",canPublish:true,limitations:["Read-only and safe handoffs by default."],verifiedOn:"2026-09-18"},
  {id:"openai_sponsored_agent",label:"OpenAI Sponsored Agent",state:"provider_not_available",canPublish:false,
    limitations:["Limited provider availability; AgentReady can prepare and validate a package but cannot activate the channel."],verifiedOn:"2026-09-18"}
];}

export function compileChannelPackage(brain:BusinessBrain,agent:SalesAgentConfig,channelId:string){
  const capability=channelCapabilities().find(c=>c.id===channelId);
  if(!capability)throw new Error("Unknown conversational channel.");
  return {schemaVersion:"2026-09-18",channel:channelId,state:capability.state,business:{name:brain.name,description:brain.description,website:brain.website},
    agent:{publicId:agent.publicId,displayName:agent.displayName,purpose:agent.purpose,tone:agent.tone,locale:agent.locale,
      supportedIntents:agent.supportedIntents,allowedActions:agent.allowedActions,unsupportedTopics:agent.unsupportedTopics,escalation:agent.escalation},
    knowledge:{brainVersion:brain.version,itemCount:brain.items.length,policyKeys:Object.keys(brain.policies)},
    safety:{inventFacts:false,publicWrites:false,merchantControlled:true},limitations:capability.limitations,
    note:capability.canPublish?"Ready for the controlled AgentReady channel.":"Readiness package only. This is not provider activation or approval."};
}

