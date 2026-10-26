const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.route('https://uat-fep.freyrenergy.com/**',route=>route.fulfill({contentType:'text/html',body:`
      <label>Roof area<input name="roof" role="spinbutton" class="ant-input-number-input"></label>
      <label>Native number<input name="native" type="number"></label>
      <label>Customer code<input name="code"></label>
      <label>Limited number<input name="limited" role="spinbutton"></label>
      <label>Delayed control<input name="delayed" role="spinbutton"></label>
      <script>
        document.querySelector('[name=roof]').addEventListener('input',event=>event.target.value=String(Number(event.target.value)));
        document.querySelector('[name=limited]').addEventListener('input',event=>event.target.value='10');
        document.querySelector('[name=delayed]').addEventListener('input',event=>{const original=event.target;setTimeout(()=>{const replacement=original.cloneNode();replacement.value='10';original.replaceWith(replacement);},120);});
      </script>`}));
    await page.goto('https://uat-fep.freyrenergy.com/create-proposal/123');
    await page.evaluate(()=>{window.chrome={storage:{local:{get:async()=>({'fep-custom-fields-v1':window.testRules})}}};});
    await page.addScriptTag({path:path.resolve(__dirname,'../custom-tools.js')});
    const run=async(name,value)=>page.evaluate(async({name,value})=>{
      document.querySelector('[data-fep-tools]')?.remove();
      window.testRules=[{id:name,name,enabled:true,path:'/create-proposal/*',host:location.hostname,value,locator:{kind:'name',value:name,type:'text',count:1,occurrence:0}}];
      return FepCustomTools.fillSaved({silent:true});
    },{name,value});
    assert((await run('roof','0123456'))[0].ok,'Ant numeric leading-zero normalization is accepted');
    assert.equal(await page.locator('[name=roof]').inputValue(),'123456');
    assert((await run('roof','0012.500'))[0].ok,'Equivalent decimals are accepted');
    assert((await run('native','00123'))[0].ok,'Native numeric inputs still work');
    assert((await run('code','00123'))[0].ok,'Text leading zeroes are preserved');
    assert.equal(await page.locator('[name=code]').inputValue(),'00123');
    assert(!(await run('limited','123'))[0].ok,'A different numeric value is rejected');
    assert(!(await run('delayed','123'))[0].ok,'Delayed React-style replacement and rejection are detected');
    assert(!(await run('native','not a number'))[0].ok,'Invalid numeric input is rejected');
    assert(!(await run('roof',''))[0].ok,'Empty value must not be confused with normalized zero');
    console.log('PASS: numeric leading zeros, decimals, native numbers, exact text preservation, genuine rejection, delayed input replacement, invalid and empty values.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
