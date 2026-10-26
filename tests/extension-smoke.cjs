const { chromium }=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  try{
    const page=await context.newPage();page.setDefaultTimeout(8000);
    await page.route('https://uat-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>FEP test form</h1><label>Contact<input name="contact"></label>'}));
    await page.addInitScript(()=>{
      localStorage.setItem('fep-master-last-seen-version',JSON.stringify('1.0.4'));
      window.chrome={runtime:{getManifest:()=>({version:'1.0.4'})},storage:{local:{
        get:async(keys,callback)=>{const result={};for(const key of Array.isArray(keys)?keys:[keys])result[key]=JSON.parse(localStorage.getItem(key)||'null');callback?.(result);return result;},
        set:async(data)=>{for(const [key,value] of Object.entries(data))localStorage.setItem(key,JSON.stringify(value));}
      }}};
    });
    const inject=async()=>{await page.addScriptTag({path:path.join(root,'custom-tools.js')});await page.addScriptTag({path:path.join(root,'content.js')});};
    await page.goto('https://uat-fep.freyrenergy.com/test-form');await inject();
    await page.locator('#fep-launcher').waitFor();
    await page.locator('#fep-launcher').click();
    await page.getByRole('button',{name:'Custom Field Builder',exact:true}).click();
    await page.getByRole('button',{name:'Pick a field on this page'}).click();
    await page.locator('input[name=contact]').click();
    await page.getByLabel('Value to fill').fill('Persistent extension value');
    await page.getByRole('button',{name:'Save rule',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Rule saved'}).waitFor();
    const saved=await page.evaluate(async()=>chrome.storage.local.get('fep-custom-fields-v1'));
    assert.equal(saved['fep-custom-fields-v1'][0].value,'Persistent extension value');
    await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await inject();
    await page.locator('#fep-launcher').click();
    await page.getByRole('button',{name:'Custom Field Builder',exact:true}).click();
    await page.getByRole('button',{name:'Fill saved fields',exact:true}).click();
    await page.getByRole('heading',{name:'Custom autofill results'}).waitFor();
    assert.equal(await page.locator('input[name=contact]').inputValue(),'Persistent extension value');
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.locator('#fep-launcher').click();
    await page.getByRole('button',{name:'Report a bug',exact:true}).click();
    await page.getByRole('heading',{name:'Report a bug',exact:true}).waitFor();
    console.log('PASS: full content-script launcher integration, storage API integration, custom fill after reload, bug-report entry.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
