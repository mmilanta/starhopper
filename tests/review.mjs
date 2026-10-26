import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.labels=[];
  const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.labels.push({text,color:this.fillStyle});return original.call(this,text,...args);};
 });
 await page.goto(process.env.TEST_URL || 'http://localhost:5173');await page.waitForSelector('#loading',{state:'detached'});
 await page.evaluate(()=>localStorage.setItem('starhopper.discovered',JSON.stringify(['Vega'])));
 await page.reload();await page.waitForSelector('#loading',{state:'detached'});
 await page.locator('#done').click();assert.equal(await page.locator('.result').count(),652);
 assert.equal(await page.locator('.result.got').count(),1);assert.equal(await page.locator('.result.missed').count(),651);
 const mags=await page.locator('.result-mag').allTextContents();const numbers=mags.filter(v=>v!=='—').map(Number);assert.deepEqual(numbers,[...numbers].sort((a,b)=>a-b));assert.equal(mags.at(-1),'—');
 await page.evaluate(()=>window.labels=[]);await page.locator('.result[data-star="Vega"]').click();
 assert.equal(await page.locator('#star-kind').textContent(),'Vega');assert.ok(await page.locator('.guess-input').isHidden());
 let labels=await page.evaluate(()=>window.labels);assert.ok(labels.some(l=>l.text==='Vega'&&l.color==='#a9e9ce'));assert.ok(labels.some(l=>l.color==='#f5a964'));
 await page.locator('.result[data-star="Sirius"]').click();assert.equal(await page.locator('#star-kind').textContent(),'Sirius');assert.equal(await page.locator('#star-status').textContent(),'Missed');
 assert.match(await page.locator('#coordinates').textContent(),/06h/);assert.equal(await page.locator('#score').textContent(),'1');
 await page.locator('#guess-form').evaluate(form=>form.requestSubmit());assert.equal(await page.locator('#score').textContent(),'1');
 await page.screenshot({path:'/tmp/starhopper-review-desktop.png'});
 await page.reload();await page.waitForSelector('#loading',{state:'detached'});assert.ok(await page.locator('#review').isVisible());
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/starhopper-review-mobile.png'});
 await page.locator('.result[data-star="Vega"]').click();await page.locator('#done').click();assert.ok(await page.locator('#review').isHidden());assert.equal(await page.locator('#score').textContent(),'1');
 await page.evaluate(()=>window.labels=[]);await page.locator('#sky').focus();await page.keyboard.press('+');labels=await page.evaluate(()=>window.labels);assert.ok(!labels.some(l=>l.color==='#f5a964'));
 await page.locator('#done').click();assert.equal(await page.locator('#done').textContent(),'Resume');assert.ok(await page.locator('#restart').isVisible());
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('#restart').click();assert.equal(await page.locator('#score').textContent(),'1');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#restart').click();assert.equal(await page.locator('#score').textContent(),'0');assert.ok(await page.locator('#review').isHidden());assert.ok(await page.locator('#restart').isHidden());assert.equal(await page.locator('.discovery').count(),0);
 await page.reload();await page.waitForSelector('#loading',{state:'detached'});assert.equal(await page.locator('#score').textContent(),'0');assert.ok(await page.locator('#review').isHidden());
 assert.deepEqual(errors,[]);console.log('Review checks passed: all 652 sorted, got/missed counts, label colors, click-to-center, frozen score, persistence, mobile, resume, restart confirmation and persistence.');
}finally{await browser.close();}
