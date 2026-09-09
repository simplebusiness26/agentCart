import type { AgentReadyReport } from "./agentready/types";
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
@media(max-width:780px){.hero{grid-template-columns:1fr;padding-top:42px}.hero h1{letter-spacing:-2.5px}.grid3,.metrics,.two{grid-template-columns:1fr}.navlinks a:not(.keep){display:none}.formRow{flex-direction:column}.dashHead{align-items:flex-start;gap:14px;flex-direction:column}.footerin{flex-direction:column}.metric b{font-size:25px}.cando{grid-template-columns:1fr}}
`;

function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));}
function layout(title:string,body:string){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="AgentCart checks whether AI assistants can understand your business, helps you fix what is in the way, and shows whether AI is sending you customers."><title>${esc(title)} · AgentCart</title><style>${css}</style></head><body><div class="wrap"><nav class="nav"><a class="brand" href="/">Agent<span>Cart</span></a><div class="navlinks"><a href="/#scanner">Free check</a><a href="/dashboard?demo=1">Demo</a><a class="keep" href="/setup">Setup</a></div></nav></div>${body}<footer class="footer"><div class="wrap footerin"><div>© ${new Date().getFullYear()} AgentCart · AI commerce attribution & readiness.</div><div><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></div></div></footer></body></html>`;}

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
  </div>
  <div id="panel-overview" class="panel"><div class="empty">Loading…</div></div>
  <div id="panel-ready" class="panel" hidden><div class="empty">Loading…</div></div>
  <div id="panel-fixes" class="panel" hidden><div class="empty">Loading…</div></div>
  <div id="panel-layer" class="panel" hidden><div class="empty">Loading…</div></div>
  <div id="panel-traffic" class="panel" hidden><div class="empty">Loading commerce signals…</div></div>
  </div></main><script>
