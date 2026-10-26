const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('https://uat-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:`
   <div class="ant-form-item"><label>Current Grid/Home Phase</label><div class="ant-select ant-select-show-search" data-testid="phase">
   <div class="ant-select-selector"><input aria-controls="phase_list" aria-expanded="false"><span class="ant-select-selection-item">1 Phase</span></div></div></div>
   <div class="ant-select-dropdown" style="display:none"><div id="phase_list" style="height:0;overflow:hidden">Virtual accessibility list</div><div class="ant-select-item-option"><span class="ant-select-item-option-content">3 Phase</span></div></div>
   <div class="ant-select" data-testid="other"><span class="ant-select-selection-item">Other field</span></div>
   <div class="ant-select-dropdown" style="display:none"><div class="ant-select-item-option">3 Phase</div></div>
   <script>
    const root=document.querySelector('[data-testid=phase]'), input=root.querySelector('input'), dropdown=document.querySelector('.ant-select-dropdown'), option=dropdown.querySelector('.ant-select-item-option');
    root.querySelector('.ant-select-selector').addEventListener('mousedown',()=>{dropdown.style.display='block';input.setAttribute('aria-expanded','true');});
    input.addEventListener('blur',()=>{dropdown.style.display='none';input.setAttribute('aria-expanded','false');});
    let mouseDown=false;
    option.addEventListener('mousedown',event=>{event.preventDefault();mouseDown=true;});
    option.addEventListener('click',()=>{
      if(!mouseDown||dropdown.style.display==='none')return;
      const replacement=root.cloneNode(true);replacement.querySelector('.ant-select-selection-item').textContent='3 Phase';replacement.querySelector('input').value='';
      setTimeout(()=>{root.replaceWith(replacement);dropdown.style.display='none';},100);
    });
   </script>`}));
  await page.goto('https://uat-fep.freyrenergy.com/proposal/123');
  await page.evaluate(()=>{
   window.rules=[{id:'phase',name:'Current Grid/Home Phase',enabled:true,path:'/proposal/*',host:location.hostname,value:'3 Phase',locator:{kind:'data-testid',value:'phase',type:'dropdown',count:1,occurrence:0}}];
   window.chrome={storage:{local:{get:async()=>({'fep-custom-fields-v1':window.rules})}}};
  });
  await page.addScriptTag({path:path.resolve(__dirname,'../custom-tools.js')});
  await page.evaluate(()=>FepCustomTools.manager());
  await page.getByRole('button',{name:'Test',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Filled: Current Grid/Home Phase'}).waitFor();
  assert.equal(await page.locator('[data-testid=phase] .ant-select-selection-item').textContent(),'3 Phase');
  assert.equal(await page.locator('[data-testid=phase] input').inputValue(),'');
  assert.equal(await page.locator('[data-testid=other] .ant-select-selection-item').textContent(),'Other field');
  assert(await page.getByRole('heading',{name:'Custom Field Builder',exact:true}).isVisible(),'Test must not close the manager through a synthetic Escape event');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  // Missing exact option must fail, even if the search input contains the requested text.
  await page.evaluate(()=>{window.rules[0].value='9 Phase';document.querySelector('[data-testid=phase] input').value='9 Phase';});
  const result=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));
  assert.equal(result[0].ok,false);
  assert.equal(await page.locator('[data-testid=phase] .ant-select-selection-item').textContent(),'3 Phase');
  await page.reload();
  await page.evaluate(()=>{
   window.rules=[{id:'phase',name:'Phase',enabled:true,path:'/proposal/*',host:location.hostname,value:'3 Phase',locator:{kind:'data-testid',value:'phase',type:'dropdown',count:1,occurrence:0}}];
   window.chrome={storage:{local:{get:async()=>({'fep-custom-fields-v1':window.rules})}}};
   const option=document.querySelector('.ant-select-item-option-content');option.textContent='Loading';
   document.querySelector('[data-testid=phase] input').addEventListener('input',()=>setTimeout(()=>{option.textContent='3 Phase';},100));
  });
  await page.addScriptTag({path:path.resolve(__dirname,'../custom-tools.js')});
  const searched=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));
  assert(searched[0].ok,'Search must keep the popup open until asynchronously loaded exact option is selected');
  assert.equal(await page.locator('[data-testid=phase] .ant-select-selection-item').textContent(),'3 Phase');
  console.log('PASS: 3 Phase committed with mouse sequence, virtualized dropdown ownership, asynchronous control replacement, no unrelated selection, manager stays open, search-only value rejected.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
