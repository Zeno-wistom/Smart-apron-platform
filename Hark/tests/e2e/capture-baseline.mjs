import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const browser=await chromium.launch({channel:'msedge'});
const out='docs/ux/before'; mkdirSync(out,{recursive:true});
const envelope=JSON.parse(readFileSync('tests/e2e/legacy-envelope.json','utf8'));
const ctx=await browser.newContext(); const page=await ctx.newPage();
await page.addInitScript(env=>localStorage.setItem('smart-apron:hark:v1',JSON.stringify(env)),envelope);
await page.goto('http://127.0.0.1:5174/?fast=1');
await page.evaluate(env=>localStorage.setItem('smart-apron:hark:v1',JSON.stringify(env)),envelope);
const id=envelope.data.activities[0].id;const metrics=[];
for(const [width,height] of [[1440,900],[1366,768],[1024,768],[390,844]]){
 await page.setViewportSize({width,height});
 for(const route of ['','plan','story','review','class']){
 await page.goto('http://127.0.0.1:5174/?fast=1#/'+(route?`activities/${id}/${route}`:''));await page.waitForTimeout(180);
 metrics.push({width,route,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,chrome:[...document.querySelectorAll('.topbar,.stagebar')].reduce((a,e)=>a+e.getBoundingClientRect().height,0),editor:document.querySelector('.editor-inner')?.getBoundingClientRect().width,minFont:Math.min(...[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize)))}))});
 await page.screenshot({path:`${out}/${width}-${route||'workbench'}.png`});}
}
const corrupt=await browser.newPage(); await corrupt.addInitScript(()=>localStorage.setItem('smart-apron:hark:v1','{broken'));await corrupt.goto('http://127.0.0.1:5174/');await corrupt.screenshot({path:out+'/corrupt.png'});
writeFileSync(out+'/metrics.json',JSON.stringify(metrics,null,2)); await browser.close();
