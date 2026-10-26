const { chromium }=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'content.js'),'utf8');
  const tracked=source.slice(source.indexOf('  async function runTrackedAutofill('),source.indexOf('  function normalize('));
  const order=[];
  const sandbox={performance,fieldTouchCount:0,recordAutofillRun:()=>order.push('record'),FepCustomTools:{beginAutofill:async()=>order.push('begin'),finishAutofill:async()=>order.push('finish-new-fields'),endAutofill:()=>order.push('end')}};
  vm.createContext(sandbox);vm.runInContext(tracked,sandbox);
  await sandbox.runTrackedAutofill('lead',async()=>order.push('built-in'));
  assert.deepEqual(order,['begin','built-in','finish-new-fields','end','record'],'Run lifecycle must not replay saved overrides after the workflow');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  try{
    const page=await context.newPage();page.setDefaultTimeout(8000);
    await page.route('https://uat-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>FEP test form</h1><label>Contact<input name="contact"></label>'}));
    await page.addInitScript(()=>{
      localStorage.setItem('fep-master-last-seen-version',JSON.stringify('1.1.2'));
      window.chrome={runtime:{getManifest:()=>({version:'1.1.2'})},storage:{local:{
        get:async(keys,callback)=>{const result={};for(const key of Array.isArray(keys)?keys:[keys])result[key]=JSON.parse(localStorage.getItem(key)||'null');callback?.(result);return result;},
        set:async(data)=>{for(const [key,value] of Object.entries(data))localStorage.setItem(key,JSON.stringify(value));}
      }}};
    });
    const inject=async()=>{await page.addStyleTag({path:path.join(root,'ui.css')});await page.addScriptTag({path:path.join(root,'custom-tools.js')});await page.addScriptTag({path:path.join(root,'content.js')});};
    await page.goto('https://uat-fep.freyrenergy.com/create-proposal/123');await inject();
    await page.locator('#fep-launcher').waitFor();
    await page.locator('#fep-launcher').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#fep-launcher').getAttribute('aria-expanded'),'true');
    const compact=await page.locator('#fep-popup').boundingBox();
    assert(compact.width<=265 && compact.height<=355,'Default panel should be compact');
    assert.equal(await page.locator('#fep-launcher').innerText(),'','Launcher should use an icon without a wordmark');
    await page.locator('#fep-popup').screenshot({path:path.join(root,'test-results/launcher-panel.png')});
    await page.locator('#fep-launcher').screenshot({path:path.join(root,'test-results/launcher-icon.png')});
    const grip=page.getByRole('button',{name:'Resize tools panel',exact:true});
    await grip.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
    const larger=await page.locator('#fep-popup').boundingBox();
    assert(larger.width>compact.width && larger.height>compact.height,'Panel resizes with keyboard');
    const corner=await grip.boundingBox();
    await page.mouse.move(corner.x+8,corner.y+7);await page.mouse.down();
    await page.mouse.move(corner.x-12,corner.y-13,{steps:4});await page.mouse.up();
    const dragged=await page.locator('#fep-popup').boundingBox();
    assert(dragged.width>larger.width && dragged.height>larger.height,'Panel resizes by dragging its corner');
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.locator('#fep-popup').screenshot({path:path.join(root,'test-results/settings-panel.png')});
    assert.equal(await page.getByText('Mascot',{exact:true}).count(),0);
    await page.getByRole('button',{name:'← Back',exact:true}).click();
    await page.setViewportSize({width:375,height:700});
    await page.keyboard.press('Escape');
    await page.locator('#fep-launcher').focus();await page.keyboard.press('Enter');
    const bounds=await page.locator('#fep-popup').boundingBox();
    assert(bounds.x>=0 && bounds.x+bounds.width<=375,'Tool panel stays inside narrow viewport');
    await page.setViewportSize({width:1280,height:900});
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
    const restored=await page.locator('#fep-popup').boundingBox();
    assert(Math.abs(restored.width-dragged.width)<2 && Math.abs(restored.height-dragged.height)<2,'Panel size persists after page reload');
    await page.getByRole('button',{name:'Custom Field Builder',exact:true}).click();
    await page.getByRole('button',{name:'Fill saved fields',exact:true}).click();
    await page.getByRole('heading',{name:'Custom autofill results'}).waitFor();
    assert.equal(await page.locator('input[name=contact]').inputValue(),'Persistent extension value');
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.locator('#fep-launcher').click();
    await page.getByRole('button',{name:'Feedback & feature requests',exact:true}).click();
    await page.getByRole('heading',{name:'Feedback & feature requests',exact:true}).waitFor();
    console.log('PASS: full content-script launcher integration, storage API integration, custom fill after reload, bug-report entry.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
