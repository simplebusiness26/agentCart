import type { AgentReadyReport, ReadinessLayers } from "./agentready/types";
import { reportBody } from "./report";

const css=`
:root{--bg:#08110f;--panel:#0e1a17;--panel2:#13231f;--text:#effbf5;--muted:#9bb7aa;--line:#203b33;--accent:#68f7b2;--accent2:#b9ffdc;--bad:#ff8d8d;--warn:#ffd27a;--good:#74efb3;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% -20%,#163d31 0,transparent 38%),var(--bg);color:var(--text);line-height:1.5}a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:auto;padding:0 22px}.nav{height:72px;display:flex;align-items:center;justify-content:space-between}.brand{font-size:21px;font-weight:850;letter-spacing:-.7px}.brand span{color:var(--accent)}.navlinks{display:flex;gap:18px;color:var(--muted);font-size:14px}.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:12px 17px;font-weight:750;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer}.btn.primary{background:var(--accent);color:#06120e;border-color:var(--accent)}.hero{padding:72px 0 54px;display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:center}.eyebrow{color:var(--accent);font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1.5px}.hero h1{font-size:clamp(44px,7vw,76px);line-height:.98;letter-spacing:-4px;margin:12px 0 22px}.hero p{font-size:19px;color:var(--muted);max-width:680px}.heroCard,.card{background:linear-gradient(145deg,rgba(19,35,31,.96),rgba(12,24,21,.96));border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 20px 70px rgba(0,0,0,.22)}.metricBig{font-size:48px;font-weight:850;letter-spacing:-2px}.muted{color:var(--muted)}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.section{padding:54px 0}.section h2{font-size:36px;letter-spacing:-1.5px;margin:0 0 12px}.formRow{display:flex;gap:10px;margin-top:22px}.input{width:100%;padding:14px 15px;border-radius:12px;background:#07120f;border:1px solid var(--line);color:var(--text);font:inherit;outline:none}.input:focus{border-color:var(--accent)}.chip{display:inline-block;border:1px solid var(--line);padding:5px 9px;border-radius:999px;font-size:12px;color:var(--muted)}.score{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;border:9px solid var(--accent);font-size:31px;font-weight:850}.finding{display:grid;grid-template-columns:28px 1fr auto;gap:12px;padding:16px 0;border-bottom:1px solid var(--line)}.finding:last-child{border:0}.dot{width:12px;height:12px;border-radius:50%;margin-top:7px}.good{background:var(--good)}.warn{background:var(--warn)}.bad{background:var(--bad)}.dashHead{display:flex;align-items:flex-end;justify-content:space-between;padding:40px 0 20px}.dashHead h1{margin:0;font-size:40px;letter-spacing:-1.8px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.metric{padding:20px;border:1px solid var(--line);border-radius:17px;background:var(--panel)}.metric b{display:block;font-size:29px;letter-spacing:-1px;margin-top:5px}.two{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;margin-top:16px}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:12px 8px;text-align:left;border-bottom:1px solid var(--line);font-size:14px}.table th{color:var(--muted);font-weight:650}.empty{padding:38px 10px;text-align:center;color:var(--muted)}.footer{padding:50px 0;color:var(--muted);font-size:13px;border-top:1px solid var(--line);margin-top:60px}.footerin{display:flex;justify-content:space-between;gap:15px}.legal{max-width:760px;padding:45px 0}.legal h1{font-size:42px}.legal h2{margin-top:34px}.legal p,.legal li{color:var(--muted)}.status{font-size:12px;padding:4px 8px;border-radius:999px;background:#17362c;color:var(--accent2)}

.catbar{height:8px;border-radius:99px;background:#0a1714;overflow:hidden;margin-top:8px}.catbar i{display:block;height:100%;background:var(--accent)}
.cat{padding:14px 0;border-bottom:1px solid var(--line)}.cat:last-child{border:0}
.catrow{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.cando{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cando ul{margin:8px 0 0;padding-left:18px}.cando li{margin:5px 0;color:var(--muted)}
.pill{display:inline-block;font-size:11px;font-weight:750;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.6px}
.pill.auto{background:#17362c;color:var(--accent2)}.pill.approve{background:#3a3016;color:var(--warn)}
.pill.manual{background:#2a2733;color:#cdbfe8}.pill.layer{background:#152c3a;color:#a9dcf7}
.fix{display:grid;grid-template-columns:12px 1fr auto;gap:12px;padding:16px 0;border-bottom:1px solid var(--line)}
.fix:last-child{border:0}.na{opacity:.55}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 18px;border-bottom:1px solid var(--line)}
.tab{background:none;border:0;border-bottom:2px solid transparent;color:var(--muted);font:inherit;font-weight:700;padding:10px 14px;cursor:pointer}
.tab.on{color:var(--text);border-bottom-color:var(--accent)}
.delta{font-size:14px;font-weight:750}.delta.up{color:var(--good)}.delta.down{color:var(--bad)}
.demoShell{display:grid;grid-template-columns:.86fr 1.14fr;gap:18px;align-items:start}.demoChat{background:#07120f;border:1px solid var(--line);border-radius:20px;overflow:hidden}.demoChatHead{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}.demoMsgs{padding:18px;min-height:330px;display:flex;flex-direction:column;gap:12px}.bubble{max-width:86%;padding:12px 14px;border-radius:16px;font-size:14px}.bubble.user{align-self:flex-end;background:var(--accent);color:#06120e;border-bottom-right-radius:5px}.bubble.agent{align-self:flex-start;background:var(--panel2);border:1px solid var(--line);border-bottom-left-radius:5px}.demoPrompts{display:flex;gap:8px;flex-wrap:wrap;padding:0 18px 18px}.demoPrompt{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:999px;padding:8px 11px;font:inherit;font-size:12px;cursor:pointer}.demoPrompt:hover{border-color:var(--accent)}.stageRow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.stage{padding:15px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.stage strong{display:block;margin-bottom:4px}.stage.live{border-color:var(--warn)}.featureGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.feature{padding:16px;border:1px solid var(--line);border-radius:16px;background:rgba(7,18,15,.6)}
@media(max-width:780px){.demoShell,.stageRow,.featureGrid{grid-template-columns:1fr}{.hero{grid-template-columns:1fr;padding-top:42px}.hero h1{letter-spacing:-2.5px}.grid3,.metrics,.two{grid-template-columns:1fr}.navlinks a:not(.keep){display:none}.formRow{flex-direction:column}.dashHead{align-items:flex-start;gap:14px;flex-direction:column}.footerin{flex-direction:column}.metric b{font-size:25px}.cando{grid-template-columns:1fr}}
`;

