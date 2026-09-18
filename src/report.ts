import type {AgentReadyReport,Check,FixType,ReadinessLayers} from "./agentready/types";
import {buildStandards} from "./standards";

// All text below that originates from a scanned website is escaped at the point of
// interpolation. Crawled content is untrusted data and is never treated as markup or
// as an instruction -- see docs/ARCHITECTURE.md.
const esc=(v:unknown)=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));

const FIX_LABEL:Record<FixType,string>={
  automatic:"AgentCart can fix",approval_required:"Needs your approval",
  manual:"Needs your team",hosted_layer:"AgentCart AI layer",unavailable:""
};
const FIX_CLASS:Record<FixType,string>={
  automatic:"auto",approval_required:"approve",manual:"manual",hosted_layer:"layer",unavailable:""
};

const PLATFORM_LABEL:Record<string,string>={
  shopify:"Shopify",woocommerce:"WooCommerce",wordpress:"WordPress",other:"Not identified"
};

function list(items:string[],empty:string){
  if(!items.length)return `<li class="muted">${esc(empty)}</li>`;
  return items.map(i=>`<li>${esc(i)}</li>`).join("");
}

function categoryBlock(r:AgentReadyReport){
  return r.categories.map(c=>{
    if(!c.maxPoints)return `<div class="cat na"><div class="catrow"><b>${esc(c.label)}</b><span class="muted">Not applicable</span></div>
      <div class="muted" style="font-size:13px">This does not apply to your kind of business, so it is not counted.</div></div>`;
    return `<div class="cat"><div class="catrow"><b>${esc(c.label)}</b><span class="muted">${c.score}%</span></div>
      <div class="catbar"><i style="width:${Math.max(2,c.score)}%"></i></div></div>`;
  }).join("");
}

function ctaFor(r:AgentReadyReport){
  if(r.platform.platform==="shopify")
    return `<a class="btn primary" href="/connect?shop=">Connect Shopify and fix this</a>
      <form class="formRow" style="margin-top:12px" action="/connect" method="get">
        <input class="input" name="shop" placeholder="your-store.myshopify.com" required>
        <button class="btn primary">Connect Shopify</button></form>`;
  if(r.platform.platform==="woocommerce"||r.platform.platform==="wordpress")
    return `<p class="muted">Direct fixes for ${esc(PLATFORM_LABEL[r.platform.platform])} are not available yet.
      AgentCart can still publish a hosted AI layer for your business so assistants have a clean source to read.</p>
      <a class="btn" href="/setup">See what is possible today</a>`;
  return `<p class="muted">AgentCart could not confidently identify your platform, so automatic fixes are not offered.
    The recommendations above can be applied by whoever maintains your website.</p>
    <a class="btn" href="/setup">See what is possible today</a>`;
}

function fixRow(c:Check){
  const dot=c.status==="pass"?"good":c.status==="partial"?"warn":"bad";
  return `<div class="fix"><span class="dot ${dot}"></span>
    <div><b>${esc(c.plainTitle)}</b>
      <div class="muted">${esc(c.evidence)}</div>
      <div class="muted" style="font-size:13px;margin-top:4px">Why this matters: ${esc(c.whyItMatters)}</div>
      ${c.recommendedFix?`<div style="margin-top:6px">&rarr; ${esc(c.recommendedFix)}</div>`:""}
      <details style="margin-top:6px"><summary class="muted" style="font-size:12px;cursor:pointer">Technical detail</summary>
        <div class="muted" style="font-size:12px">${esc(c.technicalDetail)}</div></details>
    </div>
    <div style="text-align:right">${c.fixType!=="unavailable"?`<span class="pill ${FIX_CLASS[c.fixType]}">${esc(FIX_LABEL[c.fixType])}</span>`:""}
      <div class="muted" style="margin-top:6px">${c.points}/${c.maxPoints}</div></div></div>`;
}

// Reported beside the score, never folded into it: passing a protocol check is not the same as
// an AI customer being able to use the business. Absent on a report replayed from storage, which
// predates the readiness layers, so the section is omitted rather than shown empty.
function standardsSection(r:AgentReadyReport&{readiness?:ReadinessLayers}){
  if(!r.readiness)return "";
  const standards=buildStandards({report:r,...r.readiness});
  const dot=(s:string)=>s==="pass"?"good":s==="fail"?"bad":"";
  const rows=r.readiness.discovery.map(d=>`<tr><td>${esc(d.path)}</td>
    <td><span class="dot ${dot(d.state)}"></span>${esc(d.state)}</td>
    <td class="muted">${esc(d.detail)}</td></tr>`).join("");
  const blocked=r.readiness.providers.filter(p=>p.discovery==="fail");
  return `<div class="card" style="margin-top:16px"><h3>Agent standards</h3>
    <p class="muted">${esc(standards.summary)}</p>
    <p class="muted" style="font-size:12px">${esc(standards.note)}</p>
    <table class="table"><thead><tr><th>File</th><th>State</th><th>What it means</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${blocked.length?`<p class="muted" style="font-size:13px;margin-top:12px">Your robots.txt asks
      ${esc(String(blocked.length))} known AI ${blocked.length===1?"crawler":"crawlers"} not to read this site:
      ${esc(blocked.map(p=>p.provider).join(", "))}. That is a choice, not a fault, and it is not scored.</p>`:""}
  </div>`;
}

