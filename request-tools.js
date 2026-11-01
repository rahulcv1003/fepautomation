(function () {
  "use strict";
  const KEY = "fep-request-templates-v1", PROMO = "fep-crumble-promo-v1";
  const CRUMBLE = "https://chromewebstore.google.com/detail/crumble-auto-delete-cooki/lecjahllepkiamfeaiaibikpobbdddnk?authuser=0&hl=en";
  const defaults = {...FepRequestDefaults};
  const payment = FepPaymentTools.core.sample();
  payment.proposal_id = "{{projectId}}";
  payment.Invoice_ID = "FE/{{fiscalYear}}/{{projectId}}";
  payment.details.invoice_amount = payment.details.paid_amount = "{{amount}}";
  payment.details.invoice_date = "{{today}}";
  defaults.advance = {title:"Advance Payment", payload:payment};
  const clone = value => JSON.parse(JSON.stringify(value));
  const storage = () => chrome.storage.local;
  let workspace = null, requestInFlight = false;
  function configure(options) { workspace = options; }
  function prepare(key,record,context) {
    const payload=substitute(bindProject(key,check(clone(record.payload))),context);
    if(key === "advance") FepPaymentTools.core.validate(payload);
    else if(typeof payload.query !== "string" || !payload.query.trim()) throw new Error("The request needs a GraphQL query.");
    return {payload,headers:clone(record.headers || {})};
  }
  function check(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Enter a JSON object.");
    const walk = value => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsupported field name.");
        walk(child);
      }
    };
    walk(payload);
    if (JSON.stringify(payload).length > 100000) throw new Error("The request is too large.");
    return payload;
  }
  function bindProject(key, payload) {
    if (key === "advance") {
      payload.proposal_id = "{{projectId}}";
      if (typeof payload.Invoice_ID === "string") payload.Invoice_ID = payload.Invoice_ID.replace(/[^/]+$/, "{{projectId}}");
    } else if (key === "survey") {
      if (!payload.variables) throw new Error("The survey request needs variables.");
      payload.variables.project = "{{projectId}}";
    } else {
      if (!payload.variables?.input) throw new Error("The installation request needs variables.input.");
      payload.variables.input.project = "{{projectId}}";
      if (key === "qc") {
        if (!payload.variables.input.projectDetails) throw new Error("The QC request needs projectDetails.");
        payload.variables.input.projectDetails.projectId = "{{uniqueId}}";
      } else if (payload.variables.input.projectDetails) payload.variables.input.projectDetails.uniqueId = "{{uniqueId}}";
    }
    return payload;
  }
  function substitute(value, context) {
    if (typeof value === "string") {
      const exact = value.match(/^\{\{(\w+)\}\}$/);
      const get = key => {
        if (!Object.hasOwn(context,key) || context[key] === null || context[key] === undefined || context[key] === "") throw new Error(`Could not find ${key} on this page.`);
        return context[key];
      };
      if (exact) return get(exact[1]);
      return value.replace(/\{\{(\w+)\}\}/g, (_, key) => String(get(key)));
    }
    if (Array.isArray(value)) return value.map(child => substitute(child,context));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,child]) => [key,substitute(child,context)]));
    return value;
  }
  async function saved() { return (await storage().get(KEY))[KEY] || {}; }
  async function savePayment(request) {
    FepPaymentTools.core.validate(request.payload);
    const record={payload:bindProject("advance",check(clone(request.payload))),headers:clone(request.headers || {})};
    const all=await saved();all.advance=record;await storage().set({[KEY]:all});
  }
  async function resolve(key, context) {
    if (!Object.hasOwn(defaults,key)) throw new Error("Unknown request template.");
    const record = (await saved())[key] || {payload:defaults[key].payload,headers:{}};
    const payload = substitute(bindProject(key,check(clone(record.payload))),context);
    if (key === "advance") FepPaymentTools.core.validate(payload);
    else if (typeof payload.query !== "string" || !payload.query.trim()) throw new Error("The request needs a GraphQL query.");
    return {payload,headers:record.headers || {}};
  }
  async function open() {
    const {modal,el,button} = FepCustomTools.ui;
    const body = modal("Other cURLS", "Choose a request to edit or send.");
    el("style",`.request-list{display:grid;gap:10px}.request-row{display:flex;align-items:center;gap:14px;width:100%;padding:16px 18px;text-align:left;border:1px solid #e1e2e5;background:#fff;color:#25262a;border-radius:12px}.request-row:hover:not(:disabled){background:#f3f4f5;border-color:#c5c7cc}.request-copy{flex:1;min-width:0}.request-title{display:block;font-size:13px;font-weight:600}.request-description{display:block;margin-top:4px;font-size:11px;font-weight:400;line-height:1.5;color:#797b81}.request-badge{font-size:10px;color:#72757c;background:#f0f1f3;border-radius:5px;padding:3px 7px;white-space:nowrap}.request-arrow{font-size:18px;color:#9699a1}.request-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid #e5e6e9}.request-footer p{margin:0;font-size:11px}.request-footer button{background:transparent;color:#666a73;border:0;padding:4px 0;font-size:11px}@media(max-width:420px){.request-row{padding:14px 12px;gap:8px}.request-badge{font-size:9px}}`,body);
    const all=await saved();
    const descriptions={survey:"Survey details, roof information, and media",preInstall:"Project details and installation checklist",postInstall:"Installation results and completion details",qc:"Quality checks, customer details, and media",advance:"Default values for Pay Advance Payment"};
    const list=el("div",undefined,body);list.className="request-list";
    for (const [key,record] of Object.entries(defaults)) {
      const row=button("",list,() => edit(key),true);row.className="request-row";row.setAttribute("aria-label",record.title);
      const copy=el("span",undefined,row);copy.className="request-copy";
      el("span",record.title,copy).className="request-title";
      el("span",descriptions[key],copy).className="request-description";
      el("span",all[key] ? "Saved" : "Default",row).className="request-badge";
      const arrow=el("span","›",row);arrow.className="request-arrow";arrow.setAttribute("aria-hidden","true");
    }
    const footer=el("div",undefined,body);footer.className="request-footer";
    el("p","Saved in this browser. Project and environment follow the page.",footer);
    const state = (await storage().get(PROMO))[PROMO] || {};
    button(state.disabled ? "Show Crumble suggestions again" : "Turn off Crumble suggestions",footer,async () => {
      await storage().set({[PROMO]:{...state,disabled:!state.disabled}}); await open();
    },true);
  }
  async function edit(key, imported) {
    const {modal,el,input,button,status} = FepCustomTools.ui;
    let record = imported || (await saved())[key] || {payload:clone(defaults[key].payload),headers:{}};
    record = clone(record);
    bindProject(key,check(record.payload));
    const body = modal(defaults[key].title, "Save changes for future runs, or send this request once without saving.");
    el("style",`.request-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.request-actions button{width:100%;min-height:42px}.request-help{margin:0 0 20px!important;font-size:11px!important}.request-options{display:flex;justify-content:space-between;gap:12px;margin-bottom:16px}.request-options button{background:transparent;border:0;color:#777b83;padding:4px 0;font-size:11px}.request-values{border-top:1px solid #e5e6e8;margin-top:18px;padding-top:2px}.request-summary{background:#f1f2f4;border-radius:10px;padding:14px;overflow-wrap:anywhere;font-size:12px}.request-summary p{margin:5px 0}.request-result{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;padding:14px;background:#f1f2f4;border-radius:8px;font:11px/1.6 ui-monospace,monospace}@media(max-width:420px){.request-actions{grid-template-columns:1fr}}`,body);
    const options=el("div",undefined,body);options.className="request-options";
    const actions=el("div",undefined,body);actions.className="request-actions";
    const help=el("details",undefined,body);el("summary","About page values",help);
    el("p","Placeholders such as {{projectId}}, {{uniqueId}}, {{amount}} and {{systemSize}} use the current page. Keep them for future runs, or replace optional values with fixed values.",help).className="request-help";
    const values=el("div",undefined,body);
    values.className="request-values";
    const fields = [];
    function walk(value,path=[]) {
      if (value && typeof value === "object") { for (const [name,child] of Object.entries(value)) walk(child,[...path,name]); return; }
      const node = input(path.join('.'),values,value === null ? "" : String(value), typeof value === "string" && value.includes('\n') ? "textarea" : "input");
      node.readOnly = ["{{projectId}}","{{uniqueId}}"].includes(value);
      fields.push({node,path,value});
    }
    walk(record.payload);
    const read = () => {
      const result = clone(record.payload);
      for (const {node,path,value} of fields) {
        let parent=result; for (const part of path.slice(0,-1)) parent=parent[part];
        let next=node.value;
        if (typeof value === "number" || (typeof value === "string" && /^\{\{(?:amount|projectSize|systemSize|latitude|longitude)\}\}$/.test(value) && !next.includes('{{'))) {
          if (!next.trim() || !Number.isFinite(Number(next))) throw new Error(`Enter a number for ${path.join('.')}.`);
          next=Number(next);
        } else if (typeof value === "boolean") {
          if (!["true","false"].includes(next)) throw new Error(`Use true or false for ${path.join('.')}.`);
          next=next === "true";
        } else if (value === null && !next.trim()) next=null;
        parent[path.at(-1)] = next;
      }
      return {payload:bindProject(key,check(result)),headers:record.headers || {}};
    };
    button("Save for future runs",actions,async () => {
      const next=read();
      // Validate dynamic values with representative data before persisting.
      const preview=substitute(next.payload,{projectId:"1234567890",uniqueId:1234567890,amount:15000,fiscalYear:"26-27",today:"2026-10-30",projectSize:5,systemSize:5,latitude:17,longitude:78});
      if (key === "advance") FepPaymentTools.core.validate(preview);
      else if (typeof preview.query !== "string" || !preview.query.trim()) throw new Error("The request needs a GraphQL query.");
      const all=await saved(); all[key]=next; await storage().set({[KEY]:all}); status("Saved. Future runs will use this template.");
    },true);
    button("Review & send now",actions,()=>reviewRequest(key,read()));
    const advanced=el("details",undefined,body);el("summary","Import cURL or replace JSON",advanced);
    body.insertBefore(advanced,values);
    const headerFields=Object.entries(record.headers || {}).map(([key,value])=>[key,input("Header: "+key,advanced,value)]);
    for (const [,node] of headerFields) node.addEventListener("input",()=>{
      record.headers=Object.fromEntries(headerFields.filter(([,value])=>value.value.trim()).map(([name,value])=>[name,value.value.trim()]));
    });
    const curl=input("Postman cURL",advanced,"","textarea");
    button("Import cURL",advanced,async () => {
      const request=FepPaymentTools.core.importCurl(curl.value,{template:true});
      const url=new URL(request.url);
      const allowed=["uat-fep-api.freyrenergy.com","qa-fep-api.freyrenergy.com","stg-fep-api.freyrenergy.com","fep-api.freyrenergy.com","uat-api.sunpro.tilicho.in","prod-api.sunpro.tilicho.in"];
      const path=key === "advance" ? "/api/v1/zoho/proformainvoicedetailsfromzoho" : "/api/v1/graphql";
      if (url.protocol !== "https:" || url.port !== "444" || !allowed.includes(url.hostname) || url.pathname !== path || url.username || url.password || url.hash || !["","?="].includes(url.search)) throw new Error("Use a supported FEP endpoint for this action.");
      await edit(key,{payload:request.payload,headers:request.headers}); status("Imported. Review the values, then save. The endpoint still follows the page environment.");
    },true);
    const json=input("JSON payload",advanced,JSON.stringify(record.payload,null,2),"textarea");
    body.addEventListener("input",event=>{
      if (fields.some(field=>field.node === event.target)) {
        try { json.value=JSON.stringify(read().payload,null,2); } catch (_) { /* Keep the last valid JSON while a value is incomplete. */ }
      }
    });
    button("Apply JSON",advanced,()=>edit(key,{...record,payload:check(FepPaymentTools.core.parseJson(json.value))}),true);
    button("Reset to default",options,async () => {const all=await saved();delete all[key];await storage().set({[KEY]:all});await edit(key);status("Default restored.");},true);
    button("Back to Other cURLS",options,open,true);
  }
  function reviewRequest(key,record) {
    if(requestInFlight) throw new Error("A request is already in progress. Wait for its response.");
    if(!workspace) throw new Error("Refresh the FEP page to open the request workspace.");
    const endpoint=workspace.getEndpoint(key);
    const context={...workspace.getContext(key)};
    const {modal,el,input,button,status}=FepCustomTools.ui;
    const body=modal("Review & send · "+defaults[key].title,"This sends once. Your saved configuration stays unchanged.");
    el("style",`.run-summary{background:#f1f2f4;padding:14px;border-radius:10px;font-size:12px;overflow-wrap:anywhere}.run-summary p{margin:5px 0}.run-fields{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.run-response{white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;padding:14px;background:#f1f2f4;border:1px solid #e0e1e3;border-radius:8px;font:11px/1.6 ui-monospace,monospace}@media(max-width:480px){.run-fields{grid-template-columns:1fr}}`,body);
    const summary=el("div",undefined,body);summary.className="run-summary";
    el("strong",new URL(endpoint).hostname.startsWith('uat-')?'UAT':new URL(endpoint).hostname.startsWith('qa-')?'QA':new URL(endpoint).hostname.startsWith('stg-')?'STAGING':'PRODUCTION',summary);
    el("p","POST · "+endpoint,summary);
    const fieldBox=el("div",undefined,body);fieldBox.className="run-fields";
    const required=[...new Set([...JSON.stringify(record.payload).matchAll(/\{\{(\w+)\}\}/g)].map(match=>match[1]))];
    const labels={projectId:key==='advance'?'Project ID':'Internal project ID',uniqueId:'Project ID',systemSize:'System size (kW)',projectSize:'System size (kW)',amount:'Advance amount',fiscalYear:'Financial year',today:'Invoice date',latitude:'Latitude',longitude:'Longitude'};
    const numeric=new Set(['uniqueId','systemSize','projectSize','amount','latitude','longitude']);
    const inputs=required.map(name=>{
      const node=input(labels[name] || name,fieldBox,context[name] == null ? '' : String(context[name]));
      if(numeric.has(name)){node.type='number';node.step=name==='uniqueId'?'1':'any';}
      return {name,node};
    });
    const preview=input("Payload to send",body,"","textarea");preview.readOnly=true;preview.style.minHeight="180px";
    const headers=el("details",undefined,body);el("summary","Request headers",headers);
    el("pre",JSON.stringify({'Content-Type':'application/json',...record.headers},null,2),headers).className="run-response";
    const read=()=>{
      const next={...context};
      for(const {name,node} of inputs){
        if(!node.value.trim()) throw new Error("Enter "+(labels[name] || name)+".");
        next[name]=numeric.has(name)?Number(node.value):node.value.trim();
        if(numeric.has(name) && !Number.isFinite(next[name]))throw new Error("Enter a valid "+(labels[name] || name)+".");
        if(['uniqueId','systemSize','projectSize','amount'].includes(name) && next[name]<=0)throw new Error((labels[name] || name)+" must be greater than zero.");
        if(name==='uniqueId' && !Number.isSafeInteger(next[name]))throw new Error("Project ID must be a whole number.");
        if(name==='projectId' && key!=='advance' && !/^[a-f0-9]{24}$/i.test(next[name]))throw new Error("Enter the 24-character internal project ID.");
      }
      return prepare(key,record,next);
    };
    const update=()=>{try{preview.value=JSON.stringify(read().payload,null,2);status('');}catch(error){preview.value='';status(error.message,true);}};
    for(const {node} of inputs)node.addEventListener('input',update);
    const actions=el("div",undefined,body);actions.className="actions";
    const back=button("Back to editor",actions,()=>edit(key,record),true);
    const send=button("Send request",actions,async()=>{
      if(requestInFlight)throw new Error("A request is already in progress.");
      const request=read();
      // Validate before disabling the form or making any request.
      requestInFlight=true;back.disabled=true;for(const {node}of inputs)node.disabled=true;
      send.dataset.sent='true';status('Sending…');
      const result=el('pre','',body);result.className='run-response';result.setAttribute('aria-label','Request response');
      try{
        const started=performance.now();
        let response;
        if(key==='advance'){
          response=await chrome.runtime.sendMessage({type:'FEP_ADVANCE_PAYMENT',endpoint,body:JSON.stringify(request.payload),headers:request.headers});
          if(!response || response.error)throw new Error(response?.error || 'No response received.');
        }else{
          const res=await fetch(endpoint,{method:'POST',headers:{accept:'*/*','Content-Type':'application/json',...request.headers},body:JSON.stringify(request.payload),redirect:'error',signal:AbortSignal.timeout(30000)});
          const text=await res.text();let data;try{data=JSON.parse(text);}catch(_){data=null;}
          response={ok:res.ok,status:res.status,text,data};
        }
        const success=response.ok && (key==='advance' || response.data) && !response.data?.errors && !response.data?.error && response.data?.success!==false;
        result.textContent=`HTTP ${response.status} · ${Math.round(performance.now()-started)} ms\n\n${response.text || JSON.stringify(response.data,null,2)}`;
        status(success?'Request sent. Saved configuration unchanged.':'Request failed. See the response below.',!success);
        send.textContent=success?'Sent':'Request failed';
      }catch(error){result.textContent=error.message;status('Outcome unknown. Check the project before sending again.',true);send.textContent='Check project before retrying';}
      finally{requestInFlight=false;back.disabled=false;}
    });
    update();
  }
  let promoBusy=false;
  async function maybePromote(now=Date.now()) {
    if (promoBusy || document.getElementById("fep-crumble-promo")) return;
    promoBusy=true;
    try {
      const state=(await storage().get(PROMO))[PROMO] || {};
      if (state.disabled) return;
      state.opens=(state.opens || 0)+1;
      const due=state.opens>=3 && (!state.lastShown || now-state.lastShown>=14*86400000);
      if (due) state.lastShown=now;
      await storage().set({[PROMO]:state});
      if (!due) return;
      const card=document.createElement("aside");card.id="fep-crumble-promo";card.setAttribute("aria-label","Crumble suggestion");
      card.style.cssText="position:fixed;left:20px;bottom:24px;width:260px;max-width:calc(100vw - 40px);padding:18px;background:#fff;color:#202124;border:1px solid #ddd;border-radius:12px;box-shadow:0 8px 30px #0002;z-index:2147483646;font:13px/1.5 system-ui";
      const heading=document.createElement("strong");heading.textContent="Check this out";card.append(heading);
      const text=document.createElement("p");text.textContent="Crumble helps you clear cookies automatically. Made by Rahul.";card.append(text);
      const link=document.createElement("a");link.textContent="See Crumble ↗";link.href=CRUMBLE;link.target="_blank";link.rel="noopener noreferrer";link.style.cssText="color:#202124;font-weight:600";link.onclick=()=>card.remove();card.append(link);
      for (const [label,disable] of [["Not now",false],["Don’t show again",true]]) {
        const button=document.createElement("button");button.textContent=label;button.style.cssText="display:block;background:none;border:0;padding:8px 0 0;color:#666;font:inherit;cursor:pointer";
        button.onclick=async()=>{if(disable){const current=(await storage().get(PROMO))[PROMO] || {};await storage().set({[PROMO]:{...current,disabled:true}});}card.remove();};card.append(button);
      }
      document.body.append(card);
    } finally {promoBusy=false;}
  }
  globalThis.FepRequestTools=Object.freeze({open,resolve,savePayment,maybePromote,configure,crumbleUrl:CRUMBLE});
})();