const demo=${demo?"true":"false"};
let CUR='USD';
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:CUR,maximumFractionDigits:0}).format(Number(n||0));
const num=n=>new Intl.NumberFormat('en-GB').format(Number(n||0));
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const delta=(cur,prev)=>{const c=Number(cur||0),p=Number(prev||0);if(!p)return '';const d=(c-p)/p*100;return '<span class="muted" style="font-size:13px"> '+(d>=0?'+':'\u2212')+Math.abs(d).toFixed(1)+'%</span>';};
const set=(id,html)=>{document.querySelector('#panel-'+id).innerHTML=html;};
const getJSON=(u,o)=>fetch(u,Object.assign({credentials:'same-origin'},o||{})).then(r=>r.ok?r.json():Promise.reject(r.status));

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
  ['overview','ready','fixes','layer'].forEach(id=>set(id,soon));
}else{
  // ---- Overview ----
  Promise.allSettled([getJSON('/api/monitoring'),getJSON('/api/fixes'),getJSON('/api/ai-layer'),getJSON('/api/sync/status')])
  .then(([mon,fix,layer,sync])=>{
    const history=mon.status==='fulfilled'?(mon.value.history||[]):[];
    const latest=history[0];
    const f=fix.status==='fulfilled'?fix.value:{automatic:[],needsApproval:[],done:[],failed:[]};
    const l=layer.status==='fulfilled'?layer.value:null;
    const sy=sync.status==='fulfilled'?sync.value:null;
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
        +'</tbody></table>':'<div class="empty">No readiness scans yet. Run one from the Agent Ready tab.</div>')+'</div>');
  });

  // ---- Agent Ready ----
  set('ready','<div class="card"><h3>Check your website</h3><p class="muted">Run a fresh Agent Ready assessment of your public website.</p>'
    +'<form class="formRow" action="/scan" method="get"><input class="input" name="url" placeholder="yourbusiness.com" required><button class="btn primary">Run a check</button></form></div>');

  // ---- Fixes ----
  const fixRow=(f,actions)=>'<div class="fix"><span class="dot '+(f.status==='verified'?'good':f.status==='failed'?'bad':'warn')+'"></span>'
    +'<div><b>'+esc(f.summary||f.finding_key)+'</b><div class="muted" style="font-size:13px">'+esc(f.status)+(f.error?' — '+esc(f.error):'')+'</div></div>'
    +'<div>'+actions+'</div></div>';
  function loadFixes(){
    getJSON('/api/fixes').then(f=>{
      const section=(title,items,actions,empty)=>'<div class="card" style="margin-top:16px"><h3>'+title+'</h3>'
        +(items.length?items.map(i=>fixRow(i,actions(i))).join(''):'<div class="empty">'+empty+'</div>')+'</div>';
      set('fixes','<div class="card"><h3>What AgentCart can fix</h3><p class="muted">Nothing your customers can see is changed without your approval.</p>'
        +'<div class="formRow"><button class="btn" id="propose">Find fixes</button><button class="btn primary" id="applyauto">Apply safe fixes</button></div></div>'
        +section('Ready to apply',f.automatic,()=> '<span class="pill auto">Safe</span>','Nothing to apply. Try "Find fixes".')
        +section('Needs your approval',f.needsApproval,i=>'<button class="btn approve" data-id="'+esc(i.id)+'">Approve and apply</button>','Nothing is waiting on you.')
        +section('Done',f.done,()=> '<span class="pill auto">Verified</span>','No fixes have been applied yet.')
        +(f.failed.length?section('Could not be applied',f.failed,()=> '<span class="pill manual">Failed</span>',''):''));
      document.querySelector('#propose').onclick=()=>{set('fixes','<div class="empty">Working out what can be fixed…</div>');
        getJSON('/api/fixes/propose',{method:'POST'}).then(loadFixes).catch(()=>loadFixes());};
      document.querySelector('#applyauto').onclick=()=>{set('fixes','<div class="empty">Applying…</div>');
        getJSON('/api/fixes/x/apply-automatic',{method:'POST'}).then(loadFixes).catch(()=>loadFixes());};
      document.querySelectorAll('.approve').forEach(b=>b.onclick=()=>{
        const id=b.dataset.id;
        getJSON('/api/fixes/'+encodeURIComponent(id)+'/approve',{method:'POST'})
          .then(()=>getJSON('/api/fixes/'+encodeURIComponent(id)+'/apply',{method:'POST'}))
          .then(loadFixes).catch(()=>loadFixes());});
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
}
</script>`);
}

export function agentReadyPage(report:AgentReadyReport,comparison?:{delta:number|null;comparable:boolean;previous:{score:number}|null}|null){
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

export function errorPage(title:string,message:string,ctaHref="/",ctaLabel="Back to AgentCart"){
  return layout(title,`<main><div class="wrap legal"><h1>${esc(title)}</h1><p>${esc(message)}</p><div class="formRow"><a class="btn primary" href="${esc(ctaHref)}">${esc(ctaLabel)}</a></div></div></main>`);
}

export function setupPage(){return layout("Setup",`<main><div class="wrap legal"><div class="eyebrow">Owner setup</div><h1>Finish connecting AgentCart</h1><p>The application code is ready. Production requires account-level values that cannot safely be invented or created on your behalf without the relevant service access.</p><ol><li>Create a Cloudflare D1 database called <b>agentcart</b> and put its ID into <code>wrangler.toml</code>.</li><li>Create/configure the Shopify app, deploy the Web Pixel extension, and copy the Shopify client ID/secret into Cloudflare Worker secrets.</li><li>Set <code>TOKEN_ENCRYPTION_KEY</code> to a long random secret.</li><li>Change <code>APP_URL</code> to the deployed HTTPS Worker URL and run the remote D1 migration.</li><li>Install AgentCart on a Shopify development store, then verify events appear in the dashboard.</li></ol><p>Every command and field is documented in <a href="https://github.com/simplebusiness26/agentCart/blob/main/docs/SETUP.md">docs/SETUP.md</a>.</p></div></main>`);}
export function privacyPage(){return layout("Privacy",`<main><div class="wrap legal"><h1>Privacy Policy</h1><p>AgentCart is designed to process commerce analytics events for stores that install the service. We minimize collected fields to attribution and funnel measurement data and honor the consent behavior of Shopify Web Pixels.</p><h2>Data processed</h2><p>Depending on the event, AgentCart may process store domain, event identifiers, referral source, page/product identifiers, checkout/order identifiers, transaction value and currency. AgentCart does not intentionally collect payment card details.</p><h2>Merchant controls</h2><p>AgentCart handles all three of the mandatory Shopify privacy webhooks. On <b>app uninstall</b> or <b>shop redaction</b> the store record, its events and any pending install state are deleted. On <b>customer redaction</b> the identified orders and the browsing sessions linked to them are deleted. A <b>customer data request</b> is recorded with the number of matching records so the merchant can be supplied with them; AgentCart holds no customer name, email, phone, address or payment data to return.</p><p>One limitation stated plainly: anonymous readiness scans are stored against the scanned website address rather than a store account, so they can only be matched to a merchant when the address is the same.</p><p>Production merchants should publish their own applicable notices and ensure lawful analytics configuration for their region.</p><h2>Contact</h2><p>Before public launch, replace this section with the business support/privacy contact used for the Shopify listing.</p></div></main>`);}
export function termsPage(){return layout("Terms",`<main><div class="wrap legal"><h1>Terms of Service</h1><p>AgentCart provides analytics and technical readiness information. Scores and attribution are best-effort measurements and are not guarantees of ranking, recommendation, traffic, revenue, or support by any particular AI service.</p><h2>Acceptable use</h2><p>Users must only connect stores they are authorized to administer and must comply with applicable commerce, privacy and platform rules.</p><h2>Beta status</h2><p>Until a public commercial release is declared, AgentCart should be treated as beta software and tested on development stores before production use.</p></div></main>`);}
