import {chromium} from 'playwright';
const b=await chromium.launch({channel:'msedge'}),p=await b.newPage({viewport:{width:1366,height:768}}); await p.goto('http://127.0.0.1:5184/?fast=1');
await p.locator('.workbench').waitFor();
if(await p.locator('.workbench .btn-primary').count()!==1)throw Error('primary count');
await p.getByRole('button',{name:'新建教学活动'}).click();await p.waitForURL(/plan/);
await p.getByRole('button',{name:'重命名活动'}).click();await p.waitForTimeout(50);
if(!await p.locator('#root').evaluate(e=>e.inert))throw Error('background not inert');
await p.keyboard.press('Escape');await p.waitForTimeout(50);if(await p.getByRole('dialog').count())throw Error('Escape');
if(await p.evaluate(()=>document.activeElement?.getAttribute('aria-label'))!=='重命名活动')throw Error('return focus');
await p.goto('http://127.0.0.1:5184/?fast=1#/');if(await p.locator('.lesson-row').count())throw Error('duplicate activity');
console.log('Phase 1: direct create, unique activity, one primary, modal inert/Escape/focus pass');await b.close();


