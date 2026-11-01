const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const project='6ae032225953f3972e343f5d';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(7000);
  let calls=[],mode='ok',release;
  await page.route('**/*',async route=>{
   const request=route.request();
   if(request.method()==='POST'){
    calls.push({url:request.url(),payload:request.postDataJSON()});
    if(mode==='wait')await new Promise(resolve=>release=resolve);
    if(mode==='network')return route.abort();
    if(mode==='plain')return route.fulfill({status:502,contentType:'text/plain',body:'Bad gateway'});
    return route.fulfill({status:mode==='http'?422:200,contentType:'application/json',body:JSON.stringify(mode==='graphql'?{errors:[{message:'QC rejected'}]}:{data:{saveQaForm:{message:'QC saved'}}})});
   }
   return route.fulfill({contentType:'text/html',body:'<h1>Project tracker</h1><span class="ant-tag">Installation</span><span class="ant-tag">Project ID : 2000009999</span><div class="ant-descriptions-item"><span class="ant-descriptions-item-label">System Size</span><span class="ant-descriptions-item-content">5.75 kW</span></div>'});
  });
  await page.addInitScript(()=>{
   localStorage.setItem('fep-master-last-seen-version',JSON.stringify('1.0.5'));
   window.chrome={runtime:{getManifest:()=>({version:'1.0.5'})},storage:{local:{
    get:async(keys,callback)=>{const result={};for(const key of Array.isArray(keys)?keys:[keys])result[key]=JSON.parse(localStorage.getItem(key)||'null');callback?.(result);return result;},
    set:async data=>{for(const [key,value]of Object.entries(data))localStorage.setItem(key,JSON.stringify(value));}
   }}};
  });
  const inject=async()=>{await page.addStyleTag({path:path.join(root,'ui.css')});for(const name of ['custom-tools.js','payment-tools.js','request-defaults.js','request-tools.js','content.js'])await page.addScriptTag({path:path.join(root,name)});};
  const button=()=>page.getByRole('button',{name:'Fill QC Form',exact:true});
  for(const [front,api] of [['uat-fep','uat-fep-api'],['qa-fep','qa-fep-api'],['stg-fep','stg-fep-api'],['fep','fep-api']]){
   await page.goto(`https://${front}.freyrenergy.com/SE/project-tracker/project-details/${project}`);await inject();
   await button().waitFor();
   assert.deepEqual(await page.locator('#fep-pre-install-btn, #fep-post-install-btn, #fep-qc-btn').allTextContents(),['Fill Pre Installation Form','Fill Post Installation Form','Fill QC Form']);
   await button().click();await page.getByText('✓ QC form submitted',{exact:true}).waitFor();
   const call=calls.at(-1);assert.equal(call.url,`https://${api}.freyrenergy.com:444/api/v1/graphql`);
   assert.equal(call.payload.variables.input.project,project);assert.equal(call.payload.variables.input.projectDetails.projectId,2000009999);
   assert(!Object.hasOwn(call.payload.variables.input.projectDetails,'uniqueId'));
   assert(call.payload.query.includes('saveQaForm'));assert.equal(call.payload.variables.input.isLastPage,true);
   assert.equal(call.payload.variables.input.projectDetails.quanlityAssessmentParameters.plantInstalledPerDPR,'Yes');
   assert.equal(call.payload.variables.input.media.civilFoundation.length,1);
   await page.getByRole('button',{name:'Fill Pre Installation Form',exact:true}).click();
   await page.getByText('✓ Pre-Install form submitted',{exact:true}).waitFor();
   const pre=calls.at(-1);assert.equal(pre.url,`https://${api}.freyrenergy.com:444/api/v1/graphql`);
   const input=pre.payload.variables.input;
   assert(pre.payload.query.includes('savePreInstallationForm'));
   assert.equal(input.project,project);assert.equal(input.projectDetails.uniqueId,2000009999);
   assert.equal(input.projectDetails.systemCapacity,5.75,'System capacity comes from this page, not the sample');
   assert.equal(input.projectDetails.projectName,'CustomerB Support Module_residential_independent');
   assert.equal(input.projectDetails.dateOfFormSubmission,'2026-10-30');
   assert.equal(input.customerDetails.phoneNumberOfClient,'2111122221');
   assert.equal(input.customerDetails.vendorCompanyName,null);
   assert.equal(input.ppeAcknowledgedAt,1793364674328);assert.equal(input.isLastPage,true);
   assert.equal(Object.keys(input.media).length,7);assert.equal(input.media.preInstallationSiteVideo[0].type,'video/quicktime');
   assert(input.media.geoTaggedSitePhoto[0].content.endsWith('-%281%291793364817447.png'));
   await page.getByRole('button',{name:'Fill Post Installation Form',exact:true}).click();
   await page.getByText('✓ Post-Install form submitted',{exact:true}).waitFor();
   const post=calls.at(-1);assert.equal(post.url,`https://${api}.freyrenergy.com:444/api/v1/graphql`);
   const expected=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/post-installation.json'),'utf8'));
   expected.variables.input.project=project;
   expected.variables.input.projectDetails.uniqueId=2000009999;
   expected.variables.input.projectDetails.systemCapacity=5.75;
   assert.deepEqual(post.payload,expected,'Complete supplied post-installation payload preserved with current project IDs and capacity');
   assert.equal(post.payload.variables.input.media.moduleInstalliationPhoto[0].extractedInfo.fields.latitude,'13.59350');
   assert(!Object.hasOwn(post.payload.variables.input.customerDetails,'freyrEnergyEngineersAssistance'),'Removed fields are not restored from old defaults');
  }
  // Save and reuse a QC override on the real injected action.
  await page.evaluate(()=>FepRequestTools.open());
  await page.getByRole('button',{name:'QC Form',exact:true}).click();
  await page.getByLabel('variables.input.projectDetails.engineerName',{exact:true}).fill('Edited QC engineer');
  await page.getByRole('button',{name:'Save for future runs',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved. Future runs'}).waitFor();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.reload();await inject();await button().click();await page.getByText('✓ QC form submitted',{exact:true}).waitFor();
  assert.equal(calls.at(-1).payload.variables.input.projectDetails.engineerName,'Edited QC engineer');
  await page.screenshot({path:path.join(root,'test-results/qc-form-buttons.png')});
  mode='graphql';await button().click();await page.getByText('✗ QC form failed',{exact:true}).waitFor();await page.getByText('QC rejected',{exact:true}).waitFor();
  mode='http';await button().click();await page.getByText('✗ QC form failed',{exact:true}).waitFor();
  mode='plain';await button().click();await page.getByText('✗ QC form error',{exact:true}).waitFor();
  mode='network';await button().click();await page.getByText('✗ QC form error',{exact:true}).waitFor();await button().waitFor();assert(await button().isEnabled());
  mode='wait';const before=calls.length;await button().click();
  await page.waitForFunction(()=>document.getElementById('fep-qc-btn').disabled);
  await page.evaluate(()=>document.getElementById('fep-qc-btn').dispatchEvent(new MouseEvent('click')));
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(calls.length,before+1);release();
  await page.getByText('✓ QC form submitted',{exact:true}).waitFor();
  const count=calls.length;await page.locator('.ant-tag').filter({hasText:'Project ID'}).evaluate(node=>node.remove());
  await button().click();await page.getByText('Could not find numeric Project ID on this page.',{exact:true}).waitFor();assert.equal(calls.length,count);
  assert.equal(await page.locator('#fep-qc-btn').count(),1,'Mutation observer does not duplicate QC buttons');
  console.log('PASS: QC, updated Pre Installation and complete supplied Post Installation across all four API environments; dynamic project IDs/system size, supplied payload/media, QC overrides/errors/duplicate protection/missing IDs. All requests simulated.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
