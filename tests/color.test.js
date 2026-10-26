import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stellarColor} from '../src/star-color.js';
const stars=JSON.parse(fs.readFileSync('public/data/stars.json'));
test('catalogue color makes Vega blue-white and Betelgeuse orange',()=>{
 const vega=stellarColor(stars.find(s=>s.name==='Vega').bv).split(',').map(Number);
 const betelgeuse=stellarColor(stars.find(s=>s.name==='Betelgeuse').bv).split(',').map(Number);
 assert.ok(vega[2]>vega[0]);assert.ok(betelgeuse[0]>betelgeuse[1]&&betelgeuse[1]>betelgeuse[2]);
 assert.equal(stars.filter(s=>s.bv!=null).length,579);
});
test('missing colors are neutral, zero is valid, and extreme values remain valid RGB',()=>{
 for(const value of [null,undefined,'',' ',NaN])assert.equal(stellarColor(value),'245,245,245');
 assert.notEqual(stellarColor(0),'245,245,245');
 for(const value of [-10,10])for(const c of stellarColor(value).split(',').map(Number))assert.ok(c>=0&&c<=255);
});
