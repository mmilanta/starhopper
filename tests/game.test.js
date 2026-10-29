import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalize,matches,isNearMiss,readProgress,project,formatMagnitude,observerZenith,readObserver,createSkyFrame} from '../src/game.js';
const stars=JSON.parse(fs.readFileSync('public/data/stars.json'));
test('seasonal zenith follows latitude, sidereal time and the annual cycle',()=>{
 // January 15, 2000 at 22 UT: GMST is approximately 5h 38m 41s.
 const jan=observerZenith(47,1),jul=observerZenith(-33.5,7);
 assert.ok(Math.abs(jan.ra-84.67)<.01);
 assert.equal(jan.dec,47);assert.equal(jul.dec,-33.5);
 assert.ok((jul.ra-jan.ra+360)%360>175&&(jul.ra-jan.ra+360)%360<185);
 for(const lat of [-90,0,90])for(let month=1;month<=12;month++){
  const z=observerZenith(lat,month);
  assert.ok(z.ra>=0&&z.ra<360);
  assert.deepEqual(project(z.ra,z.dec,{...z,fov:76},800,600),[400,300]);
 }
 for(const [lat,month] of [[91,1],[NaN,1],[0,0],[0,13],[0,1.5]])assert.throws(()=>observerZenith(lat,month),RangeError);
});
test('observer frame moves the navigation pole and preserves the whole sky',()=>{
 for(const latitude of [-90,-33.5,0,47,90])for(const month of [1,6,12]){
  const zenith=observerZenith(latitude,month),frame=createSkyFrame(zenith);
  assert.ok(Math.abs(frame.toLocal(zenith.ra,zenith.dec).dec-90)<1e-10);
  assert.ok(Math.abs(frame.toLocal((zenith.ra+180)%360,-zenith.dec).dec+90)<1e-10);
  const north=frame.toLocal(0,90);
  assert.ok(Math.abs(north.dec-latitude)<1e-10,'the celestial pole is no longer the upper pan limit');
  for(const star of stars){
   const local=frame.toLocal(star.ra,star.dec),back=frame.toEquatorial(local.ra,local.dec);
   assert.ok(Math.abs(((back.ra-star.ra+540)%360)-180)<1e-8);
   assert.ok(Math.abs(back.dec-star.dec)<1e-8);
   const centered=project(local.ra,local.dec,{...local,fov:76},800,600);
   assert.ok(Math.abs(centered[0]-400)<1e-8&&Math.abs(centered[1]-300)<1e-8);
  }
 }
 const frame=createSkyFrame(observerZenith(47,1));
 // Local south/east on the horizon are perpendicular to the zenith.
 assert.ok(Math.abs(frame.toLocal(observerZenith(47,1).ra,47-90).dec)<1e-10);
 assert.deepEqual(createSkyFrame(null).toLocal(84,2),{ra:84,dec:2});
});
test('observer settings validate saved values and tolerate unavailable storage',()=>{
 for(const value of ['broken','null','{}','{"latitude":91,"month":1}','{"latitude":"47","month":1}'])assert.equal(readObserver({getItem:()=>value}),null);
 assert.equal(readObserver(),null);
 assert.equal(readObserver({getItem:()=>{throw Error('blocked');}}),null);
 assert.deepEqual(readObserver({getItem:()=>'{"latitude":-33.5,"month":6}'}),{latitude:-33.5,month:6});
});
test('magnitude shows meaningful ranges and otherwise the catalogue value',()=>{
 assert.equal(formatMagnitude({mag:1.2,magRange:[0,1.6]}),'mag 0.00–1.60');
 assert.equal(formatMagnitude({mag:1.2,magRange:[1.1,1.2]}),'mag 1.20');
 assert.equal(formatMagnitude({mag:null}),'');
});
test('Mira has its correct position and visual magnitude range',()=>{
 const mira=stars.find(s=>s.name==='Mira');
 assert.ok(Math.abs(mira.ra-34.836625)<1e-6);
 assert.equal(formatMagnitude(mira),'mag 2.00–10.10');
});
test('catalogue corrections preserve identities and recovered variable ranges',()=>{
 const byName=name=>stars.find(s=>s.name===name);
 assert.ok(Math.abs(byName('Alrescha').dec-2.7638)<0.001);
 assert.equal(byName('Zibbatu').designation,'HR 582');
 assert.equal(byName('Anunitu').designation,'HR 163');
 assert.equal(formatMagnitude(byName('Alsephina')),'mag 1.95–2.43');
 assert.equal(formatMagnitude(byName('Rasalgethi')),'mag 2.73–3.60');
});
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

test('near misses flag small typos without awarding matches',()=>{
 const sirius={name:'Sirius',aliases:[]},betelgeuse={name:'Betelgeuse',aliases:[]};
 assert.ok(isNearMiss(sirius,'Siruis'));assert.ok(isNearMiss(sirius,'Sirus'));assert.ok(isNearMiss(betelgeuse,'Betelguese'));
 assert.equal(isNearMiss(sirius,'Sirius'),false);assert.equal(isNearMiss(sirius,'Vega'),false);assert.equal(isNearMiss(betelgeuse,'wrong'),false);assert.equal(isNearMiss({name:'Ain',aliases:[]},'Ai'),false);
});
