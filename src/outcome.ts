import type {Env} from "./types";
import {WINDOW_MS,getDashboardWindows} from "./db";
import {revenueByTier,agenticOrders} from "./attribution";
import {getScanComparison} from "./agentready/store";
import {aeoReport} from "./aeo";
import {connectionHealth} from "./ops";

// The outcome view (Phase 12.10): move from "your score is X" toward "here is what AI can do for
// your business and what it produced".
//
// The five layers stay separable and separately versioned. The dashboard summarises them together
// but never merges their data -- a readiness score and a revenue figure are different kinds of
// claim and must not be averaged into one number.

export interface OutcomeView {
  readiness:{score:number|null;grade:string|null;delta:number|null;comparable:boolean;
    canUnderstand:string[];cannotUnderstand:string[];canDo:string[];cannotDo:string[];pointsRecoverable:number|null};
  standards:{note:string};
  visibility:{status:string;summary:string;caveat:string};
  customers:{visits:number;orders:number;tiers:Array<{tier:string;label:string;orders:number;revenue:number}>;
    agents:Array<{agent:string;tier:string;orders:number;revenue:number}>;verified:boolean};
  health:{overall:string;summary:string};
  northStar:{label:string;verifiedRevenue:number;reportedRevenue:number;unattributed:number;note:string};
  note:string;
}

export const LAYER_NOTE=
  "These five layers are measured separately and never merged into a single number. A readiness score and a revenue figure are different kinds of claim.";

export async function buildOutcome(env:Env,shop:string,domain:string|null,nowMs=Date.now()):Promise<OutcomeView>{
  const anchor=nowMs+1;
  const [dash,tiers,agents,visibility,health]=await Promise.all([
    getDashboardWindows(env,shop,nowMs),
    revenueByTier(env,shop,anchor-WINDOW_MS,anchor),
    agenticOrders(env,shop,anchor-WINDOW_MS,anchor),
    aeoReport(env,shop),
    connectionHealth(env,shop,nowMs)
  ]);
  const comparison=domain?await getScanComparison(env,domain).catch(()=>null):null;
  const latest=comparison?.latest as any;

  const verified=tiers.find(t=>t.tier==="verified")?.revenue||0;
  const reported=tiers.find(t=>t.tier==="reported")?.revenue||0;
  const unknown=tiers.find(t=>t.tier==="unknown")?.revenue||0;

  return {
    readiness:{
      score:latest?Number(latest.score):null,
      grade:latest?String(latest.grade):null,
      delta:comparison?.delta??null,
      comparable:!!comparison?.comparable,
      // Populated from the stored capabilities on the latest run.
      canUnderstand:[],cannotUnderstand:[],canDo:[],cannotDo:[],
      pointsRecoverable:null},
    standards:{note:"Agent Standards are reported on their own tab and are not folded into the readiness score."},
    visibility:{status:visibility.status,summary:visibility.summary,caveat:visibility.caveat},
    customers:{
      visits:Number((dash.summary as any)?.visits||0),
      orders:Number((dash.summary as any)?.orders||0),
      tiers:tiers.map(t=>({tier:t.tier,label:t.label,orders:t.orders,revenue:t.revenue})),
      agents,verified:!!(dash as any).verified},
    health:{overall:health.overall,summary:health.summary},
    northStar:{
      label:"AI customers and verified AI-attributed revenue",
      verifiedRevenue:verified,reportedRevenue:reported,unattributed:unknown,
      // The honest framing: scores are diagnostic, this is the outcome.
      note:verified>0
        ? "Verified revenue comes from cryptographically verified platform order records."
        : "No verified AI revenue yet. Reported revenue comes from the storefront pixel and is shown separately because a browser can be made to say anything."},
    note:LAYER_NOTE
  };
}
