const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:900}});page.setDefaultTimeout(6000);
  let calls=[],mode='ok',release;
  await page.route('**/*',async route=>{
   if(route.request().method()!=='POST')return route.fulfill({contentType:'text/html',body:'<h1>FEP workspace test</h1>'});
   calls.push(route.request().postDataJSON());
   if(mode==='wait')await new Promise(resolve=>release=resolve);
   if(mode==='network')return route.abort();
   return route.fulfill({status:mode==='http'?422:200,contentType:'application/json',body:JSON.stringify(mode==='graphql'?{errors:[{message:'Invalid form'}]}:{data:{saveForm:{message:'Saved'}}})});
  });
  await page.goto('https://qa-fep.freyrenergy.com/test');
  await page.evaluate(()=>{
   window.store={};window.paymentCalls=[];
   window.chrome={runtime:{getManifest:()=>({version:'1.0.5'}),sendMessage:async request=>{paymentCalls.push(request);return {ok:true,status:200,text:'{"success":true}',data:{success:true}};}},storage:{local:{get:async key=>({[key]:store[key]}),set:async value=>Object.assign(store,value)}}};
  });
  for(const file of ['custom-tools.js','payment-tools.js','request-defaults.js','request-tools.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>FepRequestTools.configure({
   getEndpoint:key=>key==='advance'?'https://qa-fep-api.freyrenergy.com:444/api/v1/zoho/proformainvoicedetailsfromzoho':'https://qa-fep-api.freyrenergy.com:444/api/v1/graphql',
   getContext:key=>({projectId:key==='advance'?'2000009999':'6ae032225953f3972e343f5d',uniqueId:2000009999,systemSize:5.75,projectSize:5.75,amount:18000,fiscalYear:'26-27',today:'2026-11-01',latitude:17.5,longitude:78.4})
  }));
  const open=async title=>{await page.evaluate(()=>FepRequestTools.open());await page.getByRole('button',{name:title,exact:true}).click();};
  for(const [title,field] of [['Site Survey','variables.surveyDetails.surveyName'],['Pre-installation','variables.input.projectDetails.freyrSiteEngineerName'],['Post-installation','variables.input.projectDetails.firstName'],['QC Form','variables.input.projectDetails.engineerName'],['Advance Payment','invoice_status']]){
   await open(title);
   await page.getByLabel(field,{exact:true}).fill('One-time edit');
   const storeBefore=await page.evaluate(()=>JSON.stringify(store));
   const count=calls.length;
   await page.getByRole('button',{name:'Review & send now',exact:true}).click();
   assert.equal(calls.length,count,'Review does not send');
   const preview=JSON.parse(await page.getByLabel('Payload to send',{exact:true}).inputValue());
   let value=preview;for(const name of field.split('.'))value=value[name];assert.equal(value,'One-time edit');
   if(title==='Advance Payment')assert.equal(preview.proposal_id,'2000009999');
   else assert(JSON.stringify(preview).includes('6ae032225953f3972e343f5d'));
   if(title==='Pre-installation'){
    await page.screenshot({path:path.join(root,'test-results/request-workspace-review.png')});
    await page.getByRole('button',{name:'Back to editor',exact:true}).click();
    assert.equal(await page.getByLabel(field,{exact:true}).inputValue(),'One-time edit','Back preserves unsaved edits');
    await page.screenshot({path:path.join(root,'test-results/request-workspace-editor.png')});
    await page.setViewportSize({width:375,height:800});
    const mobile=await page.getByRole('dialog').boundingBox();assert(mobile.x>=0 && mobile.x+mobile.width<=375);
    const saveBounds=await page.getByRole('button',{name:'Save for future runs',exact:true}).boundingBox();
    const reviewBounds=await page.getByRole('button',{name:'Review & send now',exact:true}).boundingBox();
    assert(reviewBounds.y>=saveBounds.y+saveBounds.height,'Actions stack on narrow screens');
    await page.screenshot({path:path.join(root,'test-results/request-workspace-mobile.png')});
    await page.setViewportSize({width:1180,height:900});
    await page.getByRole('button',{name:'Review & send now',exact:true}).click();
   }
   await page.getByRole('button',{name:'Send request',exact:true}).click();
   await page.getByRole('status').filter({hasText:'Request sent. Saved configuration unchanged.'}).waitFor();
   assert(await page.getByRole('button',{name:'Sent',exact:true}).isDisabled());
   assert.equal(await page.evaluate(()=>JSON.stringify(store)),storeBefore,'Sending never saves template changes');
   if(title==='Advance Payment')assert.equal((await page.evaluate(()=>paymentCalls)).length,1);
   else assert.deepEqual(calls.at(-1),preview,'Sent JSON matches preview exactly');
   await page.getByRole('button',{name:'Close',exact:true}).click();
  }
  await open('Pre-installation');
  await page.getByLabel('variables.input.projectDetails.freyrSiteEngineerName',{exact:true}).fill('Future run edit');
  const beforeSave=calls.length;
  await page.getByRole('button',{name:'Save for future runs',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Saved. Future runs'}).waitFor();assert.equal(calls.length,beforeSave,'Saving does not send');
  const stored=await page.evaluate(()=>store['fep-request-templates-v1'].preInstall.payload.variables.input.projectDetails.freyrSiteEngineerName);
  assert.equal(stored,'Future run edit');
  await page.getByRole('button',{name:'Review & send now',exact:true}).click();
  await page.getByLabel('Internal project ID',{exact:true}).fill('bad-id');
  await page.getByRole('button',{name:'Send request',exact:true}).click();
  await page.getByRole('status').filter({hasText:'24-character'}).waitFor();assert.equal(calls.length,beforeSave);
  await page.getByLabel('Internal project ID',{exact:true}).fill('6ae032225953f3972e343f5d');
  await page.getByLabel('System size (kW)',{exact:true}).fill('8.25');
  mode='wait';await page.getByRole('button',{name:'Send request',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-fep-tools]').shadowRoot.querySelector('button[data-sent]'));
  const count=calls.length;
  await page.evaluate(()=>{const root=document.querySelector('[data-fep-tools]').shadowRoot;[...root.querySelectorAll('button')].find(b=>b.textContent==='Send request').dispatchEvent(new MouseEvent('click'));});
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(calls.length,count);release();
  await page.getByRole('status').filter({hasText:'Request sent.'}).waitFor();assert.equal(calls.at(-1).variables.input.projectDetails.systemCapacity,8.25);
  assert.equal(await page.evaluate(()=>store['fep-request-templates-v1'].preInstall.payload.variables.input.projectDetails.systemCapacity),'{{systemSize}}');
  for(const next of ['graphql','http','network']){
   mode=next;await open('QC Form');await page.getByRole('button',{name:'Review & send now',exact:true}).click();await page.getByRole('button',{name:'Send request',exact:true}).click();
   await page.getByRole('status').filter({hasText:next==='network'?'Outcome unknown':'Request failed.'}).waitFor();
  }
  console.log('PASS: save-only and send-once separation, all five actions, exact preview/send match, current project values, manual one-time overrides, unsaved Back, duplicate/invalid protection, responses and errors. No live requests.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
