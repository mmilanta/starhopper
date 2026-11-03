import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {project,createSkyFrame,observerZenith} from '../src/game.js';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Use a fixed seasonal view with Betelgeuse near the center for click checks.
 await page.addInitScript(()=>localStorage.setItem('starhopper.observer',JSON.stringify({latitude:7,month:1})));
 await page.goto(process.env.TEST_URL || 'http://localhost:5173');await page.waitForSelector('#loading',{state:'detached'});
 const stars=JSON.parse(fs.readFileSync('public/data/stars.json')),s=stars.find(s=>s.name==='Betelgeuse');
 const box=await page.locator('#sky').boundingBox(),local=createSkyFrame(observerZenith(7,1)).toLocal(s.ra,s.dec),q=project(local.ra,local.dec,{ra:0,dec:90,fov:76},box.width,box.height);
 await page.mouse.click(box.x+q[0],box.y+q[1]);assert.equal(await page.evaluate(()=>document.activeElement.id),'guess');
 await page.keyboard.press('Escape');assert.ok(await page.locator('#guess-form').isHidden());await page.mouse.click(box.x+q[0],box.y+q[1]);
 await page.locator('#guess').fill('wrong');await page.locator('#guess-form .submit').click();assert.match(await page.locator('#feedback').textContent(),/Not quite/);assert.equal(await page.locator('#score').textContent(),'0');
 await page.locator('#guess').fill('Betelguese');await page.locator('#guess-form .submit').click();assert.match(await page.locator('#feedback').textContent(),/So close/);assert.equal(await page.locator('#score').textContent(),'0');
 await page.locator('#guess').fill('BETELGEUSE');await page.locator('#guess-form .submit').click();assert.equal(await page.locator('#score').textContent(),'1');assert.equal(await page.locator('#star-kind').textContent(),'Betelgeuse');assert.ok(await page.locator('.guess-input').isHidden());
 await page.reload();await page.waitForSelector('#loading',{state:'detached'});assert.equal(await page.locator('#score').textContent(),'1');
 // Wide layouts retain the score and Done action when the sidebar is closed.
 for(const width of [1440,900]){
  await page.setViewportSize({width,height:1000});
  const before=await page.locator('#sky').boundingBox();
  const captionBefore=await page.locator('.sky-caption').boundingBox();
  const toggleBefore=await page.locator('#review-toggle').boundingBox();
  assert.ok(toggleBefore.y>=captionBefore.y+captionBefore.height,'sidebar button sits below the coordinates');
  await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();
  assert.ok(await page.locator('#sidebar').isHidden());
  assert.ok(await page.locator('#compact-score').isVisible());
  assert.equal((await page.locator('#compact-score').textContent()).replace(/\s/g,''),'1/652');
  assert.equal(await page.locator('#review-toggle').getAttribute('aria-expanded'),'false');
  await page.waitForFunction(()=>document.querySelector('#sky').clientWidth===innerWidth);
  const after=await page.locator('#sky').boundingBox();
  const captionAfter=await page.locator('.sky-caption').boundingBox(),scoreBox=await page.locator('#compact-score').boundingBox();
  assert.equal(captionAfter.y-after.y,captionBefore.y-before.y,'coordinates stay at the same height');
  assert.ok(scoreBox.y>=captionAfter.y+captionAfter.height,'compact score sits below the coordinates');
  const toggleAfter=await page.locator('#review-toggle').boundingBox();
  assert.ok(toggleAfter.x+toggleAfter.width<=scoreBox.x,'sidebar button is left of the score');
  assert.equal(toggleAfter.y-after.y,toggleBefore.y-before.y,'sidebar button stays at the same height');
  assert.ok(after.width>before.width);
  const done=await page.locator('#done').boundingBox(),popup=await page.locator('.star-panel').boundingBox();
  assert.equal(done.x-after.x,28,'Done has equal left and bottom spacing');
  assert.equal(after.y+after.height-done.y-done.height,28);
  assert.equal(done.y+done.height,popup.y+popup.height,'Done aligns with the star popup');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/tmp/starhopper-sidebar-hidden-${width}.png`});
  await page.getByRole('button',{name:'Show sidebar',exact:true}).click();
  assert.ok(await page.locator('#sidebar').isVisible());
  assert.ok(await page.locator('#compact-score').isHidden());
 }
 await page.locator('#review-toggle').click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  await page.waitForFunction(()=>!document.querySelector('#sidebar').hidden);
  assert.ok(await page.locator('#review-toggle').isHidden(),'mobile top bar cannot be hidden');
  assert.ok(await page.locator('#done').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#sky').focus();await page.keyboard.press('+');
 await page.mouse.click(box.x+q[0],box.y+q[1]);
 await page.screenshot({path:'/tmp/starhopper-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/starhopper-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Without reduced motion, field notes fly to the star and finish centered on it.
 const motion=await browser.newPage({viewport:{width:1440,height:1000}});
 await motion.goto(process.env.TEST_URL || 'http://localhost:5173');await motion.waitForSelector('#loading',{state:'detached'});
 const vega=stars.find(s=>s.name==='Vega');await motion.evaluate(()=>localStorage.setItem('starhopper.discovered',JSON.stringify(['Vega'])));await motion.reload();await motion.waitForSelector('#loading',{state:'detached'});
 await motion.locator('.discovery').first().click();assert.doesNotMatch(await motion.locator('#coordinates').textContent(),/^18h/);
 await motion.waitForFunction(()=>/^18h 36m/.test(document.querySelector('#coordinates').textContent),null,{timeout:3000});assert.equal(await motion.locator('#star-kind').textContent(),'Vega');
 await motion.close();
 await page.locator('#help').click();assert.ok(await page.locator('#help-dialog').isVisible());await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('Browser checks passed: incorrect/correct guesses, no repeat points, reload persistence, zoom, mobile layout, help, near misses, fly-to; no runtime errors.');
}finally{await browser.close();}
