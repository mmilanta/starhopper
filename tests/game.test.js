import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalize,matches,readProgress,project} from '../src/game.js';
const stars=JSON.parse(fs.readFileSync('public/data/stars.json'));
test('complete catalogue has unique names and valid coordinates',()=>{assert.equal(stars.length,652);assert.equal(new Set(stars.map(s=>s.id)).size,652);for(const s of stars){assert.ok(Number.isFinite(s.ra)&&s.ra>=0&&s.ra<360);assert.ok(Number.isFinite(s.dec)&&Math.abs(s.dec)<=90);assert.ok(s.mag===null||Number.isFinite(s.mag));}});
test('proper names tolerate case, accents, spaces and punctuation without fuzzy false positives',()=>{assert.equal(normalize('  Áldu! '),'aldu');assert.ok(matches({name:'Batsũ̀',aliases:[]},'batsu'));assert.ok(matches({name:'Gajahmina',aliases:['Gajamina']},'Gajamina'));assert.equal(matches({name:'Sirius',aliases:[]},'Siruis'),false);});
test('progress rejects corrupted data and unknown ids and deduplicates',()=>{for(const value of ['null','{}','broken'])assert.equal(readProgress({getItem:()=>value},stars).size,0);assert.deepEqual([...readProgress({getItem:()=>JSON.stringify(['Sirius','Sirius','fake'])},stars)],['Sirius']);});
test('projection centers target, wraps right ascension and hides opposite hemisphere',()=>{assert.deepEqual(project(84,2,{ra:84,dec:2,fov:76},800,600),[400,300]);assert.equal(project(264,-2,{ra:84,dec:2,fov:76},800,600),null);const p=project(359,0,{ra:1,dec:0,fov:76},800,600);assert.ok(Math.abs(p[0]-400)<20);});

test('Mizar matches SIMBAD J2000 and stays close to Alcor',()=>{
 const mizar=stars.find(s=>s.name==='Mizar'),alcor=stars.find(s=>s.name==='Alcor');
 const expectedRA=(13+23/60+55.54048/3600)*15;
 const expectedDec=54+55/60+31.2671/3600;
 assert.ok(Math.abs(mizar.ra-expectedRA)<1e-7);
 assert.ok(Math.abs(mizar.dec-expectedDec)<1e-7);
 const separation=Math.hypot((mizar.ra-alcor.ra)*Math.cos(mizar.dec*Math.PI/180),mizar.dec-alcor.dec);
 assert.ok(separation>.18&&separation<.21,'Mizar should be about 12 arcminutes from Alcor');
});
