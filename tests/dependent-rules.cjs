const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function dropdown(id,label,options){return `<div class="ant-form-item"><div class="ant-form-item-label"><label>${label}</label></div><div class="ant-select" data-testid="${id}"><div class="ant-select-selector"><input readonly aria-controls="${id}_list"><span class="ant-select-selection-item"></span></div></div></div><div class="ant-select-dropdown" style="display:none"><div id="${id}_list">${options.map(text=>`<div class="ant-select-item-option"><span class="ant-select-item-option-content">${text}</span></div>`).join('')}</div></div>`;}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(12000);
  const html=dropdown('discom','DISCOM',['Utility'])+'<div class="ant-form-item"><div class="ant-form-item-label"><label>Current Contract Load</label></div><input name="load"></div>'+dropdown('phase','Current Grid/Home Phase',['1 Phase','3 Phase'])+'<label>New dependent field<input name="new-field"></label>'+dropdown('size','Required Solar System Size',['Size for 1 Phase'])+dropdown('inverter','Required Solar Inverter Phase',['1'])+'<div class="ant-form-item"><div class="ant-form-item-label"><label>Available Roof Area</label></div><input name="roof"></div><div class="ant-form-item"><div class="ant-form-item-label"><label>Grid tariff</label></div><input name="tariff"></div>';
  await page.route('https://uat-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto('https://uat-fep.freyrenergy.com/create-proposal/123');
  await page.evaluate(()=>{
   window.events=[];
   document.querySelectorAll('.ant-select').forEach(root=>{
    const id=root.dataset.testid, list=document.getElementById(id+'_list'), popup=list.parentElement;
    root.querySelector('.ant-select-selector').onmousedown=()=>{popup.style.display='block';};
    list.onclick=event=>{const option=event.target.closest('.ant-select-item-option');if(!option)return;const value=option.textContent;root.querySelector('.ant-select-selection-item').textContent=value;popup.style.display='none';events.push(id+':'+value);
     if(id==='phase'){document.getElementById('size_list').innerHTML='<div class="ant-select-item-option"><span class="ant-select-item-option-content">Size for '+value+'</span></div>';document.querySelector('[data-testid=size] .ant-select-selection-item').textContent='';document.getElementById('inverter_list').innerHTML='<div class="ant-select-item-option"><span class="ant-select-item-option-content">'+value[0]+'</span></div>';}
    };
   });
   document.querySelector('[name=new-field]').oninput=event=>events.push('new:'+event.target.value);
   document.querySelector('[name=roof]').oninput=event=>events.push('roof:'+event.target.value);
   const rule=(id,value,type='text')=>({id,name:id,enabled:true,path:'/create-proposal/*',host:location.hostname,value,locator:{kind:type==='dropdown'?'data-testid':'name',value:id,type,count:1,occurrence:0}});
   window.savedRules=[rule('phase','3 Phase','dropdown'),rule('new-field','42'),rule('roof','123456')];
   window.chrome={runtime:{getManifest:()=>({version:'1.2.2'})},storage:{local:{get:async(keys,callback)=>{const data={'fep-custom-fields-v1':savedRules,'fep-master-last-seen-version':'1.2.2'};callback?.(data);return data;},set:async()=>{}}}};
  });
  const root=path.resolve(__dirname,'..');
  await page.addStyleTag({path:path.join(root,'ui.css')});
  await page.addScriptTag({path:path.join(root,'custom-tools.js')});
  await page.addScriptTag({path:path.join(root,'payment-tools.js')});await page.addScriptTag({path:path.join(root,'content.js')});
  for(let run=0;run<2;run++){
   await page.locator('#fep-launcher').click();
   await page.getByRole('button',{name:'Auto Fill Details',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('[name=tariff]').value==='7');
   await page.waitForTimeout(300);
   const events=await page.evaluate(()=>window.events);
   assert(!events.includes('phase:1 Phase'),'Built-in phase must never be selected before custom phase');
   assert(!events.includes('roof:5000000'),'Built-in roof default must never be applied');
   assert.equal(events.filter(event=>event==='phase:3 Phase').length,run+1,'Parent rule must run exactly at its step, once per run');
   assert(events.indexOf('new:42')<events.indexOf('size:Size for 3 Phase'),'New custom field must run before its downstream step');
   assert.equal(await page.locator('[data-testid=size] .ant-select-selection-item').textContent(),'Size for 3 Phase');
   assert.equal(await page.locator('[data-testid=inverter] .ant-select-selection-item').textContent(),'3');
   assert.equal(await page.locator('[name=roof]').inputValue(),'123456');
   await page.locator('[name=tariff]').fill('');
  }
  // An unavailable override must stop the run before dependent defaults execute.
  await page.evaluate(()=>{savedRules[0].value='9 Phase';window.events=[];});
  await page.locator('#fep-launcher').click();await page.getByRole('button',{name:'Auto Fill Details',exact:true}).click();
  await page.locator('#fep-api-toast').filter({hasText:'Autofill stopped'}).waitFor();
  assert(!(await page.evaluate(()=>events)).some(event=>event.startsWith('size:')));
  console.log('PASS: real proposal workflow uses custom phase before dependent size/inverter, overrides roof without default, inserts new field inline, repeats correctly, and stops on rejected override.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
