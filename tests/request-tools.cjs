const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:850}});page.setDefaultTimeout(6000);
  await page.route('https://uat-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Request templates test</h1>'}));
  await page.goto('https://uat-fep.freyrenergy.com/test');
  await page.evaluate(()=>{window.store={};window.chrome={runtime:{getManifest:()=>({version:'1.0.5'})},storage:{local:{get:async key=>({[key]:store[key]}),set:async value=>Object.assign(store,value)}}};});
  for(const file of ['custom-tools.js','payment-tools.js','request-defaults.js','request-tools.js'])await page.addScriptTag({path:path.join(root,file)});
  const context={projectId:'2000009999',uniqueId:2000009999,amount:23456,fiscalYear:'26-27',today:'2026-10-30',projectSize:8,systemSize:8,latitude:17.5,longitude:78.4};
  for(const key of ['advance','survey','preInstall','postInstall','qc']) {
   const request=await page.evaluate(({key,context})=>FepRequestTools.resolve(key,context),{key,context});
   assert(!JSON.stringify(request).includes('{{'));
   if(key==='advance'){assert.equal(request.payload.proposal_id,context.projectId);assert.equal(request.payload.details.paid_amount,23456);assert.equal(request.payload.Invoice_ID,'FE/26-27/2000009999');}
   else if(key==='survey'){assert.equal(request.payload.variables.project,context.projectId);assert.equal(request.payload.variables.surveyDetails.projectSize.projectSize,8);}
   else {assert.equal(request.payload.variables.input.project,context.projectId);assert.equal(request.payload.variables.input.projectDetails[key==='qc'?'projectId':'uniqueId'],2000009999);}
  }
  await page.evaluate(()=>FepRequestTools.open());
  await page.getByRole('heading',{name:'Other cURLS',exact:true}).waitFor();
  assert.equal(await page.locator('.request-row').count(),5);
  await page.screenshot({path:path.join(root,'test-results/other-curls-desktop.png')});
  await page.setViewportSize({width:375,height:760});
  const mobileCard=await page.getByRole('dialog').boundingBox();
  assert(mobileCard.x>=0 && mobileCard.x+mobileCard.width<=375,'Other cURLS fits mobile viewport');
  await page.screenshot({path:path.join(root,'test-results/other-curls-mobile.png')});
  await page.setViewportSize({width:1100,height:850});
  await page.getByRole('button',{name:'Site Survey',exact:true}).click();
  await page.getByLabel('variables.surveyDetails.surveyName',{exact:true}).fill('Saved survey engineer');
  await page.getByRole('button',{name:'Save for future runs',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Saved. Future runs'}).waitFor();
  let result=await page.evaluate(context=>FepRequestTools.resolve('survey',context),context);
  assert.equal(result.payload.variables.surveyDetails.surveyName,'Saved survey engineer');
  assert.equal(result.payload.variables.project,context.projectId);
  // Replacement data, not a deep merge: removed fields remain removed.
  const json=page.getByLabel('JSON payload',{exact:true});
  await page.getByText('Import cURL or replace JSON',{exact:true}).click();
  const payload=JSON.parse(await json.inputValue());delete payload.variables.surveyDetails.customerEmail;
  await json.fill(JSON.stringify(payload));await page.getByRole('button',{name:'Apply JSON',exact:true}).click();
  await page.getByRole('button',{name:'Save for future runs',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Saved. Future runs'}).waitFor();
  result=await page.evaluate(context=>FepRequestTools.resolve('survey',context),{...context,projectId:'NEW-PROJECT'});
  assert.equal(result.payload.variables.project,'NEW-PROJECT');assert(!Object.hasOwn(result.payload.variables.surveyDetails,'customerEmail'));
  await page.getByRole('button',{name:'Back to Other cURLS',exact:true}).click();
  await page.getByRole('button',{name:'Advance Payment',exact:true}).click();
  await page.getByLabel('details.paid_amount',{exact:true}).fill('18000');
  await page.getByRole('button',{name:'Save for future runs',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved. Future runs'}).waitFor();
  result=await page.evaluate(context=>FepRequestTools.resolve('advance',context),context);
  assert.equal(result.payload.details.paid_amount,18000);assert.equal(result.payload.details.invoice_amount,23456);
  await page.getByLabel('details.paid_amount',{exact:true}).fill('bad');await page.getByRole('button',{name:'Save for future runs',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Enter a number'}).waitFor();
  await page.getByRole('button',{name:'Reset to default',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Default restored'}).waitFor();
  result=await page.evaluate(context=>FepRequestTools.resolve('advance',context),context);assert.equal(result.payload.details.paid_amount,23456);
  await page.getByText('Import cURL or replace JSON',{exact:true}).click();
  await page.getByLabel('Postman cURL',{exact:true}).fill(`curl 'https://example.com:444/api/v1/zoho/proformainvoicedetailsfromzoho' --data '{"test":1}'`);
  await page.getByRole('button',{name:'Import cURL',exact:true}).click();await page.getByRole('status').filter({hasText:'supported FEP endpoint'}).waitFor();
  await page.getByRole('button',{name:'Back to Other cURLS',exact:true}).click();
  await page.getByRole('button',{name:'Site Survey',exact:true}).click();
  await page.getByText('Import cURL or replace JSON',{exact:true}).click();
  const imported=JSON.parse(await page.getByLabel('JSON payload',{exact:true}).inputValue());
  imported.variables.project='OLD-PROJECT';
  const command=`curl 'https://qa-fep-api.freyrenergy.com:444/api/v1/graphql' --header 'Authorization: Bearer sample-token' --data '${JSON.stringify(imported).replace(/'/g,"'\"'\"'")}'`;
  const browserExport=command.replace("curl ","curl -H 'origin: https://uat-fep.freyrenergy.com' -H 'referer: https://uat-fep.freyrenergy.com/' -H 'accept-language: en-GB,en;q=0.9' -H 'sec-ch-ua: Chromium' -H 'sec-fetch-mode: cors' -H 'sec-gpc: 1' -H 'priority: u=1, i' -H 'user-agent: browser' ");
  const parsedExport=await page.evaluate(command=>FepPaymentTools.core.importCurl(command,{template:true}),browserExport);
  assert.deepEqual(parsedExport.headers,{authorization:'Bearer sample-token'},'Browser-managed headers are omitted from saved requests');
  await page.getByLabel('Postman cURL',{exact:true}).fill(command);
  await page.getByRole('button',{name:'Import cURL',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Imported. Review'}).waitFor();
  await page.getByRole('button',{name:'Save for future runs',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Saved. Future runs'}).waitFor();
  result=await page.evaluate(context=>FepRequestTools.resolve('survey',context),context);
  assert.equal(result.payload.variables.project,context.projectId);assert.equal(result.headers.authorization,'Bearer sample-token');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(async()=>{await FepRequestTools.maybePromote(1000000000000);await FepRequestTools.maybePromote(1000000000001);await FepRequestTools.maybePromote(1000000000002);});
  assert.equal(await page.getByText('Check this out',{exact:true}).count(),1);
  assert((await page.getByRole('link',{name:'See Crumble ↗'}).getAttribute('href')).includes('lecjahllepkiamfeaiaibikpobbdddnk'));
  await page.screenshot({path:path.join(root,'test-results/crumble-prompt.png')});
  await page.getByRole('button',{name:'Not now',exact:true}).click();
  await page.evaluate(()=>FepRequestTools.maybePromote(1000000000003));assert.equal(await page.locator('#fep-crumble-promo').count(),0);
  await page.evaluate(()=>FepRequestTools.maybePromote(1000000000002+14*86400000));
  await page.getByRole('button',{name:'Don’t show again',exact:true}).click();
  await page.evaluate(()=>FepRequestTools.maybePromote(1000000000002+28*86400000));assert.equal(await page.locator('#fep-crumble-promo').count(),0);
  await page.evaluate(()=>FepRequestTools.open());await page.getByRole('button',{name:'Show Crumble suggestions again',exact:true}).waitFor();
  await page.getByRole('button',{name:'Site Survey',exact:true}).click();
  await page.screenshot({path:path.join(root,'test-results/request-template.png')});
  // Exercise the real action functions with simulated fetch, so saved templates reach the API path.
  const source=fs.readFileSync(path.join(root,'content.js'),'utf8');
  const amountSource=source.slice(source.indexOf('  function getAdvanceAmount()'),source.indexOf('  // Pulls a short, human-readable'));
  const amount=await page.evaluate(amountSource=>{
    const card=document.createElement('div');card.id='paymentMethod';card.textContent='Total PO: Rs. 250,000 Advance amount: Rs. 15,250.75';document.body.append(card);
    const result=new Function(amountSource+'; return getAdvanceAmount();')();card.remove();return result;
  },amountSource);
  assert.equal(amount,15250.75,'Read the advance amount, retain decimals, and ignore the PO total');
  for(const [fn,key] of [['fillSiteSurveyForm','survey'],['fillPreInstallForm','preInstall'],['fillPostInstallForm','postInstall']]) {
   const from=source.indexOf('  async function '+fn+'(');const to=source.indexOf('\n  function inject',from);
   const action=source.slice(from,to);
   const sent=await page.evaluate(async({action,context})=>{
    let captured;
    const factory=new Function('FepRequestTools','canUseHardcodedApiEndpoints','BUTTON_IDS','getProjectIdFromUrl','getNumericProjectId','getProjectSizeKw','getApiEndpoint','getRandomIndianCoordinates','showApiToast','extractApiMessage','fetch','LOG_PREFIX',action+';return '+action.match(/async function (\w+)/)[1]);
    const run=factory(FepRequestTools,()=>true,{},()=>context.projectId,()=>context.uniqueId,()=>context.systemSize,()=>'/graphql',()=>context,()=>{},()=>'',async(url,options)=>{captured=JSON.parse(options.body);return {ok:true,json:async()=>({})};},'test');
    await run();return captured;
   },{action,context});
   assert(sent,fn+' should submit');
   if(key==='survey')assert.equal(sent.variables.surveyDetails.surveyName,'Saved survey engineer');
   else assert.equal(sent.variables.input.project,context.projectId);
  }
  console.log('PASS: all five templates, live project substitutions, persisted edits/removals, action integration, numeric validation, reset, import restrictions, Crumble cooldown and opt-out. No live requests sent.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
