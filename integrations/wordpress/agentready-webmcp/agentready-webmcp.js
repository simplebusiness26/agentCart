/* Same-origin WordPress runtime adapter. Kept versioned so browser API changes are isolated. */
(function(){'use strict';const version='2026-09-21.1';window.AgentReadyWebMCP={version,register(config){
  const api=document.modelContext;if(!api||typeof api.registerTool!=='function')return {supported:false,registered:[]};
  const endpoint=new URL(config.endpoint,location.href);if(endpoint.origin!==location.origin)throw new Error('Same-origin bridge required.');
  const registered=[];(config.tools||[]).filter(t=>t&&t.annotations&&t.annotations.readOnlyHint===true).forEach(tool=>{
    api.registerTool({name:tool.name,description:tool.description,inputSchema:tool.inputSchema,annotations:tool.annotations,execute:async input=>{
      const r=await fetch(endpoint.href,{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json','x-agentready-webmcp-version':version},body:JSON.stringify({name:tool.name,input})});
      if(!r.ok)throw new Error('Bridge HTTP '+r.status);return r.json();}});registered.push(tool.name);});
  return {supported:true,registered,version};
}};})();
