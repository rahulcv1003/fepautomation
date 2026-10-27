const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fixture = `<!doctype html><html><body style="font-family:system-ui;padding:30px">
<h1>Project details</h1>
<label>Customer category<select name="category"><option value="commercial">Commercial</option><option value="residential">Residential</option></select></label>
<p><label>Contact name<input name="contact" value="Original"></label></p>
<p><label>Visit date<input type="date" name="visit"></label></p>
<p><label><input type="checkbox" name="approved"> Approved</label></p>
<p><label>Notes<textarea name="notes"></textarea></label></p>
<p><label>Password<input type="password" name="secret"></label></p>
<p><label><input type="radio" name="funding" value="cash"> Cash</label><label><input type="radio" name="funding" value="loan"> Loan</label></p>
<div class="ant-form-item"><div class="ant-form-item-label"><label>DISCOM</label></div>
<div class="ant-select" data-testid="discom"><div class="ant-select-selector">Select DISCOM</div><input aria-controls="options" readonly><span class="ant-select-selection-item"></span></div></div>
<div class="ant-select-dropdown" style="display:none"><div id="options"><div class="ant-select-item-option"><div class="ant-select-item-option-content">Southern Power</div></div></div></div>
<script>document.querySelector('.ant-select-selector').onmousedown=()=>document.querySelector('.ant-select-dropdown').style.display='block';document.querySelector('.ant-select-item-option').onclick=()=>{document.querySelector('.ant-select-selection-item').textContent='Southern Power';document.querySelector('.ant-select-dropdown').style.display='none';};</script>
</body></html>`;
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.setDefaultTimeout(8000);
    const errors=[];page.on('pageerror', error=>errors.push(error.message));
    await page.route('https://uat-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    await page.route('https://qa-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    await page.addInitScript(() => {
      globalThis.chrome={runtime:{getManifest:()=>({version:'1.2.0'})},storage:{local:{
        get:async key=>({[key]:JSON.parse(localStorage.getItem(key)||'[]')}),
        set:async data=>{for(const [key,value] of Object.entries(data))localStorage.setItem(key,JSON.stringify(value));}
      }}};
      window.open=(url)=>{window.lastReport=url;return null;};
    });
    const inject=()=>page.addScriptTag({path:path.resolve(__dirname,'../custom-tools.js')});
    await page.goto('https://uat-fep.freyrenergy.com/project/123/details');await inject();
    async function add(selector,value) {
      console.log("Picking", selector);
      await page.evaluate(()=>FepCustomTools.manager());
      await page.getByRole('button',{name:'Pick a field on this page'}).click();
      await page.locator(selector).click();
      if(await page.getByLabel('Exact option text').count())await page.getByLabel('Exact option text').fill(value);
      else if(await page.getByLabel('Value to fill').count())await page.getByLabel('Value to fill').fill(value);
      else await page.getByLabel('Value',{exact:true}).selectOption(value);
      await page.getByRole('button',{name:'Save rule',exact:true}).click();
      await page.getByRole('status').filter({hasText:'Rule saved'}).waitFor();
    }
    await add('input[name=contact]','Custom Customer');
    await add('select[name=category]','Residential');
    await add('input[name=visit]','2026-11-15');
    await add('input[name=approved]','true');
    await add('textarea[name=notes]','A saved note');
    await add('.ant-select-selector','Southern Power');
    await add('input[value=loan]','true');
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.locator('input[name=contact]').fill('Default');
    await page.locator('select[name=category]').selectOption('commercial');
    await page.locator('input[name=approved]').uncheck();
    let results=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));
    assert.equal(results.length,7);assert(results.every(item=>item.ok),JSON.stringify(results));
    assert.equal(await page.locator('input[name=contact]').inputValue(),'Custom Customer');
    assert.equal(await page.locator('select[name=category]').inputValue(),'residential');
    assert.equal(await page.locator('input[name=visit]').inputValue(),'2026-11-15');
    assert(await page.locator('input[name=approved]').isChecked());
    await page.goto('https://uat-fep.freyrenergy.com/project/456/details');await inject();
    results=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));
    assert.equal(results.filter(item=>item.ok).length,7,'Rules persist and numeric IDs are generalized');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('fep-custom-fields-v1')));
    await page.goto('https://qa-fep.freyrenergy.com/project/456/details');await inject();
    await page.evaluate(items=>localStorage.setItem('fep-custom-fields-v1',JSON.stringify(items)),saved);
    results=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));assert.equal(results.length,0,'UAT-only rules must not fill QA');
    await page.evaluate(()=>{const items=JSON.parse(localStorage.getItem('fep-custom-fields-v1'));items[0].host='*';localStorage.setItem('fep-custom-fields-v1',JSON.stringify(items));});
    results=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));assert.equal(results.length,1,'All-environment rule should fill QA');
    await page.goto('https://uat-fep.freyrenergy.com/other');await inject();
    results=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));assert.equal(results.length,0,'Different page must not fill');
    await page.goto('https://uat-fep.freyrenergy.com/project/456/details');await inject();
    await page.evaluate(()=>document.querySelector('input[name=contact]').remove());
    results=await page.evaluate(()=>FepCustomTools.fillSaved({silent:true}));assert(results.some(item=>!item.ok && item.name==='Contact name'),'Missing field is reported');
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.evaluate(()=>FepCustomTools.manager());
    const row=page.locator('.rule').filter({has:page.getByText('Customer category',{exact:true})});
    await row.getByRole('button',{name:'Disable',exact:true}).click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fep-custom-fields-v1')).find(item=>item.name==='Customer category').enabled),false);
    const note=page.locator('.rule').filter({has:page.getByText('Notes',{exact:true})});
    await note.getByRole('button',{name:'Edit',exact:true}).click();
    await page.getByLabel('Value to fill').fill('Edited value');
    await page.getByRole('button',{name:'Save rule',exact:true}).click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fep-custom-fields-v1')).find(item=>item.name==='Notes').value),'Edited value');
    await page.locator('.rule').filter({has:page.getByText('Notes',{exact:true})}).getByRole('button',{name:'Delete',exact:true}).click();
    await page.getByRole('button',{name:'Delete rule',exact:true}).click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fep-custom-fields-v1')).some(item=>item.name==='Notes')),false);
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.evaluate(()=>FepCustomTools.report());
    await page.getByLabel('Feedback type').selectOption('Feature');
    await page.getByLabel('Short summary').fill('Dropdown did not fill');
    await page.getByLabel('Steps to reproduce / proposed workflow').fill('Open form and click Autofill');
    await page.getByLabel('Expected result / desired improvement').fill('Residential selected');
    await page.getByLabel('Current behavior / problem to solve').fill('Dropdown stayed empty');
    await page.getByRole('button',{name:'Review report on GitHub'}).click();
    const report=new URL(await page.evaluate(()=>lastReport));
    assert.equal(report.pathname,'/rahulcv1003/fepautomation/issues/new');
    assert.equal(report.searchParams.get('template'),'bug_report.yml');
    assert.equal(report.searchParams.get('title'),'[Feature] Dropdown did not fill');
    assert(report.searchParams.get('report').includes('Dropdown stayed empty'));
    assert(!report.href.includes('456'));assert(!report.href.includes('Custom Customer'));
    await page.screenshot({path:path.resolve(__dirname,'../test-results/bug-report.png')});
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.evaluate(()=>FepCustomTools.manager());
    await page.screenshot({path:path.resolve(__dirname,'../test-results/custom-fields.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS: native text, textarea, dropdown, date, checkbox, Ant dropdown; picker/save; persisted routes; missing fields; disable; report prefill and privacy; screenshots.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
