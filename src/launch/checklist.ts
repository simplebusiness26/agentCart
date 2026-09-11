import type {Env} from "../types";
import {launchStatus,missingPrerequisites} from "./gate";
import {connectionHealth} from "../ops";
import {getShop} from "../db";

// The single authoritative answer to "is AgentCart ready to launch?" (Phase 11.9).
//
// There is deliberately exactly one of these. Multiple partial status views is how a team ends up
// believing it has shipped something it has not.

export type ChecklistState="done"|"blocked"|"owner_action"|"not_started";

export interface ChecklistItem {
  key:string;
  label:string;
  state:ChecklistState;
  detail:string;
  /** Who has to act. AgentCart cannot do the owner's account setup for them. */
  owner:"agentcart"|"you";
}

export interface LaunchChecklist {
  readyForLaunch:boolean;
  headline:string;
  items:ChecklistItem[];
  ownerActions:string[];
  hardRule:string;
}

export const HARD_RULE=
  "A green test suite and green CI never make AgentCart launch ready. The real-infrastructure launch gate must pass first.";

export async function buildChecklist(env:Env,shop?:string):Promise<LaunchChecklist>{
  const items:ChecklistItem[]=[];
  const gate=await launchStatus(env,"production");
  const missing=missingPrerequisites(env);

  items.push({key:"code",label:"Application code and automated tests",
    state:"done",owner:"agentcart",
    detail:"The scanner, fix engine, hosted AI layer, protocol surfaces, monitoring and attribution are implemented and covered by the automated suite. This is necessary but not sufficient."});

  items.push({key:"config",label:"Production configuration",
    state:missing.length?"owner_action":"done",owner:"you",
    detail:missing.length
      ? `Still missing: ${missing.join(", ")}. Set these as Cloudflare Worker secrets and variables.`
      : "Shopify credentials, the encryption key and a public APP_URL are all configured."});

  items.push({key:"deploy",label:"Worker deployed with D1 migrated",
    state:gate.checks.find(c=>c.key==="d1-migrations")?.status==="pass"?"done":"owner_action",
    owner:"you",
    detail:gate.checks.find(c=>c.key==="d1-migrations")?.status==="pass"
      ? "Migrations have been confirmed applied against real D1."
      : "Create the D1 database, run the remote migration and deploy the Worker."});

  const store=shop?await getShop(env,shop):null;
  items.push({key:"store",label:"Installed on a Shopify development store",
    state:store?"done":"owner_action",owner:"you",
    detail:store?"A development store is connected."
      :"Create the Shopify app, deploy the Web Pixel extension and install AgentCart on a development store."});

  if(store&&shop){
    const health=await connectionHealth(env,shop);
    items.push({key:"health",label:"Connection is healthy",
      state:health.overall==="ok"?"done":"blocked",owner:"you",
      detail:health.summary});
  }

  items.push({key:"gate",label:"Real-infrastructure launch gate",
    state:gate.readyForLaunch?"done":gate.passed>0?"blocked":"not_started",owner:"you",
    detail:gate.summary});

  items.push({key:"legal",label:"Real support and privacy contact details",
    state:"owner_action",owner:"you",
    detail:"Replace the placeholder contact text on the privacy page with real business details, and have the privacy policy and terms reviewed for your jurisdiction."});

  items.push({key:"protected-data",label:"Protected Customer Data approval (optional)",
    state:"owner_action",owner:"you",
    detail:"Only needed to switch on verified revenue. Complete Shopify's questionnaire, then add read_orders and the orders/paid subscription."});

  const readyForLaunch=gate.readyForLaunch&&items.every(i=>i.state==="done"||i.key==="protected-data");

  const ownerActions=items.filter(i=>i.owner==="you"&&i.state!=="done").map(i=>`${i.label}: ${i.detail}`);

  return {readyForLaunch,items,ownerActions,hardRule:HARD_RULE,
    headline:readyForLaunch
      ? "AgentCart is launch ready. Every check has passed against real infrastructure."
      : `AgentCart is not launch ready. ${ownerActions.length} item(s) need you, and the launch gate has ${gate.passed} of ${gate.total} checks passing.`};
}