function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));}
function layout(title:string,body:string){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="AgentCart checks whether AI assistants can understand your business, helps you fix what is in the way, and shows whether AI is sending you customers."><title>${esc(title)} · AgentCart</title><style>${css}</style></head><body><div class="wrap"><nav class="nav"><a class="brand" href="/">Agent<span>Cart</span></a><div class="navlinks"><a href="/#scanner">Free check</a><a href="/dashboard?demo=1">Dashboard demo</a><a href="/demo/sponsored-agent">Sponsored Agent demo</a><a class="keep" href="/setup">Setup</a></div></nav></div>${body}<footer class="footer"><div class="wrap footerin"><div>© ${new Date().getFullYear()} AgentCart · AI commerce attribution & readiness.</div><div><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></div></div></footer></body></html>`;}

export function homePage(){return layout("Make your business ready for AI customers",`<main><div class="wrap">
<section class="hero"><div>
  <div class="eyebrow">AI assistants are becoming a sales channel</div>
  <h1>Can AI customers understand your business?</h1>
  <p>People increasingly ask an AI assistant what to buy and who to use. AgentCart checks whether those assistants can actually read your business, understand what you sell, and send you the customer &mdash; then helps you fix what is in the way.</p>
  <form class="formRow" action="/scan" method="get">
    <input class="input" name="url" type="text" inputmode="url" placeholder="yourbusiness.com" required aria-label="Your website address">
    <button class="btn primary" type="submit">Check my website</button>
  </form>
  <p class="muted" style="font-size:13px;margin-top:10px">Free. No account needed. We only read publicly available pages.</p>
</div>
<div class="heroCard"><span class="chip">Example report</span>
  <div style="display:flex;gap:18px;align-items:center;margin-top:18px">
    <div class="score" style="width:88px;height:88px;font-size:26px;border-width:7px">54</div>
    <div><div class="muted">Agent Ready score</div><b style="font-size:19px">Needs work</b>
      <div class="muted" style="font-size:13px">9 pages checked</div></div>
  </div>
  <div style="margin-top:20px">
    <div class="finding" style="padding:10px 0"><span class="dot good"></span><div>Can read your prices</div><b></b></div>
    <div class="finding" style="padding:10px 0"><span class="dot bad"></span><div>Cannot tell what is in stock</div><b></b></div>
    <div class="finding" style="padding:10px 0"><span class="dot bad"></span><div>Cannot find your returns policy</div><b></b></div>
  </div>
</div></section>

<section class="section"><div class="grid3">
  <div class="card"><span class="chip">1 &middot; CHECK</span><h3>See what AI can and cannot do</h3>
    <p class="muted">We read your public pages the way an assistant would and score how well it can understand your business, your products, your policies and how to act.</p></div>
  <div class="card"><span class="chip">2 &middot; FIX</span><h3>Fix what can safely be fixed</h3>
    <p class="muted">Connect Shopify and AgentCart applies the safe improvements itself, asks your approval before changing anything customers read, and tells you plainly what only your team can do.</p></div>
  <div class="card"><span class="chip">3 &middot; PROVE</span><h3>Watch the score rise</h3>
    <p class="muted">Rescan and see the before and after. AgentCart keeps checking, so you find out if something breaks rather than discovering it months later.</p></div>
</div></section>

<section class="section"><div class="card">
  <div class="eyebrow">Also included</div>
  <h2>See whether AI is actually sending you customers</h2>
  <p class="muted">Once your Shopify store is connected, AgentCart records visits and orders that arrive from identifiable AI assistants &mdash; ChatGPT, Claude, Gemini, Perplexity, Microsoft Copilot and Meta AI. Where a referral cannot be identified, we say so rather than guessing.</p>
  <div class="formRow"><a class="btn" href="/dashboard?demo=1">See the demo dashboard</a></div>
</div></section>

<section class="section"><div class="card">
  <div class="eyebrow">Emerging AI advertising</div>
  <h2>See what a Sponsored Agent could look like</h2>
  <p class="muted">AgentReady can prepare the business knowledge, actions, testing and measurement behind a conversational sales agent now. Where a provider channel is not yet generally available, we can still demonstrate the experience and get the business technically ready.</p>
  <div class="formRow"><a class="btn primary" href="/demo/sponsored-agent">Try the Sponsored Agent demo</a></div>
</div></section>

<section id="scanner" class="section"><div class="card">
  <div class="eyebrow">Free check</div>
  <h2>Start with your website</h2>
  <p class="muted">Enter any public business website. You do not need a Shopify store to get a report.</p>
  <form class="formRow" action="/scan" method="get">
    <input class="input" name="url" type="text" inputmode="url" placeholder="yourbusiness.com" required aria-label="Your website address">
    <button class="btn primary" type="submit">Check my website</button>
  </form>
</div></section>
</div></main>`);}

export function dashboardPage(demo:boolean,shop?:string|null,pixelFailed=false){
  const banner=pixelFailed?`<div class="card" style="margin-top:22px;border-color:var(--warn)"><b>Your store is connected, but the AgentCart pixel did not activate.</b><div class="muted">Attribution will stay empty until it does. Reconnect from the home page to retry, or activate the AgentCart pixel from your Shopify admin under Settings &rarr; Customer events.</div></div>`:"";
  return layout("Dashboard",`<main><div class="wrap">${banner}
  <div class="dashHead">
    <div><div class="eyebrow">AgentCart</div>
      <h1>${demo?"Demo Store":esc(shop||"Your store")}</h1>
      <div class="muted">Agent readiness, fixes and AI traffic</div></div>
    <span class="status">${demo?"DEMO DATA":"LIVE"}</span>
  </div>
  <div class="tabs" role="tablist">
    <button class="tab on" data-tab="overview">Overview</button>
    <button class="tab" data-tab="ready">Agent Ready</button>
    <button class="tab" data-tab="fixes">Fixes</button>
    <button class="tab" data-tab="layer">AI Layer</button>
    <button class="tab" data-tab="traffic">AI Traffic</button>
    <button class="tab" data-tab="agents">AI Agents</button>
    <button class="tab" data-tab="sales">AI Sales</button>
    <button class="tab" data-tab="analytics">Analytics &amp; Growth</button>
    <button class="tab" data-tab="commerce">Commerce &amp; Security</button>
    <button class="tab" data-tab="launch">Launch</button>
  </div>
  <div id="panel-overview" class="panel"><div class="empty">Loading…</div></div>
  <div id="panel-ready" class="panel" hidden><div class="empty">Loading…</div></div>
  <div id="panel-fixes" class="panel" hidden><div class="empty">Loading…</div></div>
  <div id="panel-layer" class="panel" hidden><div class="empty">Loading…</div></div>
  <div id="panel-traffic" class="panel" hidden><div class="empty">Loading commerce signals…</div></div>
  <div id="panel-agents" class="panel" hidden><div class="empty">Loading agent readiness…</div></div>
  <div id="panel-sales" class="panel" hidden><div class="empty">Loading your Business Brain and AI salesperson…</div></div>
  <div id="panel-analytics" class="panel" hidden><div class="empty">Loading visibility, fanouts, sources and growth actions…</div></div>
  <div id="panel-commerce" class="panel" hidden><div class="empty">Loading commerce standards, referral evidence and action security…</div></div>
  <div id="panel-launch" class="panel" hidden><div class="empty">Loading launch status…</div></div>
  </div></main><script>
const demo=${demo?"true":"false"};
let CUR='USD';
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:CUR,maximumFractionDigits:0}).format(Number(n||0));
const num=n=>new Intl.NumberFormat('en-GB').format(Number(n||0));
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const delta=(cur,prev)=>{const c=Number(cur||0),p=Number(prev||0);if(!p)return '';const d=(c-p)/p*100;return '<span class="muted" style="font-size:13px"> '+(d>=0?'+':'\u2212')+Math.abs(d).toFixed(1)+'%</span>';};
const set=(id,html)=>{document.querySelector('#panel-'+id).innerHTML=html;};
// Rejects with the server's own explanation where there is one, so a refusal that has a reason
// (an undo the store has moved past, a write the guard blocked) can be shown rather than swallowed.
const getJSON=(u,o)=>fetch(u,Object.assign({credentials:'same-origin'},o||{}))
  .then(r=>r.ok?r.json():r.json().catch(()=>({})).then(b=>{
    const e=new Error(b&&b.error?b.error:'Request failed ('+r.status+')');e.status=r.status;throw e;}));

document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
  document.querySelectorAll('.panel').forEach(p=>{p.hidden=true;});
  document.querySelector('#panel-'+t.dataset.tab).hidden=false;
}));

function signedOut(id,what){set(id,'<div class="card empty"><h3>No connected store yet</h3><p>Connect Shopify to see '+what+'.</p><a class="btn primary" href="/">Connect a store</a></div>');}

// ---- AI traffic (the original attribution dashboard) ----
getJSON('/api/dashboard'+(demo?'?demo=1':'')).then(d=>{
  CUR=d.currency||'USD';
  const s=d.summary||{},prev=d.previous||{};
  const visits=Number(s.visits||0),orders=Number(s.orders||0),conv=visits?orders/visits*100:0;
  const trust=d.verified
    ? '<span class="chip" title="Revenue comes from Shopify order webhooks, which are cryptographically verified.">Verified revenue</span>'
    : '<span class="chip" title="Revenue is reported by the storefront pixel. Useful for attribution, but not cryptographically verified.">Reported revenue</span>';
  const mixed=Number(d.currencyCount||0)>1?'<span class="chip" style="margin-left:8px">mixed currencies \u2014 totals are approximate</span>':'';
  const rows=(d.sources||[]).map(x=>'<tr><td><b>'+esc(x.source)+'</b></td><td>'+num(x.visits)+'</td><td>'+num(x.orders)+'</td><td>'+money(x.revenue)+'</td></tr>').join('');
  const funnel=Object.fromEntries((d.funnel||[]).map(x=>[x.event_type,Number(x.count)]));
  const products=(d.topProducts||[]).map(p=>'<tr><td><b>'+esc(p.product)+'</b></td><td>'+num(p.events)+'</td><td>'+money(p.revenue)+'</td></tr>').join('');
  set('traffic','<div style="margin-bottom:14px">'+trust+mixed+'</div>'
   +'<div class="metrics"><div class="metric"><span class="muted">AI visits</span><b>'+num(visits)+delta(visits,prev.visits)+'</b></div>'
   +'<div class="metric"><span class="muted">AI orders</span><b>'+num(orders)+delta(orders,prev.orders)+'</b></div>'
   +'<div class="metric"><span class="muted">AI revenue</span><b>'+money(s.revenue)+delta(s.revenue,prev.revenue)+'</b></div>'
   +'<div class="metric"><span class="muted">Conversion</span><b>'+conv.toFixed(1)+'%</b></div></div>'
   +'<div class="two"><div class="card"><h3>AI sources</h3><table class="table"><thead><tr><th>Source</th><th>Visits</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
   +'<div class="card"><h3>Observed funnel</h3>'
   +'<div class="finding"><span class="dot good"></span><div>Page views</div><b>'+num(funnel.page_viewed||0)+'</b></div>'
   +'<div class="finding"><span class="dot good"></span><div>Product views</div><b>'+num(funnel.product_viewed||0)+'</b></div>'
   +'<div class="finding"><span class="dot warn"></span><div>Checkouts started</div><b>'+num(funnel.checkout_started||0)+'</b></div>'
   +'<div class="finding"><span class="dot good"></span><div>Checkouts completed</div><b>'+num(funnel.checkout_completed||0)+'</b></div></div></div>'
   +'<div class="card" style="margin-top:16px"><h3>Top products</h3>'
   +(products?'<table class="table"><thead><tr><th>Product</th><th>Events</th><th>Revenue</th></tr></thead><tbody>'+products+'</tbody></table>':'<div class="empty">No product activity from identifiable AI referrals yet.</div>')+'</div>');
}).catch(()=>signedOut('traffic','which AI assistants are sending you customers'));

