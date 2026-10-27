(function () {
  "use strict";
  const PATH = "/api/v1/zoho/proformainvoicedetailsfromzoho";
  const HOSTS = Object.freeze({uat:"uat-fep-api.freyrenergy.com",qa:"qa-fep-api.freyrenergy.com",staging:"stg-fep-api.freyrenergy.com",production:"fep-api.freyrenergy.com"});
  let draft = null, sending = false, lastResponse = null, draftProjectId = null;
  const ui = () => FepCustomTools.ui;
  function endpoint(environment) {
    if (!Object.hasOwn(HOSTS, environment)) throw new Error("Choose a supported payment environment.");
    return `https://${HOSTS[environment]}:444${PATH}`;
  }
  function environmentFor(url) {
    const parsed = new URL(url);
    const environment = Object.keys(HOSTS).find(key => parsed.hostname === HOSTS[key]);
    if (!environment || parsed.protocol !== "https:" || parsed.port !== "444" || parsed.pathname !== PATH || parsed.username || parsed.password || parsed.hash || !["", "?="].includes(parsed.search)) throw new Error("Use one of the configured payment API endpoints on HTTPS port 444.");
    return environment;
  }
  // Parse data only. Imported cURL is never evaluated or executed as a command.
  function tokens(command) {
    const source = command.replace(/\\\r?\n/g," ");
    const result=[];let token="", quote=null, active=false;
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(quote){
        if(ch===quote){quote=null;continue;}
        if(ch==="\\" && quote==='"' && ['"','\\'].includes(source[i+1])){token+=source[++i];continue;}
        token+=ch;
      }else if(ch==="'" || ch==='"'){quote=ch;active=true;}
      else if(/\s/.test(ch)){if(active){result.push(token);token="";active=false;}}
      else if(ch==="\\" && i+1<source.length){token+=source[++i];active=true;}
      else {token+=ch;active=true;}
    }
    if(quote)throw new Error("The cURL has an unclosed quote.");
    if(active)result.push(token);
    return result;
  }
  function parseJson(text) {
    // Postman permits JSON comments. Remove them without damaging https:// strings.
    let result="", quoted=false, escaped=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i], next=text[i+1];
      if(quoted){result+=ch;if(escaped)escaped=false;else if(ch==="\\")escaped=true;else if(ch==='"')quoted=false;continue;}
      if(ch==='"'){quoted=true;result+=ch;}
      else if(ch==='/' && next==='/'){while(i<text.length && text[i]!=="\n")i++;result+='\n';}
      else if(ch==='/' && next==='*'){const end=text.indexOf('*/',i+2);if(end<0)throw new Error("Unclosed JSON comment.");i=end+1;result+=' ';}
      else result+=ch;
    }
    return JSON.parse(result);
  }
  function validate(payload) {
    if(!payload || typeof payload!=="object" || Array.isArray(payload))throw new Error("The payload must be a JSON object.");
    function inspect(value){if(!value || typeof value!=="object")return;for(const [key,child] of Object.entries(value)){if(["__proto__","constructor","prototype"].includes(key))throw new Error("Unsupported JSON field name.");inspect(child);}}
    inspect(payload);
    if(!["string","number"].includes(typeof payload.proposal_id) || !String(payload.proposal_id).trim())throw new Error("Enter proposal_id.");
    if(typeof payload.payment_stage!=="string" || !payload.payment_stage.trim())throw new Error("Enter payment_stage.");
    if(!payload.details || typeof payload.details!=="object" || Array.isArray(payload.details))throw new Error("details must be an object.");
    for(const key of ["invoice_amount","paid_amount","due_amount"]){if(typeof payload.details[key]!=="number" || !Number.isFinite(payload.details[key]) || payload.details[key]<0)throw new Error(`details.${key} must be a number of zero or more.`);}
    return payload;
  }
  function importCurl(command) {
    const parts=tokens(command.trim());if(parts.shift()?.toLowerCase()!=="curl")throw new Error("Paste a Postman cURL command beginning with curl.");
    let url,body,method="POST";const headers={};
    const take=()=>{if(!parts.length)throw new Error("The cURL is missing an option value.");return parts.shift();};
    while(parts.length){
      let part=parts.shift();const equals=part.indexOf('=');
      if(part.startsWith('--') && equals>0){parts.unshift(part.slice(equals+1));part=part.slice(0,equals);}
      if(["--location","-L"].includes(part))continue;
      if(["--url"].includes(part)){url=take();continue;}
      if(["--request","-X"].includes(part)){method=take().toUpperCase();continue;}
      if(["--header","-H"].includes(part)){
        const header=take(), colon=header.indexOf(':');if(colon<1)throw new Error("Invalid cURL header.");
        const key=header.slice(0,colon).trim().toLowerCase(),value=header.slice(colon+1).trim();
        if(!["content-type","accept","authorization","x-api-key"].includes(key))throw new Error(`Unsupported header: ${key}. Supported headers: Content-Type, Accept, Authorization, X-API-Key.`);
        if(/[\r\n]/.test(value))throw new Error("Invalid header value.");headers[key]=value;continue;
      }
      if(["--data","--data-raw","--data-binary","-d"].includes(part)){if(body!==undefined)throw new Error("Use one JSON body in the cURL.");body=take();continue;}
      if(part.startsWith('https://')){if(url)throw new Error("Use one endpoint in the cURL.");url=part;continue;}
      throw new Error(`Unsupported cURL option: ${part}`);
    }
    if(method!=="POST")throw new Error("Payment requests must use POST.");
    if(!url || body===undefined)throw new Error("The cURL must include a payment endpoint and a JSON body.");
    if(headers['content-type'] && !/^application\/json(?:\s*;.*)?$/i.test(headers['content-type']))throw new Error("Payments require Content-Type: application/json.");
    delete headers['content-type'];
    return {environment:environmentFor(url),payload:validate(parseJson(body)),headers};
  }
  function makeCurl(request) {
    const quote=value=>"'"+value.replace(/'/g,"'\"'\"'")+"'";
    return `curl --location ${quote(endpoint(request.environment))} \\\n  --header 'Content-Type: application/json'${Object.entries(request.headers).map(([key,value])=>` \\\n  --header ${quote(key+': '+value)}`).join('')} \\\n  --data ${quote(JSON.stringify(request.payload,null,2))}`;
  }
  function initial(context) {
    const host=location.hostname;
    const environment=host.startsWith('uat-')?'uat':host.startsWith('qa-')?'qa':host.startsWith('stg-')?'staging':host==='fep.freyrenergy.com'?'production':'uat';
    const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return {environment,headers:{},payload:{proposal_id:context.projectId || "",payment_stage:"Advance Invoice",Invoice_ID:context.projectId?`FE/${context.fiscalYear || ""}/${context.projectId}`:"",estimate_status:"invoiced",invoice_status:"paid",action:{delete:false},details:{invoice_amount:context.amount || 0,paid_amount:context.amount || 0,due_amount:0,estimate_date:null,invoice_date:date,payment_link:"",payment_link_id:null,payment_type:null,razorpay_payment_id:"",razorpay_order_id:"",transaction_id:""},invoice_url:""}};
  }
  function leaves(value,path=[],result=[]) {
    if(value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length){for(const [key,child] of Object.entries(value))leaves(child,[...path,key],result);}
    else result.push({path,value});
    return result;
  }
  function typeOf(value){return value===null?'null':typeof value==='object'?'json':typeof value;}
  function parseValue(type,text){
    if(type==='string')return text;
    if(type==='null')return null;
    if(type==='boolean'){if(!['true','false'].includes(text.trim()))throw new Error('Use true or false for a boolean.');return text.trim()==='true';}
    if(type==='number'){if(!text.trim() || !Number.isFinite(Number(text)))throw new Error('Enter a valid number.');return Number(text);}
    return JSON.parse(text);
  }
  function open(context={}) {
    if(sending)throw new Error("A payment request is still in progress. Wait for its response before opening another.");
    if(!draft || (context.projectId && context.projectId !== draftProjectId))draft=initial(context);
    if(context.projectId)draftProjectId=context.projectId;
    render();
  }
  function render() {
    const {modal,el,input,select,button,status}=ui();
    const body=modal("Payments","Edit a payment request, review its destination and payload, then send it directly. Drafts remain in this page’s memory until you refresh.");
    el('style',`.payment-grid{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:8px}.payment-grid label{margin-top:10px}.payment-grid input,.payment-grid select{font-size:12px}.payment-endpoint{font:11px/1.6 ui-monospace,monospace;overflow-wrap:anywhere;background:#f0f1f2;border-radius:6px;padding:10px}.payment-response{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.6 ui-monospace,monospace;max-height:300px;overflow:auto;border:1px solid #dedfe2;padding:14px;border-radius:8px}details{margin-top:18px}summary{cursor:pointer;font-weight:550}h3{font-size:13px;margin:24px 0 6px}.payment-review{padding:14px;background:#f1f2f3;border-radius:8px} .payment-grid .null-value{color:#8b8d92}`,body);
    const importer=el('details',undefined,body);el('summary','Import from Postman cURL',importer);
    const curl=input('Postman cURL',importer,'','textarea');curl.placeholder="Paste curl --location 'https://…' --header … --data …";
    button('Import request',importer,()=>{const imported=importCurl(curl.value);draft=imported;render();status('Imported. Check the environment and edited values before sending.');},true);
    const environment=select('Payment environment',body,Object.keys(HOSTS).map(key=>[key,key==='uat'?'UAT':key==='qa'?'QA':key[0].toUpperCase()+key.slice(1)]),draft.environment);
    const url=el('p',endpoint(draft.environment),body);url.className='payment-endpoint';
    environment.addEventListener('change',()=>{url.textContent=endpoint(environment.value);});
    const headers=el('details',undefined,body);el('summary','Optional request headers',headers);
    el('p','Content-Type is application/json. Optional credentials are kept only in this page’s memory.',headers);
    const headerInputs={};for(const name of ['authorization','x-api-key','accept']){headerInputs[name]=input(name,headers,draft.headers[name] || '');if(name!=='accept')headerInputs[name].type='password';}
    el('h3','Payload fields',body);
    const rows=[];
    for(const leaf of leaves(draft.payload)){
      const grid=el('div',undefined,body);grid.className='payment-grid';
      const value=input(leaf.path.join('.'),grid,typeOf(leaf.value)==='json'?JSON.stringify(leaf.value):leaf.value===null?'null':String(leaf.value));
      const type=select(`${leaf.path.join('.')} type`,grid,[['string','Text'],['number','Number'],['boolean','Boolean'],['null','Null'],['json','JSON']],typeOf(leaf.value));
      type.parentElement.firstChild.textContent='Type';
      type.addEventListener('change',()=>{if(type.value==='null')value.value='null';if(type.value==='boolean'&&!['true','false'].includes(value.value))value.value='false';});
      rows.push({...leaf,input:value,type});
    }
    const read=(validatePayload=true)=>{
      const payload=JSON.parse(JSON.stringify(draft.payload));
      for(const row of rows){try{let current=payload;for(const key of row.path.slice(0,-1))current=current[key];current[row.path.at(-1)]=parseValue(row.type.value,row.input.value);}catch(error){throw new Error(`${row.path.join('.')}: ${error.message}`);}}
      const nextHeaders={};for(const [key,node]of Object.entries(headerInputs))if(node.value.trim())nextHeaders[key]=node.value.trim();
      return {environment:environment.value,headers:nextHeaders,payload:validatePayload?validate(payload):payload};
    };
    const remember=()=>{try{draft=read(false);}catch(_){/* Keep incomplete numeric edits in the visible form until corrected. */}};
    body.addEventListener('input',remember);body.addEventListener('change',remember);
    const raw=el('details',undefined,body);el('summary','Advanced: replace JSON payload',raw);
    const json=input('JSON payload',raw,JSON.stringify(draft.payload,null,2),'textarea');
    button('Apply JSON',raw,()=>{draft={environment:environment.value,headers:Object.fromEntries(Object.entries(headerInputs).filter(([,node])=>node.value.trim()).map(([key,node])=>[key,node.value.trim()])),payload:validate(parseJson(json.value))};render();status('JSON applied. Review before sending.');},true);
    const exported=el('details',undefined,body);el('summary','Export cURL',exported);
    const exportText=input('Exported cURL',exported,'','textarea');exportText.readOnly=true;
    const actions=el('div',undefined,body);actions.className='actions';
    button('Review payment request',actions,()=>{draft=read();review();});
    button('Show cURL',actions,()=>{exportText.value=makeCurl(read());exported.open=true;status('cURL is ready to copy in Export cURL.');},true);
    button('New draft',actions,()=>{draft=initial({});render();status('Started a new blank request.');},true);
    if(lastResponse){el('h3',`Last response · ${lastResponse.environment.toUpperCase()} · proposal ${lastResponse.proposalId}`,body);const previous=el('pre',lastResponse.text,body);previous.className='payment-response';previous.setAttribute('aria-label','Last payment response');}
  }
  function review() {
    const {modal,el,input,button,status}=ui();
    const request=JSON.parse(JSON.stringify(draft));validate(request.payload);
    const body=modal('Review payment request','This will submit the payload to the selected environment and may update the project’s payment record.');
    el('style','.payment-review{padding:14px;background:#f1f2f3;border-radius:8px}.payment-review p{margin:7px 0;font-size:11px;overflow-wrap:anywhere}.payment-response{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.6 ui-monospace,monospace;max-height:300px;overflow:auto;border:1px solid #dedfe2;padding:14px;border-radius:8px}',body);
    const summary=el('div',undefined,body);summary.className='payment-review';
    el('strong',`${request.environment.toUpperCase()} · POST`,summary);
    el('p',endpoint(request.environment),summary);
    el('p',`Proposal: ${request.payload.proposal_id} · Stage: ${request.payload.payment_stage}`,summary);
    el('p',`Invoice amount: ${request.payload.details.invoice_amount} · Paid: ${request.payload.details.paid_amount} · Due: ${request.payload.details.due_amount}`,summary);
    el('p',`Headers: Content-Type${Object.keys(request.headers).length?', '+Object.keys(request.headers).join(', '):''}`,summary);
    const preview=input('Payload preview',body,JSON.stringify(request.payload,null,2),'textarea');preview.readOnly=true;preview.style.minHeight='220px';
    const actions=el('div',undefined,body);actions.className='actions';
    const back=button('Back to editor',actions,render,true);
    const send=button(`Send to ${request.environment.toUpperCase()}`,actions,async()=>{
      if(sending)throw new Error('A payment request is already in progress.');
      sending=true;back.disabled=true;status('Sending payment request…');
      const resultBox=el('pre','',body);resultBox.className='payment-response';resultBox.setAttribute('aria-label','Payment response');
      try{
        const result=await chrome.runtime.sendMessage({type:'FEP_PAYMENT_REQUEST',environment:request.environment,endpoint:endpoint(request.environment),body:JSON.stringify(request.payload),headers:request.headers});
        if(!result || result.error)throw new Error(result?.error || 'No response from the extension.');
        resultBox.textContent=`HTTP ${result.status}${result.elapsedMs!==undefined?' · '+result.elapsedMs+' ms':''}\n\n${result.text ?? JSON.stringify(result.data,null,2)}`;
        lastResponse={environment:request.environment,proposalId:request.payload.proposal_id,text:resultBox.textContent};
        status(result.ok?'Request completed. Check the response and project record.':`Request returned HTTP ${result.status}. Read the response before changing and resending.`,!result.ok);
        send.textContent='Request sent';send.dataset.sent='true';
      }catch(error){resultBox.textContent=error.message;lastResponse={environment:request.environment,proposalId:request.payload.proposal_id,text:'Outcome unknown: '+error.message};status('The outcome is unknown. Check the project’s payment record before sending again.',true);send.textContent='Check payment before retrying';send.dataset.sent='true';}
      finally{sending=false;back.disabled=false;}
    });
  }
  globalThis.FepPaymentTools=Object.freeze({open,core:Object.freeze({endpoint,environmentFor,importCurl,makeCurl,parseJson,validate})});
})();
