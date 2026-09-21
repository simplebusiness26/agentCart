/* AgentReady WebMCP adapter 2026-09-21.1
 * Registers only server-declared tools. The bridge endpoint remains the source of truth and
 * consequential tools must enforce authentication and approval server-side.
 */
(function(){
  'use strict';
  const API_VERSION='2026-09-21.1';
  function modelContext(){return document.modelContext&&typeof document.modelContext.registerTool==='function'?document.modelContext:null;}
  function safeTool(tool){
    return tool&&typeof tool.name==='string'&&/^[a-z][a-z0-9_]{1,63}$/.test(tool.name)&&
      tool.inputSchema&&tool.inputSchema.type==='object'&&tool.annotations&&typeof tool.annotations.readOnlyHint==='boolean';
  }
  async function invoke(endpoint,name,input){
    const res=await fetch(endpoint,{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json','x-agentready-webmcp-version':API_VERSION},body:JSON.stringify({name,input})});
    if(!res.ok)throw new Error('AgentReady WebMCP bridge returned HTTP '+res.status);
    return res.json();
  }
  window.AgentReadyWebMCP={version:API_VERSION,register:function(config){
    const context=modelContext();if(!context)return {supported:false,registered:[]};
    if(!config||!/^https:\/\//.test(config.endpoint||''))throw new Error('An HTTPS same-merchant bridge endpoint is required.');
    const endpoint=new URL(config.endpoint,location.href);if(endpoint.origin!==location.origin)throw new Error('The generic bridge must use the current site origin.');
    const registered=[];
    (config.tools||[]).filter(safeTool).forEach(function(tool){
      context.registerTool({name:tool.name,description:String(tool.description||''),inputSchema:tool.inputSchema,
        annotations:tool.annotations,execute:function(input){return invoke(endpoint.href,tool.name,input);}});
      registered.push(tool.name);
    });
    return {supported:true,registered:registered,version:API_VERSION};
  }};
})();
