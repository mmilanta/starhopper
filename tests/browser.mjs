import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {project} from '../src/game.js';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL || 'http://localhost:5173');await page.waitForSelector('#loading',{state:'detached'});
 const stars=JSON.parse(fs.readFileSync('public/data/stars.json')),s=stars.find(s=>s.name==='Betelgeuse');
 const box=await page.locator('#sky').boundingBox(),q=project(s.ra,s.dec,{ra:84,dec:2,fov:76},box.width,box.height);
 await page.mouse.click(box.x+q[0],box.y+q[1]);
 const nearby=stars.map(s=>({s,q:project(s.ra,s.dec,{ra:84,dec:2,fov:76},box.width,box.height)})).filter(v=>v.q).map(v=>({...v,d:Math.hypot(v.q[0]-q[0],v.q[1]-q[1])})).filter(v=>v.d<18).sort((a,b)=>a.d-b.d);
 if(nearby.length>1)await page.locator('#nearby button').nth(nearby.findIndex(v=>v.s.name==='Betelgeuse')).click();await page.locator('#guess').fill('wrong');await page.locator('.submit').click();assert.match(await page.locator('#feedback').textContent(),/Not quite/);assert.equal(await page.locator('#score').textContent(),'0');
 await page.locator('#guess').fill('BETELGEUSE');await page.locator('.submit').click();assert.equal(await page.locator('#score').textContent(),'1');assert.match(await page.locator('#feedback').textContent(),/Betelgeuse/);assert.ok(await page.locator('.guess-input').isHidden());
 await page.reload();await page.waitForSelector('#loading',{state:'detached'});assert.equal(await page.locator('#score').textContent(),'1');
 await page.locator('#sky').focus();await page.keyboard.press('+');
 await page.screenshot({path:'/tmp/starhopper-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/starhopper-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#help').click();assert.ok(await page.locator('#help-dialog').isVisible());await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('Browser checks passed: incorrect/correct guesses, no repeat points, reload persistence, zoom, mobile layout, help; no runtime errors.');
}finally{await browser.close();}