if(demo){
  const soon='<div class="card empty"><h3>Available once a store is connected</h3><p>This demo shows AI traffic only.</p></div>';
  ['overview','ready','fixes','layer','agents','launch'].forEach(id=>set(id,soon));
  set('sales','<div class="card"><span class="chip">DEMO → READY → LIVE</span><h3>Business AI Sales Agent</h3><p class="muted">A connected merchant gets one verified Business Brain, a controllable AI salesperson, grounded preview conversations, regression tests and provider-ready packages.</p><a class="btn" href="/demo/sponsored-agent">Open the concept demo</a></div>');
  set('analytics','<div class="card"><span class="chip">PHASES 25–29</span><h3>AI analytics that lead to action</h3><p class="muted">Visibility, citations, query fanouts, crawler evidence, perception, shopping results and revenue stay evidence-labelled, then route into a verifiable fix.</p></div>');
}else{
  // ---- Overview ----
  Promise.allSettled([getJSON('/api/monitoring'),getJSON('/api/fixes'),getJSON('/api/ai-layer'),getJSON('/api/sync/status'),getJSON('/api/health/connection')])
  .then(([mon,fix,layer,sync,hea])=>{
    const history=mon.status==='fulfilled'?(mon.value.history||[]):[];
    const latest=history[0];
    const f=fix.status==='fulfilled'?fix.value:{automatic:[],needsApproval:[],done:[],failed:[]};
    const l=layer.status==='fulfilled'?layer.value:null;
    const sy=sync.status==='fulfilled'?sync.value:null;
    const h=hea.status==='fulfilled'?hea.value:null;
    const healthCard=h?'<div class="card" style="margin-top:16px"><h3>Connection health</h3>'
      +'<p class="muted">'+esc(h.summary||'')+'</p>'
      +'<table class="table"><thead><tr><th>Check</th><th>State</th><th>What it means</th></tr></thead><tbody>'
      +(h.checks||[]).map(c=>'<tr><td>'+esc(c.label)+'</td>'
        +'<td><span class="dot '+(c.state==='ok'?'good':c.state==='broken'?'bad':'warn')+'"></span>'+esc(c.state)+'</td>'
        +'<td class="muted">'+esc(c.detail)+(c.state==='ok'?'':' '+esc(c.fix||''))+'</td></tr>').join('')
      +'</tbody></table></div>':'';
    const scoreCard=latest
      ? '<div class="metric"><span class="muted">Agent Ready score</span><b>'+num(latest.score)
        +(latest.delta!=null&&latest.delta!==0?'<span class="delta '+(latest.delta>0?'up':'down')+'" style="font-size:14px"> '+(latest.delta>0?'+':'\u2212')+Math.abs(latest.delta)+'</span>':'')+'</b>'
        +'<div class="muted" style="font-size:12px">'+esc(latest.grade||'')+'</div></div>'
      : '<div class="metric"><span class="muted">Agent Ready score</span><b>—</b><div class="muted" style="font-size:12px">Not scanned yet</div></div>';
    const reauth=sy&&sy.needsReauthorization
      ? '<div class="card" style="margin-top:16px;border-color:var(--warn)"><b>AgentCart needs another permission.</b><div class="muted">Reconnect your store to grant it, then run the fixes again.</div><div class="formRow"><a class="btn primary" href="/">Reconnect</a></div></div>' : '';
    set('overview','<div class="metrics">'+scoreCard
      +'<div class="metric"><span class="muted">Fixes we can apply</span><b>'+num(f.automatic.length)+'</b></div>'
      +'<div class="metric"><span class="muted">Awaiting your approval</span><b>'+num(f.needsApproval.length)+'</b></div>'
      +'<div class="metric"><span class="muted">AI layer</span><b>'+(l&&l.active?'Live':'Off')+'</b></div></div>'+reauth
      +'<div class="card" style="margin-top:16px"><h3>Readiness history</h3>'
      +(history.length?'<table class="table"><thead><tr><th>When</th><th>Score</th><th>Change</th><th>Checked</th></tr></thead><tbody>'
        +history.map(h=>'<tr><td>'+esc(String(new Date(Number(h.started_ms)).toISOString()).slice(0,16).replace("T"," "))+'</td><td>'+num(h.score)+'</td><td>'+(h.delta==null?'<span class="muted">—</span>':(h.delta>0?'+':'\u2212')+Math.abs(h.delta))+'</td><td class="muted">'+esc(h.trigger==='monitor'?'Automatic':'You')+'</td></tr>').join('')
        +'</tbody></table>':'<div class="empty">No readiness scans yet. Run one from the Agent Ready tab.</div>')+'</div>'
      +healthCard);
  });

  // ---- Agent Ready ----
  set('ready','<div class="card"><h3>Check your website</h3><p class="muted">Run a fresh Agent Ready assessment of your public website.</p>'
    +'<form class="formRow" action="/scan" method="get"><input class="input" name="url" placeholder="yourbusiness.com" required><button class="btn primary">Run a check</button></form></div>'
    +'<div class="card" style="margin-top:16px"><h3>Path to 100</h3><p class="muted">See every applicable point you can recover, who owns each fix and exactly how AgentReady will verify it.</p>'
    +'<button class="btn" id="buildPath100">Build my Path to 100</button><div id="path100Result" style="margin-top:14px"></div></div>');
  document.querySelector('#buildPath100').onclick=()=>{const button=document.querySelector('#buildPath100'),box=document.querySelector('#path100Result');button.disabled=true;box.innerHTML='<div class="muted">Scanning the connected public website and emerging standards…</div>';
    getJSON('/api/readiness/path-to-100',{method:'POST'}).then(r=>{const p=r.path||{},groups=p.grouped||{};
      const rows=(p.paths||[]).map(x=>'<div class="finding"><span class="dot warn"></span><div><b>'+esc(x.findingKey)+'</b><div class="muted" style="font-size:12px">'+esc((x.steps||[])[0]||'')+' · Verify: '+esc((x.verification||[])[0]||'')+'</div></div><div>+'+num(x.scoreRecoverable)+' · '+esc(x.mode)+'</div></div>').join('');
      box.innerHTML='<div class="metrics"><div class="metric"><span class="muted">Current</span><b>'+num(p.currentScore)+'</b></div><div class="metric"><span class="muted">Potential</span><b>'+num(p.potentialScore)+'</b></div><div class="metric"><span class="muted">Automatic</span><b>+'+num(groups.automatic)+'</b></div><div class="metric"><span class="muted">Needs people/platform</span><b>+'+num(Number(groups.approval_required||0)+Number(groups.guided||0)+Number(groups.manual||0)+Number(groups.developer_instructions||0))+'</b></div></div>'+(rows||'<div class="empty">Every applicable scored check currently passes.</div>');
    }).catch(e=>{box.textContent=e.message;}).finally(()=>{button.disabled=false;});};

  // ---- Fixes ----
  const shorten=v=>{const s=typeof v==='string'?v:JSON.stringify(v);return !s||s==='null'?'(empty)':s.length>160?s.slice(0,160)+'…':s;};
  // Shows what a change replaces and with what. Approving a change you cannot see is not approval.
  const preview=f=>{
    if(!f.after)return '';
    const keys=Object.keys(f.after);
    if(!keys.length)return '';
    return '<table class="table" style="margin-top:8px;font-size:13px"><tbody>'
      +keys.map(k=>'<tr><th>'+esc(k)+'</th><td><div class="muted">Now: '+esc(shorten((f.before||{})[k]))+'</div>'
        +'<div>After: '+esc(shorten(f.after[k]))+'</div></td></tr>').join('')
      +'</tbody></table>';
  };
  const fixRow=(f,actions)=>'<div class="fix"><span class="dot '+(f.status==='verified'?'good':f.status==='failed'?'bad':'warn')+'"></span>'
    +'<div><b>'+esc(f.summary||f.finding_key)+'</b><div class="muted" style="font-size:13px">'+esc(f.status||'')+(f.error?' — '+esc(f.error):'')+'</div>'
    +preview(f)+'</div>'
    +'<div>'+actions+'</div></div>';
  function loadFixes(){
    getJSON('/api/fixes').then(f=>{
      const section=(title,items,actions,empty)=>'<div class="card" style="margin-top:16px"><h3>'+title+'</h3>'
        +(items.length?items.map(i=>fixRow(i,actions(i))).join(''):'<div class="empty">'+empty+'</div>')+'</div>';
      set('fixes','<div class="card"><h3>What AgentCart can fix</h3><p class="muted">Nothing your customers can see is changed without your approval.</p>'
        +'<div class="formRow"><button class="btn" id="propose">Find fixes</button><button class="btn primary" id="applyauto">Apply safe fixes</button></div></div>'
        +section('Ready to apply',f.automatic,()=> '<span class="pill auto">Safe</span>','Nothing to apply. Try "Find fixes".')
        +section('Needs your approval',f.needsApproval,i=>'<button class="btn approve" data-id="'+esc(i.id)+'">Approve and apply</button>','Nothing is waiting on you.')
        +section('Done',f.done,i=>i.reversible?'<button class="btn undo" data-id="'+esc(i.id)+'">Undo</button>':'<span class="pill auto">Verified</span>','No fixes have been applied yet.')
        +(f.undone&&f.undone.length?section('Undone',f.undone,()=> '<span class="pill manual">Reverted</span>',''):'')
        +(f.failed.length?section('Could not be applied',f.failed,()=> '<span class="pill manual">Failed</span>',''):'')
        +(f.unavailable&&f.unavailable.length?section('Needs a reconnection',f.unavailable,
          ()=> '<a class="btn" href="/install">Reconnect</a>',''):''));
      document.querySelector('#propose').onclick=()=>{set('fixes','<div class="empty">Working out what can be fixed…</div>');
        getJSON('/api/fixes/propose',{method:'POST'}).then(loadFixes).catch(()=>loadFixes());};
      document.querySelector('#applyauto').onclick=()=>{set('fixes','<div class="empty">Applying…</div>');
        getJSON('/api/fixes/x/apply-automatic',{method:'POST'}).then(loadFixes).catch(()=>loadFixes());};
      document.querySelectorAll('.approve').forEach(b=>b.onclick=()=>{
        const id=b.dataset.id;
        getJSON('/api/fixes/'+encodeURIComponent(id)+'/approve',{method:'POST'})
          .then(()=>getJSON('/api/fixes/'+encodeURIComponent(id)+'/apply',{method:'POST'}))
          .then(loadFixes).catch(()=>loadFixes());});
      document.querySelectorAll('.undo').forEach(b=>b.onclick=()=>{
        const id=b.dataset.id;
        b.disabled=true;
        getJSON('/api/fixes/'+encodeURIComponent(id)+'/undo',{method:'POST'})
          .then(loadFixes)
          // An undo is refused when the value changed after AgentCart wrote it, so say why
          // rather than silently redrawing an unchanged row.
          .catch(e=>{alert(e&&e.message?e.message:'That change could not be undone.');loadFixes();});});
    }).catch(()=>signedOut('fixes','what can be fixed'));
  }
  loadFixes();

  // ---- AI layer ----
  getJSON('/api/ai-layer').then(l=>{
    set('layer','<div class="card"><h3>Your AI profile</h3>'
      +'<p class="muted">A clean, machine-readable description of your business that AI systems can read directly.</p>'
      +'<table class="table"><tbody>'
      +'<tr><th>Status</th><td>'+(l.active?'Live':'Switched off')+'</td></tr>'
      +'<tr><th>Public page</th><td><a href="'+esc(l.publicUrl)+'">'+esc(l.publicUrl)+'</a></td></tr>'
      +'<tr><th>JSON</th><td><code>'+esc(l.apiUrl)+'</code></td></tr>'
      +'<tr><th>MCP</th><td><code>'+esc(l.mcpUrl)+'</code></td></tr>'
      +'</tbody></table>'
      +'<div class="formRow"><a class="btn" href="'+esc(l.publicUrl)+'">See what AI is told</a>'
      +'<button class="btn" id="toggleLayer">'+(l.active?'Switch off':'Switch on')+'</button></div></div>');
    document.querySelector('#toggleLayer').onclick=()=>{
      fetch('/api/ai-layer',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
        body:JSON.stringify({active:!l.active})}).then(()=>location.reload());};
  }).catch(()=>signedOut('layer','your AI profile'));

  // ---- AI agents: which assistants can find you, reach you and act ----
  // Every state is shown as reported. "unknown" and "not available in your region" are first-class
  // outcomes here and are never rendered as a failure the merchant caused.
  const STATE={pass:['good','Yes'],fail:['bad','No'],unsupported:['warn','Not supported'],
    unknown:['warn','Unknown'],not_available_in_region:['warn','Not in your region']};
  const stateDot=v=>'<span class="dot '+((STATE[v]||['warn'])[0])+'"></span>';
  const stateLabel=v=>esc((STATE[v]||[null,String(v||'Unknown')])[1]);
  Promise.allSettled([getJSON('/api/providers'),getJSON('/api/protocols'),getJSON('/api/attribution'),getJSON('/api/agentpulse'),getJSON('/api/visibility'),getJSON('/api/algolia')])
  .then(([prov,proto,attr,pulse,visibility,algolia])=>{
    if(prov.status!=='fulfilled')return signedOut('agents','which AI assistants can reach you');
    const p=prov.value;
    const rows=(p.providers||[]).map(a=>'<tr><td><b>'+esc(a.label||a.provider)+'</b>'
      +'<div class="muted" style="font-size:12px">'+esc((a.protocols||[]).join(', ')||'—')+'</div></td>'
      +'<td>'+stateDot(a.discovery)+stateLabel(a.discovery)+'</td>'
      +'<td>'+stateDot(a.agenticFetch)+stateLabel(a.agenticFetch)+'</td>'
      +'<td>'+stateDot(a.region)+stateLabel(a.region)+'</td>'
      +'<td class="muted" style="font-size:12px">'+(a.notes||[]).map(n=>esc(n)).join('<br>')+'</td></tr>').join('');
    const protoRows=proto.status==='fulfilled'
      ? (proto.value.protocols||[]).map(x=>'<div class="finding"><span class="dot good"></span>'
        +'<div><b>'+esc(x.label||x.key)+'</b><div class="muted" style="font-size:13px">'+esc(x.summary||'')+'</div></div>'
        +'<div class="muted">Read</div></div>').join('')
      : '';
    const tierRows=attr.status==='fulfilled'
      ? (attr.value.tiers||[]).map(t=>'<tr><td><b>'+esc(t.label||t.tier)+'</b></td><td>'+num(t.orders)+'</td><td>'+money(t.revenue)+'</td></tr>').join('')
      : '';
    const rel=pulse.status==='fulfilled'?pulse.value.reliability:null;
    const success=rel&&rel.successRate!=null?(Number(rel.successRate)*100).toFixed(0)+'%':'—';
    const journeyRows=rel?(rel.journeys||[]).map(j=>'<tr><td>'+esc(String(j.journey||'').replaceAll('_',' '))+'</td><td>'+esc(j.status||'unknown')+'</td><td>'+(j.successRate==null?'—':(Number(j.successRate)*100).toFixed(0)+'%')+'</td></tr>').join(''):'';
    const pulseCard=rel?'<div class="card" style="margin-top:16px"><h3>Reliability · AgentPulse</h3>'
      +'<p class="muted">Safe synthetic journeys check discovery, live price and availability, policies, contact, booking, checkout handoff without purchase, and MCP.</p>'
      +'<div class="metrics"><div class="metric"><span class="muted">Task success</span><b>'+success+'</b></div>'
      +'<div class="metric"><span class="muted">p50 latency</span><b>'+(rel.p50Ms==null?'—':num(rel.p50Ms)+'ms')+'</b></div>'
      +'<div class="metric"><span class="muted">p95 latency</span><b>'+(rel.p95Ms==null?'—':num(rel.p95Ms)+'ms')+'</b></div>'
      +'<div class="metric"><span class="muted">Consecutive failures</span><b>'+num(rel.consecutiveFailures)+'</b></div></div>'
      +'<div class="finding"><span class="dot '+(rel.schemaDrift?'warn':'good')+'"></span><div><b>Tool schema drift</b>'
      +'<div class="muted" style="font-size:13px">'+(rel.schemaDrift?'The advertised tool schema changed since the previous run.':'No change detected in the latest two fingerprints.')+'</div></div><div></div></div>'
      +'<p class="muted" style="font-size:13px">'+esc(rel.note||'')+'</p>'
      +(journeyRows?'<table class="table"><thead><tr><th>Journey</th><th>Latest</th><th>Measured success</th></tr></thead><tbody>'+journeyRows+'</tbody></table>':'')
      +'<div class="formRow"><button class="btn" id="runpulse">Run reliability check</button></div></div>':'';
    const vis=visibility.status==='fulfilled'?visibility.value:null;
    const gaps=vis&&vis.whyLosing?(vis.whyLosing.gaps||[]):[];
    const visibilityCard=vis?'<div class="card" style="margin-top:16px"><h3>AI visibility and choice</h3>'
      +'<p class="muted">'+esc(vis.report.summary||'')+'</p>'
      +'<div class="metrics"><div class="metric"><span class="muted">Measured providers</span><b>'+num((vis.report.measuredProviders||[]).length)+'</b></div>'
      +'<div class="metric"><span class="muted">Intent queries</span><b>'+num((vis.queries||[]).length)+'</b></div>'
      +'<div class="metric"><span class="muted">Observable gaps</span><b>'+num(gaps.length)+'</b></div></div>'
      +(gaps.length?gaps.slice(0,5).map(g=>'<div class="finding"><span class="dot warn"></span><div><b>'+esc(g.gap)+'</b><div class="muted" style="font-size:13px">'+esc(g.fix)+' '+esc(g.explanation)+'</div></div><div>'+esc(g.competitor)+'</div></div>').join(''):'<div class="empty">No supported competitor gap is currently observable. Unsupported providers remain unmeasured.</div>')
      +'<p class="muted" style="font-size:13px">'+esc(vis.report.caveat||'')+'</p></div>':'';
    const al=algolia.status==='fulfilled'?algolia.value:null;
    const algoliaCard=al?'<div class="card" style="margin-top:16px"><h3>Algolia-aware checks</h3><p class="muted">'+esc(al.note||'')+'</p>'
      +'<div class="finding"><span class="dot '+(al.detected?'good':'warn')+'"></span><div><b>'+(al.detected?'Algolia detected':'Algolia not detected')+'</b><div class="muted" style="font-size:13px">Search '+esc(al.checks.search)+', facets '+esc(al.checks.facets)+', recommendations '+esc(al.checks.recommendations)+', analytics '+esc(al.checks.analytics)+'.</div></div><div></div></div></div>':'';
    set('agents','<div class="card"><h3>Which AI assistants can reach you</h3>'
      +'<p class="muted">'+esc(p.note||'')+'</p>'
      +(rows?'<table class="table"><thead><tr><th>Assistant</th><th>Can discover you</th><th>Can fetch pages</th><th>Available to you</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'
        :'<div class="empty">Run a readiness scan so AgentCart can read your robots.txt.</div>')
      +'<div class="muted" style="font-size:12px;margin-top:10px">Provider details verified on '+esc(p.registryVerifiedOn||'—')+'.</div></div>'
      +(protoRows?'<div class="card" style="margin-top:16px"><h3>Agent protocols</h3>'+protoRows
        +'<p class="muted" style="font-size:13px">'+esc(proto.value.note||'')+'</p></div>':'')
      +(tierRows?'<div class="card" style="margin-top:16px"><h3>Orders by strength of evidence</h3>'
        +'<table class="table"><thead><tr><th>Evidence</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>'+tierRows+'</tbody></table>'
        +'<p class="muted" style="font-size:13px">'+esc(attr.value.note||'')+'</p></div>':'')+pulseCard+visibilityCard+algoliaCard);
    const runpulse=document.querySelector('#runpulse');
    if(runpulse)runpulse.onclick=()=>{runpulse.disabled=true;runpulse.textContent='Checking…';
      getJSON('/api/agentpulse/run',{method:'POST'}).then(()=>location.reload()).catch(()=>location.reload());};
  });

  // ---- Business Brain + AI Sales Agent (Phases 18-21) ----
  Promise.allSettled([getJSON('/api/business-brain'),getJSON('/api/sales-agent')]).then(([brainRes,agentRes])=>{
    if(brainRes.status!=='fulfilled'||agentRes.status!=='fulfilled')return signedOut('sales','your Business Brain and AI salesperson');
    const b=brainRes.value,a=agentRes.value.agent||{},channels=agentRes.value.channels||[];
    const channelRows=channels.map(c=>'<div class="finding"><span class="dot '+(c.state==='active'||c.state==='ready_for_provider'?'good':c.state==='demo'?'warn':'bad')+'"></span>'
      +'<div><b>'+esc(c.label)+'</b><div class="muted" style="font-size:13px">'+esc((c.limitations||[]).join(' '))+'</div></div><div class="muted">'+esc(c.state)+'</div></div>').join('');
    set('sales','<div class="metrics"><div class="metric"><span class="muted">Agent status</span><b>'+esc(a.status||'draft')+'</b></div>'
      +'<div class="metric"><span class="muted">Verified facts</span><b>'+num(b.factCount)+'</b></div>'
      +'<div class="metric"><span class="muted">Catalogue items</span><b>'+num(b.itemCount)+'</b></div>'
      +'<div class="metric"><span class="muted">Config version</span><b>'+num(a.version||1)+'</b></div></div>'
      +'<div class="two"><div class="card"><h3>Talk to your AI salesperson</h3><p class="muted">Preview uses verified Business Brain facts and refuses unknown answers.</p>'
      +'<div class="formRow"><input id="salesQuestion" class="input" placeholder="Ask a customer question"><button id="askSales" class="btn primary">Ask</button></div><div id="salesReply" style="margin-top:14px"></div>'
      +'<div class="formRow"><button id="testSales" class="btn">Run regression tests</button><button id="toggleSales" class="btn">'+(a.status==='paused'?'Activate':'Pause')+'</button></div></div>'
      +'<div class="card"><h3>What it knows</h3><div class="finding"><span class="dot good"></span><div>Business identity and contact</div><div>verified</div></div>'
      +'<div class="finding"><span class="dot good"></span><div>Products, prices and availability</div><div>'+num(b.itemCount)+'</div></div>'
      +'<div class="finding"><span class="dot good"></span><div>Policies</div><div>'+num((b.policyKeys||[]).length)+'</div></div>'
      +'<div class="finding"><span class="dot warn"></span><div>Unknown claims</div><div>refused</div></div></div></div>'
      +'<div class="card" style="margin-top:16px"><h3>Distribution channels</h3>'+channelRows+'<p class="muted" style="font-size:13px">Ready means technically prepared. It never means provider-approved or live.</p></div>');
    document.querySelector('#askSales').onclick=()=>{const q=document.querySelector('#salesQuestion').value;if(!q)return;
      document.querySelector('#salesReply').innerHTML='<div class="muted">Checking verified facts…</div>';
      getJSON('/api/sales-agent/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:q})}).then(r=>{
        const x=r.reply||{};document.querySelector('#salesReply').innerHTML='<div class="bubble agent" style="max-width:100%">'+esc(x.text||'')+'</div><div class="muted" style="font-size:12px;margin-top:6px">Facts used: '+esc((x.factsUsed||[]).join(', ')||'none — escalated')+'</div>';}).catch(e=>{document.querySelector('#salesReply').textContent=e.message;});};
    document.querySelector('#testSales').onclick=()=>{document.querySelector('#testSales').disabled=true;getJSON('/api/sales-agent/test',{method:'POST'}).then(r=>alert(r.passed+' of '+r.total+' deterministic scenarios passed.')).finally(()=>{document.querySelector('#testSales').disabled=false;});};
    document.querySelector('#toggleSales').onclick=()=>getJSON('/api/sales-agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:a.status==='paused'?'active':'paused'})}).then(()=>location.reload());
  });

  // ---- Analytics Superset + Growth Engine (Phases 22-29) ----
  Promise.allSettled([getJSON('/api/analytics'),getJSON('/api/growth'),getJSON('/api/readiness/benchmark')]).then(([analyticsRes,growthRes,benchRes])=>{
    if(analyticsRes.status!=='fulfilled')return signedOut('analytics','AI visibility and growth analytics');
    const a=analyticsRes.value,g=growthRes.status==='fulfilled'?growthRes.value:{opportunities:[]},bench=benchRes.status==='fulfilled'?benchRes.value:null;
    const me=(a.visibility||[]).find(v=>!String(v.subject||'').toLowerCase().includes('competitor'))||(a.visibility||[])[0]||{};
    const gaps=(a.sourceGaps||[]).slice(0,6).map(x=>'<div class="finding"><span class="dot warn"></span><div><b>'+esc(x.domain)+'</b><div class="muted" style="font-size:12px">'+esc(x.action)+'</div></div><div>'+num(x.citations)+'</div></div>').join('');
    const actions=(a.actions||[]).slice(0,8).map(x=>'<div class="finding"><span class="dot '+(x.status==='verified'?'good':'warn')+'"></span><div><b>'+esc(x.title)+'</b><div class="muted" style="font-size:12px">Route: '+esc(x.route)+' · Owner: '+esc(x.owner)+'</div></div><div>'+esc(x.status)+'</div></div>').join('');
    const opps=(g.opportunities||[]).slice(0,8).map(x=>'<div class="finding"><span class="dot warn"></span><div><b>'+esc(x.query)+'</b><div class="muted" style="font-size:12px">'+esc(x.source)+' · '+esc(x.intent)+' · '+esc(x.current_coverage)+'</div></div><div>'+esc(x.status)+'</div></div>').join('');
    set('analytics','<div class="metrics"><div class="metric"><span class="muted">Visibility</span><b>'+((Number(me.visibility)||0)*100).toFixed(0)+'%</b></div>'
      +'<div class="metric"><span class="muted">Share of voice</span><b>'+((Number(me.shareOfVoice)||0)*100).toFixed(0)+'%</b></div>'
      +'<div class="metric"><span class="muted">Fanouts</span><b>'+num(a.fanouts&&a.fanouts.total)+'</b><span class="muted" style="font-size:12px"> observed and synthetic separate</span></div>'
      +'<div class="metric"><span class="muted">Benchmark blockers</span><b>'+num(bench&&bench.releaseBlockers)+'</b></div></div>'
      +'<div class="two"><div class="card"><h3>Query fanouts</h3><p class="muted">Repeated terms: '+esc(((a.fanouts&&a.fanouts.repeatedTerms)||[]).slice(0,8).map(x=>x.term).join(', ')||'No observations yet')+'</p>'
      +'<div class="formRow"><input id="fanoutPrompt" class="input" placeholder="Customer prompt"><button id="makeFanouts" class="btn">Plan fanouts</button></div><div id="fanoutResult" class="muted" style="margin-top:10px"></div></div>'
      +'<div class="card"><h3>Source gaps</h3>'+(gaps||'<div class="empty">No citation gaps recorded yet.</div>')+'</div></div>'
      +'<div class="two"><div class="card"><h3>Growth opportunities</h3>'+(opps||'<div class="empty">Add customer questions or fanouts to build the queue.</div>')+'</div>'
      +'<div class="card"><h3>Actions</h3>'+(actions||'<div class="empty">No analytics actions yet.</div>')+'</div></div>'
      +'<div class="card" style="margin-top:16px"><a class="btn" href="/api/analytics/export.csv">Export evidence CSV</a><p class="muted" style="font-size:12px">'+esc(a.caveat||'')+'</p></div>');
    document.querySelector('#makeFanouts').onclick=()=>{const prompt=document.querySelector('#fanoutPrompt').value;if(!prompt)return;
      getJSON('/api/analytics/fanouts/synthetic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt,createOpportunities:true})}).then(r=>{
        document.querySelector('#fanoutResult').textContent=(r.fanouts||[]).map(x=>x.query).join(' · ');});};
  });

  // ---- Market refresh (Phases 30-32) ----
  Promise.allSettled([getJSON('/api/commerce/readiness'),getJSON('/api/analytics/market'),getJSON('/api/security'),getJSON('/api/analytics/ga4')])
  .then(([commerceRes,marketRes,securityRes,gaRes])=>{
    if(commerceRes.status!=='fulfilled')return signedOut('commerce','commerce standards and agent security');
    const c=commerceRes.value,m=marketRes.status==='fulfilled'?marketRes.value:{},s=securityRes.status==='fulfilled'?securityRes.value:{assessments:[]},ga=gaRes.status==='fulfilled'?gaRes.value:{status:'not_connected'};
    const feed=c.openAiFeed&&c.openAiFeed.summary||{},ucp=c.ucp||{},latestSecurity=(s.assessments||[])[0]||{};
    const prominence=(m.prominence||[]).slice(0,5).map(x=>'<div class="finding"><span class="dot '+(x.stability==='measured'?'good':'warn')+'"></span><div><b>'+esc(x.subject)+'</b><div class="muted" style="font-size:12px">'+esc(x.stability)+' · '+num(x.sampleSize)+' answer(s)</div></div><div>'+((Number(x.prominence)||0)*100).toFixed(0)+'%</div></div>').join('');
    const attributes=((m.brandPerception&&m.brandPerception.associations)||[]).slice(0,5).map(x=>'<div class="finding"><span class="dot '+(x.stability==='measured'?'good':'warn')+'"></span><div><b>'+esc(x.brand)+' · '+esc(x.attribute)+'</b><div class="muted" style="font-size:12px">Corpus '+num(x.brandSample)+' · '+esc(x.stability)+'</div></div><div>'+((Number(x.association)||0)*100).toFixed(0)+'%</div></div>').join('');
    set('commerce','<div class="metrics"><div class="metric"><span class="muted">Native UCP</span><b>'+esc(ucp.status||'not checked')+'</b></div>'
      +'<div class="metric"><span class="muted">OpenAI feed ready</span><b>'+num(feed.eligible)+' / '+num(feed.total)+'</b></div>'
      +'<div class="metric"><span class="muted">GA4 evidence</span><b>'+esc(ga.status||'not connected')+'</b></div>'
      +'<div class="metric"><span class="muted">Action security</span><b>'+esc(latestSecurity.status||'not checked')+'</b></div></div>'
      +'<div class="two"><div class="card"><h3>Commerce standards</h3><p class="muted">UCP is observed per store. Feed readiness validates the nine core product fields but never uploads anything.</p>'
      +'<div class="formRow"><button id="probeUcp" class="btn">Check native UCP</button><a class="btn" href="/api/commerce/openai-feed.jsonl">Preview OpenAI feed</a></div><div id="ucpResult" class="muted" style="margin-top:10px"></div></div>'
      +'<div class="card"><h3>Authorised referrals</h3><p class="muted">GA4 sessions and revenue stay separate from signed journeys and verified orders, so revenue is never counted twice.</p>'
      +(ga.status==='connected'?'<div class="chip">Connected · property '+esc(ga.propertyId||'not selected')+'</div>':'<a class="btn" href="/api/analytics/ga4/connect">Connect GA4</a>')+'</div></div>'
      +'<div class="two"><div class="card"><h3>Answer prominence</h3>'+(prominence||'<div class="empty">Add answer evidence spans to measure honest prominence.</div>')+'</div>'
      +'<div class="card"><h3>Brand attributes</h3>'+(attributes||'<div class="empty">No corpus-backed attribute evidence yet.</div>')+'</div></div>'
      +'<div class="card" style="margin-top:16px"><h3>Action security</h3><p class="muted">Tool metadata and outputs are untrusted. Mutating tools need identity, narrow scope, approval, idempotency, rollback and verification evidence.</p>'
      +'<div class="muted" style="font-size:12px">Security is applicability-gated and does not punish a simple brochure site.</div></div>');
    document.querySelector('#probeUcp').onclick=()=>{document.querySelector('#probeUcp').disabled=true;getJSON('/api/commerce/ucp/probe',{method:'POST'}).then(r=>{
      document.querySelector('#ucpResult').textContent=r.status+' · version '+(r.version||'not declared')+' · '+(r.current?'current 2026-08-25':'not current');}).catch(e=>{document.querySelector('#ucpResult').textContent=e.message;}).finally(()=>{document.querySelector('#probeUcp').disabled=false;});};
  });

  // ---- Launch: the one authoritative answer, never softened by a green test suite ----
  const CHECK={done:['good','Done'],owner_action:['warn','Needs you'],blocked:['bad','Blocked'],
    not_started:['warn','Not started']};
  Promise.allSettled([getJSON('/api/launch/checklist'),getJSON('/api/launch'),getJSON('/api/outcome')])
  .then(([list,gate,out])=>{
    if(list.status!=='fulfilled')return signedOut('launch','whether AgentCart is ready to launch');
    const c=list.value,g=gate.status==='fulfilled'?gate.value:null,o=out.status==='fulfilled'?out.value:null;
    const items=(c.items||[]).map(i=>{const st=CHECK[i.state]||['warn',i.state];
      return '<div class="finding"><span class="dot '+st[0]+'"></span>'
        +'<div><b>'+esc(i.label)+'</b><div class="muted" style="font-size:13px">'+esc(i.detail)+'</div></div>'
        +'<div class="muted">'+esc(st[1])+(i.owner==='you'?' — you':'')+'</div></div>';}).join('');
    const owner=(c.ownerActions||[]).map(a=>'<li>'+esc(a)+'</li>').join('');
    const layers=o?'<div class="card" style="margin-top:16px"><h3>What AI is producing for you</h3>'
      +'<div class="metrics">'
      +'<div class="metric"><span class="muted">Readiness</span><b>'+(o.readiness.score==null?'—':num(o.readiness.score))+'</b></div>'
      +'<div class="metric"><span class="muted">AI visits</span><b>'+num(o.customers.visits)+'</b></div>'
      +'<div class="metric"><span class="muted">Verified AI revenue</span><b>'+money(o.northStar.verifiedRevenue)+'</b></div>'
      +'<div class="metric"><span class="muted">Reported only</span><b>'+money(o.northStar.reportedRevenue)+'</b></div></div>'
      +'<p class="muted" style="font-size:13px">'+esc(o.northStar.note)+'</p>'
      +'<p class="muted" style="font-size:13px">Outcome evidence events: '+num(o.proof&&o.proof.events?o.proof.events.reduce((n,e)=>n+Number(e.count||0),0):0)+'. '+esc(o.proof&&o.proof.note||'')+'</p>'
      +'<p class="muted" style="font-size:13px">'+esc(o.note)+'</p></div>':'';
    set('launch','<div class="card"><h3>'+esc(c.headline)+'</h3>'
      +'<p class="muted">'+esc(c.hardRule)+'</p>'
      +(g?'<div class="muted" style="font-size:13px">'+esc(g.summary)+'</div>':'')
      +'<div class="formRow"><button class="btn" id="rungate">Run the launch gate</button></div>'
      +'<div class="muted" style="font-size:12px">The gate checks real infrastructure. It cannot be satisfied by tests or mocks.</div></div>'
      +'<div class="card" style="margin-top:16px"><h3>Checklist</h3>'+items+'</div>'
      +(owner?'<div class="card" style="margin-top:16px"><h3>What only you can do</h3><ul>'+owner+'</ul></div>':'')
      +layers);
    document.querySelector('#rungate').onclick=()=>{
      set('launch','<div class="empty">Running the launch gate against real infrastructure…</div>');
      getJSON('/api/launch/run',{method:'POST'}).then(()=>location.reload()).catch(()=>location.reload());};
  });
}
</script>`);
}

export function agentReadyPage(report:AgentReadyReport&{readiness?:ReadinessLayers},comparison?:{delta:number|null;comparable:boolean;previous:{score:number}|null}|null){
  return layout(`Agent Ready: ${report.domain}`,reportBody(report,comparison));
}

export function aiProfilePage(profile:any,slug:string){
  const b=profile.business||{};
  const items=(profile.catalogSample||[]) as Array<any>;
  const actions=(profile.actions||[]) as Array<any>;
  const policies=(profile.policies||[]) as Array<any>;
  const money=(p:any)=>p&&p.min!=null?`${esc(p.currency||"")} ${p.min}${p.max&&p.max!==p.min?` – ${p.max}`:""}`.trim():"—";
  return layout(`AI profile: ${b.name||slug}`,`<main><div class="wrap section">
    <div class="card">
      <div class="eyebrow">AgentCart AI profile</div>
      <h1 style="margin:6px 0">${esc(b.name||slug)}</h1>
      <p class="muted">This is exactly what AgentCart tells AI assistants about this business. Nothing else is shared.</p>
      <div class="formRow"><a class="btn" href="/api/ai/${esc(slug)}/profile">View as JSON</a></div>
    </div>

    <div class="two" style="margin-top:16px">
      <div class="card"><h3>Business</h3>
        <p class="muted">${esc(b.description||"No description has been published.")}</p>
        <table class="table"><tbody>
          <tr><th>Website</th><td>${esc(b.website||"—")}</td></tr>
          <tr><th>Email</th><td>${esc(b.contact?.email||"—")}</td></tr>
          <tr><th>Phone</th><td>${esc(b.contact?.phone||"—")}</td></tr>
          <tr><th>Location</th><td>${esc([b.location?.city,b.location?.region,b.location?.country].filter(Boolean).join(", ")||"—")}</td></tr>
          <tr><th>Currency</th><td>${esc(b.currency||"—")}</td></tr>
          <tr><th>Last updated</th><td>${esc(String(b.lastUpdated||"").slice(0,16).replace("T"," "))}</td></tr>
        </tbody></table>
      </div>
      <div class="card"><h3>What an assistant can do</h3>
        ${actions.map(a=>`<div class="finding"><span class="dot ${a.supported?"good":"bad"}"></span>
          <div><b>${esc(a.description)}</b>
            ${a.limitations?`<div class="muted" style="font-size:13px">${esc(a.limitations)}</div>`:""}
            <div class="muted" style="font-size:12px">Source: ${esc(a.source)}</div></div>
          <div class="muted">${a.supported?"Yes":"No"}</div></div>`).join("")}
      </div>
    </div>

    <div class="card" style="margin-top:16px"><h3>Catalogue${items.length?` (first ${items.length})`:""}</h3>
      ${items.length?`<table class="table"><thead><tr><th>Product</th><th>Price</th><th>In stock</th></tr></thead><tbody>
        ${items.map(i=>`<tr><td><b>${esc(i.title)}</b><div class="muted" style="font-size:12px">${esc(i.category||"")}</div></td>
          <td>${esc(money(i.price))}</td><td class="muted">${i.available?"Yes":"No"}</td></tr>`).join("")}
      </tbody></table>`:`<div class="empty">No catalogue has been synced yet.</div>`}
    </div>

    ${policies.length?`<div class="card" style="margin-top:16px"><h3>Policies</h3>
      ${policies.map(p=>`<div class="finding"><span class="dot good"></span><div><b>${esc(p.title)}</b>
        <div class="muted">${esc(String(p.summary||"").slice(0,400))}</div></div><div></div></div>`).join("")}
    </div>`:""}

    <div class="card" style="margin-top:16px"><h3>For developers and AI systems</h3>
      <table class="table"><tbody>
        <tr><th>Profile</th><td><code>/api/ai/${esc(slug)}/profile</code></td></tr>
        <tr><th>Catalogue</th><td><code>/api/ai/${esc(slug)}/catalog</code></td></tr>
        <tr><th>Item</th><td><code>/api/ai/${esc(slug)}/items/&lt;id or handle&gt;</code></td></tr>
        <tr><th>Search</th><td><code>/api/ai/${esc(slug)}/search?q=</code></td></tr>
        <tr><th>Policies</th><td><code>/api/ai/${esc(slug)}/policies</code></td></tr>
        <tr><th>Actions</th><td><code>/api/ai/${esc(slug)}/actions</code></td></tr>
        <tr><th>MCP (read-only)</th><td><code>POST /api/ai/${esc(slug)}/mcp</code></td></tr>
      </tbody></table>
    </div>
  </div></main>`);
}


export function sponsoredAgentDemoPage(){
  return layout("Sponsored Agent demo",`<main><div class="wrap">
    <section class="hero" style="padding-bottom:30px"><div>
      <div class="eyebrow">Concept demo · not a live provider integration</div>
      <h1 style="font-size:clamp(42px,6vw,68px)">Your business could have its own AI salesperson.</h1>
      <p>A Sponsored Agent is a conversational representative for a business inside an AI advertising experience. Instead of an advert ending at a click, the customer can ask questions, explore products or services, understand policies and move toward a real business action.</p>
      <div class="formRow"><a class="btn primary" href="#demo-chat">Try the demo conversation</a><a class="btn" href="/#scanner">Check your business</a></div>
      <p class="muted" style="font-size:13px">This page demonstrates the AgentReady product concept. It does not create, activate or claim access to a live OpenAI Sponsored Agent.</p>
    </div>
    <div class="heroCard">
      <span class="chip">Demo → Ready → Live</span>
      <div class="stageRow">
        <div class="stage"><strong>1 · DEMO</strong><span class="muted">Experience the conversation and test the sales journey now.</span></div>
        <div class="stage"><strong>2 · READY</strong><span class="muted">Prepare business facts, actions, safety checks and measurement.</span></div>
        <div class="stage live"><strong>3 · LIVE</strong><span class="muted">Connect the real provider channel only when that merchant has supported access.</span></div>
      </div>
    </div></section>

    <section id="demo-chat" class="section" style="padding-top:24px">
      <div class="demoShell">
        <div>
          <div class="card">
            <div class="eyebrow">Why a business would want this</div>
            <h2 style="font-size:30px">Turn an advert into a conversation.</h2>
            <p class="muted">A normal advert has to guess what the customer wants to know. A business agent can answer the next question, use current business information and guide the customer to the right product, quote, booking or checkout handoff.</p>
            <div class="featureGrid">
              <div class="feature"><b>Answer real questions</b><div class="muted">Products, services, compatibility, policies and delivery.</div></div>
              <div class="feature"><b>Use live business facts</b><div class="muted">Price and availability where an authorised source exposes them.</div></div>
              <div class="feature"><b>Take the next step</b><div class="muted">Quote, contact, booking, cart, checkout or human handoff.</div></div>
              <div class="feature"><b>Stay on brand</b><div class="muted">Merchant-approved identity, tone, scope and escalation rules.</div></div>
              <div class="feature"><b>Test before customers see it</b><div class="muted">Run buyer scenarios and catch wrong answers or broken actions.</div></div>
              <div class="feature"><b>Measure outcomes</b><div class="muted">Link signed handoffs to leads, bookings and orders where evidence exists.</div></div>
            </div>
          </div>
        </div>

        <div class="demoChat" aria-label="Simulated Sponsored Agent conversation">
          <div class="demoChatHead">
            <div><b>Northstar Outdoors</b><div class="muted" style="font-size:12px">AI sales agent · simulated</div></div>
            <span class="status">DEMO MODE</span>
          </div>
          <div class="demoMsgs" id="sponsoredDemoMessages" aria-live="polite">
            <div class="bubble agent"><b>Northstar AI</b><br>Hi — tell me what you need and I can help you find the right outdoor gear using Northstar's catalogue, prices and policies.</div>
          </div>
          <div class="demoPrompts">
            <button class="demoPrompt" type="button" data-demo="shoes">Waterproof shoes under £150</button>
            <button class="demoPrompt" type="button" data-demo="friday">Can I get them by Friday?</button>
            <button class="demoPrompt" type="button" data-demo="returns">What if they don't fit?</button>
            <button class="demoPrompt" type="button" data-demo="checkout">Take me to checkout</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section"><div class="grid3">
      <div class="card"><span class="chip">WHAT AGENTREADY BUILDS</span><h3>The intelligence underneath</h3><p class="muted">Verified business facts, product/service knowledge, allowed actions, escalation rules, testing, monitoring and attribution. The provider channel should be an adapter over that foundation.</p></div>
      <div class="card"><span class="chip">WHAT WE CAN DEMO</span><h3>The customer experience</h3><p class="muted">Conversation, product discovery, policy questions, safe handoffs, failure handling and measurement can be demonstrated before a provider grants live channel access.</p></div>
      <div class="card"><span class="chip">WHAT WE WAIT FOR</span><h3>Provider activation</h3><p class="muted">If a native Sponsored Agent programme is invite-only, region-limited or not generally available, AgentReady marks it as waiting on the provider rather than pretending it is live.</p></div>
    </div></section>

    <section class="section"><div class="card">
      <div class="eyebrow">What happens when access opens</div>
      <h2>We should not have to rebuild the agent.</h2>
      <p class="muted">AgentReady's goal is to prepare one tested business agent and then package it for supported channels. When a legitimate provider integration becomes available, the live adapter should reuse the same approved business facts, actions, tests and outcome measurement that were already proven in demo/readiness mode.</p>
      <div class="finding"><span class="dot good"></span><div><b>Business Brain ready</b><div class="muted">Products, services, policies, locations and approved facts.</div></div><div>AgentReady</div></div>
      <div class="finding"><span class="dot good"></span><div><b>Sales behaviour tested</b><div class="muted">Buyer questions, factual accuracy, handoffs and failure scenarios.</div></div><div>AgentReady</div></div>
      <div class="finding"><span class="dot good"></span><div><b>Measurement prepared</b><div class="muted">Signed journeys and downstream outcome evidence where supported.</div></div><div>AgentReady</div></div>
      <div class="finding"><span class="dot warn"></span><div><b>Native provider activation</b><div class="muted">Only becomes Live when the external provider offers a legitimate supported path for that merchant.</div></div><div>Provider</div></div>
    </div></section>
  </div></main>
  <script>
  (()=> {
    const box=document.querySelector('#sponsoredDemoMessages');
    if(!box)return;
    const replies={
      shoes:{q:'I need waterproof shoes under £150.',a:'The Trail Runner GTX is £129 and is listed as in stock in this demo catalogue. It is waterproof and designed for mixed trail use. Would you like delivery information or the product page?'},
      friday:{q:'Can I get them by Friday?',a:'I can only promise delivery if the business has verified delivery information for your location. In this demo, I would ask for your delivery area, check the merchant\'s current delivery rules, and avoid inventing a date.'},
      returns:{q:'What if they don\'t fit?',a:'Northstar\'s demo returns policy allows unworn footwear to be returned within 30 days. A live AgentReady agent would answer from the merchant\'s approved policy source and show the relevant policy link.'},
      checkout:{q:'Take me to checkout.',a:'I can hand you to Northstar\'s real checkout, but I do not pretend the Sponsored Agent itself has completed a purchase. In a live setup, AgentReady would create a signed handoff so the resulting order can be attributed when the merchant platform provides evidence.'}
    };
    document.querySelectorAll('.demoPrompt').forEach(btn=>btn.addEventListener('click',()=>{
      const r=replies[btn.dataset.demo];if(!r)return;
      box.insertAdjacentHTML('beforeend','<div class="bubble user">'+r.q+'</div><div class="bubble agent"><b>Northstar AI</b><br>'+r.a+'</div>');
      box.scrollTop=box.scrollHeight;
    }));
  })();
  </script>`);
}

export function errorPage(title:string,message:string,ctaHref="/",ctaLabel="Back to AgentCart"){
  return layout(title,`<main><div class="wrap legal"><h1>${esc(title)}</h1><p>${esc(message)}</p><div class="formRow"><a class="btn primary" href="${esc(ctaHref)}">${esc(ctaLabel)}</a></div></div></main>`);
}

export function setupPage(){return layout("Setup",`<main><div class="wrap legal"><div class="eyebrow">Owner setup</div><h1>Finish connecting AgentCart</h1><p>The application code is ready. Production requires account-level values that cannot safely be invented or created on your behalf without the relevant service access.</p><ol><li>Create a Cloudflare D1 database called <b>agentcart</b> and put its ID into <code>wrangler.toml</code>.</li><li>Create/configure the Shopify app, deploy the Web Pixel extension, and copy the Shopify client ID/secret into Cloudflare Worker secrets.</li><li>Set <code>TOKEN_ENCRYPTION_KEY</code> to a long random secret.</li><li>Change <code>APP_URL</code> to the deployed HTTPS Worker URL and run the remote D1 migration.</li><li>Install AgentCart on a Shopify development store, then verify events appear in the dashboard.</li></ol><p>Every command and field is documented in <a href="https://github.com/simplebusiness26/agentCart/blob/main/docs/SETUP.md">docs/SETUP.md</a>.</p></div></main>`);}
export function privacyPage(){return layout("Privacy",`<main><div class="wrap legal"><h1>Privacy Policy</h1><p>AgentCart is designed to process commerce analytics events for stores that install the service. We minimize collected fields to attribution and funnel measurement data and honor the consent behavior of Shopify Web Pixels.</p><h2>Data processed</h2><p>Depending on the event, AgentCart may process store domain, event identifiers, referral source, page/product identifiers, checkout/order identifiers, transaction value and currency. AgentCart does not intentionally collect payment card details.</p><h2>Merchant controls</h2><p>AgentCart handles all three of the mandatory Shopify privacy webhooks. On <b>app uninstall</b> or <b>shop redaction</b> the store record, its events and any pending install state are deleted. On <b>customer redaction</b> the identified orders and the browsing sessions linked to them are deleted. A <b>customer data request</b> is recorded with the number of matching records so the merchant can be supplied with them; AgentCart holds no customer name, email, phone, address or payment data to return.</p><p>One limitation stated plainly: anonymous readiness scans are stored against the scanned website address rather than a store account, so they can only be matched to a merchant when the address is the same.</p><p>Production merchants should publish their own applicable notices and ensure lawful analytics configuration for their region.</p><h2>Contact</h2><p>Before public launch, replace this section with the business support/privacy contact used for the Shopify listing.</p></div></main>`);}
export function termsPage(){return layout("Terms",`<main><div class="wrap legal"><h1>Terms of Service</h1><p>AgentCart provides analytics and technical readiness information. Scores and attribution are best-effort measurements and are not guarantees of ranking, recommendation, traffic, revenue, or support by any particular AI service.</p><h2>Acceptable use</h2><p>Users must only connect stores they are authorized to administer and must comply with applicable commerce, privacy and platform rules.</p><h2>Beta status</h2><p>Until a public commercial release is declared, AgentCart should be treated as beta software and tested on development stores before production use.</p></div></main>`);}