export function reportBody(r:AgentReadyReport&{readiness?:ReadinessLayers},comparison?:{delta:number|null;comparable:boolean;previous:{score:number}|null}|null){
  const failing=r.checks.filter(c=>c.status!=="pass"&&c.status!=="na")
    .sort((a,b)=>b.estimatedGain-a.estimatedGain);
  const priority=failing.slice(0,5);
  const rest=failing.slice(5);
  const passing=r.checks.filter(c=>c.status==="pass");
  const skipped=r.checks.filter(c=>c.status==="na");

  const delta=comparison&&comparison.comparable&&comparison.delta!==null
    ? `<div class="delta ${comparison.delta>=0?"up":"down"}">${comparison.delta>=0?"+":"−"}${Math.abs(comparison.delta)} since your last scan</div>`
    : comparison&&comparison.previous&&!comparison.comparable
      ? `<div class="muted" style="font-size:13px">Your previous scan used an older scoring model, so the two are not directly comparable.</div>`
      : "";

  const confidence=r.platform.platform==="other"
    ? `<span class="muted">Platform not identified</span>`
    : `<span class="muted">${esc(PLATFORM_LABEL[r.platform.platform])} &middot; ${Math.round(r.platform.confidence*100)}% confidence</span>`;

  return `<main><div class="wrap section">
    <a class="muted" href="/">&larr; Scan another website</a>

    <div class="card" style="margin-top:18px">
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
        <div class="score">${r.score}</div>
        <div><div class="eyebrow">Agent Ready score</div>
          <h1 style="margin:5px 0">${esc(r.domain)}</h1>
          <div class="muted">${esc(r.grade)} &middot; ${r.pages.length} pages checked &middot; ${confidence}</div>
          ${delta}
        </div>
      </div>
      ${r.pointsRecoverable>0?`<p style="margin-top:18px">Fixing everything below would raise your score by up to
        <b>${r.pointsRecoverable} points</b>.</p>`:`<p style="margin-top:18px">Nothing actionable was found. Your site is already
        readable to AI assistants.</p>`}
    </div>

    <div class="two" style="margin-top:16px">
      <div class="card"><h3>What AI can and cannot understand</h3>
        <div class="cando">
          <div><b>Can understand</b><ul>${list(r.capabilities.canUnderstand,"Very little, currently.")}</ul></div>
          <div><b>Struggles with</b><ul>${list(r.capabilities.cannotUnderstand,"Nothing — everything checked was clear.")}</ul></div>
        </div>
        <h3 style="margin-top:22px">What AI can and cannot do</h3>
        <div class="cando">
          <div><b>Can do</b><ul>${list(r.capabilities.canDo,"No clear action is available.")}</ul></div>
          <div><b>Cannot do</b><ul>${list(r.capabilities.cannotDo,"Nothing — every action checked was available.")}</ul></div>
        </div>
      </div>
      <div class="card"><h3>Score breakdown</h3>${categoryBlock(r)}</div>
    </div>

    ${priority.length?`<div class="card" style="margin-top:16px"><h2>Fix these first</h2>
      <p class="muted">Ordered by how much score each one would recover.</p>
      ${priority.map(fixRow).join("")}</div>`:""}

    <div class="card" style="margin-top:16px">
      ${ctaFor(r)}
    </div>

    ${rest.length?`<div class="card" style="margin-top:16px"><h3>Other improvements</h3>${rest.map(fixRow).join("")}</div>`:""}

    ${passing.length?`<div class="card" style="margin-top:16px"><h3>Already working</h3>${passing.map(fixRow).join("")}</div>`:""}

    ${skipped.length?`<div class="card" style="margin-top:16px"><h3>Not applicable to your business</h3>
      <p class="muted">These were skipped rather than failed, and do not count against your score.</p>
      ${skipped.map(c=>`<div class="fix na"><span class="dot"></span><div><b>${esc(c.plainTitle)}</b>
        <div class="muted">${esc(c.evidence)}</div></div><div></div></div>`).join("")}</div>`:""}

    ${standardsSection(r)}

    <div class="card" style="margin-top:16px"><h3>Pages checked</h3>
      <table class="table"><thead><tr><th>Page</th><th>Type</th><th>Status</th></tr></thead><tbody>
      ${r.pages.map(p=>`<tr><td>${esc(p.url)}</td><td class="muted">${esc(p.pageType)}</td><td class="muted">${p.status}</td></tr>`).join("")}
      </tbody></table>
      <p class="muted" style="font-size:12px;margin-top:14px">Scoring model ${esc(r.scoringVersion)} &middot;
        scanned ${esc(new Date(r.scannedAt).toISOString().replace("T"," ").slice(0,16))} UTC</p>
    </div>
  </div></main>`;
}
