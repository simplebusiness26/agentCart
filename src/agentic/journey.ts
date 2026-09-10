import type {Env} from "../types";
import {assertScannableUrl} from "../scanner";
import {extractSignals} from "../agentready/extract";
import {assessInteraction} from "../agentready/interaction";
import type {ReadinessState} from "../providers/registry";

// Live Agent Journey Verification (Phase 10.14). Walks a real customer intent through the
// merchant's own site and reports how far an agent could actually get.
//
// HARD SAFETY RULE: this stops at the checkout handoff. It never submits a payment form, never
// completes an order, and never spends money. The final step is deliberately "reached checkout",
// not "purchased" -- verifying a real charge requires an explicit merchant test transaction, which
// is a launch-gate step for the owner, not something AgentCart does on its own.

export type JourneyIntent="buy_product"|"find_policy"|"contact_business"|"book_appointment";

export interface JourneyStep {
  name:string;
  state:ReadinessState;
  url?:string;
  evidence:string;
  detail:string;
}

export interface JourneyResult {
  intent:JourneyIntent;
  startUrl:string;
  reached:string;
  completed:boolean;
  steps:JourneyStep[];
  stoppedBecause:string;
  safetyNote:string;
}

export const JOURNEY_SAFETY_NOTE=
  "This check stops at the point where a customer would enter payment details. AgentCart never submits a payment, never completes an order and never spends money.";

const MAX_STEPS=6;
const BUDGET_MS=9000;

interface Fetched { ok:boolean; status:number; html:string; url:string }

async function get(url:URL,signal:AbortSignal):Promise<Fetched>{
  const res=await fetch(url.toString(),{signal,redirect:"follow",
    headers:{"User-Agent":"AgentCartJourneyVerifier/1.0 (+https://github.com/simplebusiness26/agentCart)"}});
  return {ok:res.ok,status:res.status,html:res.ok?(await res.text()).slice(0,512_000):"",url:url.toString()};
}

function firstLink(html:string,base:URL,pattern:RegExp){
  for(const m of html.matchAll(/<a\b[^<>]{0,600}\bhref=["']([^"']{1,500})["']/gi)){
    const href=m[1];
    if(!pattern.test(href))continue;
    try{
      const u=new URL(href,base);
      if(u.host===base.host)return u;
    }catch{/* skip unparseable */}
  }
  return null;
}

