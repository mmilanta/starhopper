import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {project} from '../src/game.js';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL || 'http://localhost:5173');await page.waitForSelector('#loading',{state:'detached'});
 const stars=JSON.parse(fs.readFileSync('public/data/stars.json')),s=stars.find(s=>s.name==='Betelgeuse');
 const box=await page.locator('#sky').boundingBox(),q=project(s.ra,s.dec,{ra:84,dec:2,fov:76},box.width,box.height);
 await page.mouse.click(box.x+q[0],box.y+q[1]);assert.equal(await page.evaluate(()=>document.activeElement.id),'guess');
 await page.keyboard.press('Escape');assert.ok(await page.locator('#guess-form').isHidden());await page.mouse.click(box.x+q[0],box.y+q[1]);
 await page.locator('#guess').fill('wrong');await page.locator('.submit').click();assert.match(await page.locator('#feedback').textContent(),/Not quite/);assert.equal(await page.locator('#score').textContent(),'0');
 await page.locator('#guess').fill('Betelguese');await page.locator('.submit').click();assert.match(await page.locator('#feedback').textContent(),/So close/);assert.equal(await page.locator('#score').textContent(),'0');
 await page.locator('#guess').fill('BETELGEUSE');await page.locator('.submit').click();assert.equal(await page.locator('#score').textContent(),'1');assert.equal(await page.locator('#star-kind').textContent(),'Betelgeuse');assert.ok(await page.locator('.guess-input').isHidden());
 await page.reload();await page.waitForSelector('#loading',{state:'detached'});assert.equal(await page.locator('#score').textContent(),'1');
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
