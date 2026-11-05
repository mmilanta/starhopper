import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {project,createSkyFrame,observerZenith} from '../src/game.js';

const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
const url=process.env.TEST_URL||'http://localhost:5173';
const star=JSON.parse(fs.readFileSync('public/data/stars.json')).find(star=>star.name==='Betelgeuse');
async function selectStar(page){
 const box=await page.locator('#sky').boundingBox();
 const local=createSkyFrame(observerZenith(7,1)).toLocal(star.ra,star.dec);
 const point=project(local.ra,local.dec,{ra:0,dec:90,fov:76},box.width,box.height);
 await page.mouse.click(box.x+point[0],box.y+point[1]);
}
async function guess(page,value){await page.locator('#guess').fill(value);await page.locator('#guess-form .submit').click();}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('starhopper.observer',JSON.stringify({latitude:7,month:1})));
 // Stub ingestion: these tests must never send synthetic player data to production.
 await context.route('https://gc.zgo.at/count.js',route=>route.fulfill({contentType:'application/javascript',body:'window.recordedGuesses=[];window.goatcounter={count:event=>window.recordedGuesses.push(event)};'}));
 await context.route('https://mmilanta.goatcounter.com/**',route=>route.abort());
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url);await page.waitForSelector('#loading',{state:'detached'});
 assert.equal(await page.locator('#goatcounter').getAttribute('data-goatcounter'),'https://mmilanta.goatcounter.com/count');
 await page.waitForFunction(()=>typeof window.goatcounter?.count==='function');
 await selectStar(page);
 await guess(page,'   ');
 assert.equal(await page.evaluate(()=>recordedGuesses.length),0);
 await guess(page,'wrong');await guess(page,'wrong');await guess(page,'Betelguese');await guess(page,'BETELGEUSE');
 const events=await page.evaluate(()=>recordedGuesses);
 const id=await page.evaluate(()=>localStorage.getItem('starhopper.player-id'));
 assert.deepEqual(events.map(event=>event.path),['incorrect','incorrect','near-miss','correct'].map(result=>`starhopper/guess/Betelgeuse/${result}/player/${id}`));
 assert.ok(events.every(event=>event.event&&event.no_session));
 assert.ok(!JSON.stringify(events).includes('wrong'));
 await page.locator('#guess-form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 assert.equal(await page.evaluate(()=>recordedGuesses.length),4,'solved star cannot be counted twice');
 await page.reload();await page.waitForSelector('#loading',{state:'detached'});
 assert.equal(await page.evaluate(()=>localStorage.getItem('starhopper.player-id')),id);
 assert.equal(await page.locator('#score').textContent(),'1');
 assert.equal(await page.evaluate(()=>recordedGuesses.length),0,'restored discoveries are not backfilled');
 await page.locator('#done').click();
 assert.equal(await page.evaluate(()=>recordedGuesses.length),0,'revealing does not count guesses');
 page.on('dialog',dialog=>dialog.accept());
 await page.locator('#restart').click();
 await selectStar(page);await guess(page,'Betelgeuse');
 assert.equal(await page.evaluate(()=>recordedGuesses[0].path),`starhopper/guess/Betelgeuse/correct/player/${id}`);
 assert.equal(await page.locator('#score').textContent(),'1');
 await page.locator('#help').click();assert.match(await page.locator('#help-dialog').textContent(),/random ID saved in this browser/);
 assert.deepEqual(errors,[]);
 await context.close();

 const blocked=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await blocked.addInitScript(()=>localStorage.setItem('starhopper.observer',JSON.stringify({latitude:7,month:1})));
 await blocked.route('https://gc.zgo.at/**',route=>route.abort());
 const blockedPage=await blocked.newPage();
 blockedPage.on('pageerror',error=>errors.push(error.message));
 await blockedPage.goto(url);await blockedPage.waitForSelector('#loading',{state:'detached'});
 await selectStar(blockedPage);await guess(blockedPage,'Betelgeuse');
 assert.equal(await blockedPage.locator('#score').textContent(),'1','blocked analytics must not affect scoring');
 assert.deepEqual(errors,[]);
 await blocked.close();
 console.log('Analytics browser checks passed: attempts, player persistence, restart, no backfill, help disclosure, and blocked tracking.');
}finally{await browser.close();}