export async function verifyJourney(input:string,intent:JourneyIntent,now=()=>Date.now()):Promise<JourneyResult>{
  const root=assertScannableUrl(input);
  const controller=new AbortController();
  const started=now();
  const timer=setTimeout(()=>controller.abort(),BUDGET_MS);
  const steps:JourneyStep[]=[];
  const timeLeft=()=>BUDGET_MS-(now()-started)>500;
  let reached="start";
  let stoppedBecause="";

  const step=(name:string,state:ReadinessState,evidence:string,detail:string,url?:string)=>{
    steps.push({name,state,evidence,detail,url});
    if(state==="pass")reached=name;
    return state==="pass";
  };

  try{
    const home=await get(root,controller.signal);
    if(!step("Reached the website",home.ok?"pass":"fail",`HTTP ${home.status}`,
      home.ok?"The site responded.":"The site did not respond, so no agent journey is possible.",home.url)){
      stoppedBecause="The website did not load.";
      return {intent,startUrl:root.toString(),reached,completed:false,steps,stoppedBecause,safetyNote:JOURNEY_SAFETY_NOTE};
    }

    if(intent==="find_policy"||intent==="contact_business"){
      const pattern=intent==="find_policy"
        ?/(shipping|delivery|return|refund|policies|terms|privacy)/i
        :/(contact|about|support|help)/i;
      const link=firstLink(home.html,root,pattern);
      if(!link){
        step(intent==="find_policy"?"Found a policy page":"Found a contact route","fail",
          "no matching link on the homepage",
          "No link to that information was found from the homepage, so an agent would have to guess.");
        stoppedBecause="The information was not linked from the homepage.";
      }else if(timeLeft()){
        const page=await get(link,controller.signal);
        const signals=page.ok?extractSignals(page.html):null;
        step(intent==="find_policy"?"Found a policy page":"Found a contact route",
          page.ok&&(signals?.textLength||0)>200?"pass":page.ok?"unknown":"fail",
          `HTTP ${page.status}, ${signals?.textLength||0} characters of readable text`,
          page.ok?(signals?.textLength||0)>200?"The page loads with readable content an agent can quote."
            :"The page loads but returned very little readable text."
            :"The linked page did not load.",page.url);
        if(intent==="contact_business"&&page.ok){
          const contactable=(signals?.emails.length||0)>0||(signals?.phones.length||0)>0||!!signals?.contactForm;
          step("A contact method is usable",contactable?"pass":"fail",
            `email:${signals?.emails.length||0} phone:${signals?.phones.length||0} form:${!!signals?.contactForm}`,
            contactable?"An agent can reach a real contact method.":"No usable contact method was found on the page.");
        }
      }
      clearTimeout(timer);
      return {intent,startUrl:root.toString(),reached,
        completed:steps.every(s=>s.state==="pass"),steps,
        stoppedBecause:stoppedBecause||(steps.every(s=>s.state==="pass")?"The journey completed.":"The journey did not complete."),
        safetyNote:JOURNEY_SAFETY_NOTE};
    }

    if(intent==="book_appointment"){
      const link=firstLink(home.html,root,/(book|booking|appointment|reserve|schedule)/i);
      if(!link){
        step("Found a booking route","fail","no booking link on the homepage",
          "No booking link was found, so an agent cannot start a booking.");
        stoppedBecause="No booking route was linked.";
      }else if(timeLeft()){
        const page=await get(link,controller.signal);
        const controls=page.ok?assessInteraction(page.html,{offersBooking:true}):[];
        const control=controls.find(c=>c.key==="booking-control");
        step("Found a booking route",page.ok?"pass":"fail",`HTTP ${page.status}`,
          page.ok?"A booking page loads.":"The booking page did not load.",page.url);
        if(page.ok)
          step("Booking can be started",control?.state==="pass"?"pass":"unknown",
            control?.evidence||"no booking control detected",
            control?.state==="pass"?"An operable booking control is present."
              :"No operable booking control was detected. A real browser may still work, which this check cannot confirm.");
      }
      clearTimeout(timer);
      return {intent,startUrl:root.toString(),reached,completed:steps.every(s=>s.state==="pass"),steps,
        stoppedBecause:stoppedBecause||"Stopped before any booking was submitted.",safetyNote:JOURNEY_SAFETY_NOTE};
    }

    // buy_product
    const productLink=firstLink(home.html,root,/\/(products?|item|shop)\//i);
    if(!productLink){
      step("Found a product","fail","no product link on the homepage",
        "No product link was found from the homepage, so an agent has nothing to buy.");
      stoppedBecause="No product was reachable from the homepage.";
      clearTimeout(timer);
      return {intent,startUrl:root.toString(),reached,completed:false,steps,stoppedBecause,safetyNote:JOURNEY_SAFETY_NOTE};
    }

    const product=timeLeft()?await get(productLink,controller.signal):null;
    if(!product?.ok){
      step("Found a product","fail",`HTTP ${product?.status??"timeout"}`,
        "The product page did not load.",productLink.toString());
      stoppedBecause="The product page did not load.";
      clearTimeout(timer);
      return {intent,startUrl:root.toString(),reached,completed:false,steps,stoppedBecause,safetyNote:JOURNEY_SAFETY_NOTE};
    }
    step("Found a product","pass",`HTTP ${product.status}`,"A product page loads.",product.url);

    const signals=extractSignals(product.html);
    step("Read the price",signals.priceSignals&&signals.currencySignals.length?"pass"
        :signals.priceSignals?"unknown":"fail",
      `price:${signals.priceSignals} currency:${signals.currencySignals.join(",")||"none"}`,
      signals.priceSignals&&signals.currencySignals.length?"An agent can read the price and currency."
        :signals.priceSignals?"A price is present but the currency is ambiguous."
        :"No machine-readable price was found.");

    const controls=assessInteraction(product.html,{sellsProducts:true});
    const cart=controls.find(c=>c.key==="add-to-cart");
    step("Add to cart is operable",cart?.state==="pass"?"pass":cart?.state==="unknown"?"unknown":"fail",
      cart?.evidence||"no cart control detected",
      cart?.detail||"No add-to-cart control was found.");

    const checkoutLink=firstLink(product.html,root,/\/(checkout|cart)\b/i);
    step("Reached the checkout handoff",checkoutLink?"pass":signals.checkoutLink?"unknown":"fail",
      checkoutLink?`checkout route: ${checkoutLink.pathname}`:"no checkout link found",
      checkoutLink?"An agent can hand the customer to checkout. This is where the check stops."
        :signals.checkoutLink?"Checkout is mentioned but no link was found to follow."
        :"No checkout route was found.",checkoutLink?.toString());

    stoppedBecause="Stopped at the checkout handoff, before any payment step.";
    clearTimeout(timer);
    return {intent,startUrl:root.toString(),reached,
      completed:steps.every(s=>s.state==="pass"),steps,stoppedBecause,safetyNote:JOURNEY_SAFETY_NOTE};
  }catch(e){
    clearTimeout(timer);
    step("Journey interrupted","unknown",e instanceof Error?e.message.slice(0,160):"error",
      "The journey could not be completed because of a network or timeout problem.");
    return {intent,startUrl:root.toString(),reached,completed:false,steps,
      stoppedBecause:"The journey was interrupted.",safetyNote:JOURNEY_SAFETY_NOTE};
  }finally{clearTimeout(timer);}
}

export async function saveJourney(env:Env,shop:string,result:JourneyResult,nowMs=Date.now()){
  await env.DB.prepare(`INSERT INTO commerce_journeys(journey_id,shop_domain,provider,intent,target_url,created_ms,last_seen_ms)
    VALUES(?,?,?,?,?,?,?)`)
    .bind(`verify_${nowMs.toString(36)}_${Math.random().toString(36).slice(2,10)}`,shop,"verification",
      result.intent,result.startUrl,nowMs,nowMs).run();
}
