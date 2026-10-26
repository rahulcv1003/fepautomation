// Render the shared vector mark to Chrome's toolbar/extension icon sizes.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const mark=fs.readFileSync(path.join(__dirname,'icons/mark.svg'),'utf8');
  for(const size of [16,32,48,128]){
   await page.setViewportSize({width:size,height:size});
   await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${mark}`);
   await page.screenshot({path:path.join(__dirname,`icons/icon${size}.png`),omitBackground:true});
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
