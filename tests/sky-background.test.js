import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {photoCoordinates,photoCamera} from '../src/sky-background.js';
import {createSkyFrame,observerZenith,project} from '../src/game.js';
const stars=JSON.parse(fs.readFileSync('public/data/stars.json'));
const registration=JSON.parse(fs.readFileSync('src/assets/milky-way-registration.json'));
const direction=({u,v})=>{const a=(.5-u)*2*Math.PI,d=(.5-v)*Math.PI;return [Math.cos(a)*Math.cos(d),Math.sin(a)*Math.cos(d),Math.sin(d)];};
const separation=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,n,i)=>s+n*b[i],0))))*180/Math.PI;

test('photograph registration matches measured bright stars across both hemispheres',()=>{
 for(const {star,pixel:[x,y]} of registration.landmarks){
  const s=stars.find(s=>s.name===star),actual=direction(photoCoordinates(s.ra,s.dec));
  const expected=direction({u:(x+.5)/registration.measurementSize[0],v:(y+.5)/registration.measurementSize[1]});
  assert.ok(separation(actual,expected)<.00001,`${star} matches its rectified photographic position`);
 }
});

test('photographic camera follows catalogue projection after observer rotations, panning and zooming',()=>{
 for(const latitude of [-90,-33.5,0,45,90])for(const month of [1,6,12]){
  const frame=createSkyFrame(observerZenith(latitude,month));
  for(const view of [{ra:0,dec:90,fov:76},{ra:359,dec:30,fov:110},{ra:120,dec:-70,fov:8}]){
   const camera=photoCamera(view,frame),width=1234,height=777,focal=Math.min(width,height)/(2*Math.tan(view.fov*Math.PI/360));
   for(const star of stars){
    const local=frame.toLocal(star.ra,star.dec),q=project(local.ra,local.dec,view,width,height);
    if(!q||q[0]<0||q[0]>width||q[1]<0||q[1]>height)continue;
    const sx=(width/2-q[0])/focal,sy=(height/2-q[1])/focal;
    const ray=camera.forward.map((v,i)=>v+sx*camera.east[i]+sy*camera.north[i]),length=Math.hypot(...ray);
    assert.ok(separation(ray.map(v=>v/length),direction(photoCoordinates(star.ra,star.dec)))<.00001);
   }
  }
 }
});

test('panorama coordinates remain finite and wrap for the full sphere',()=>{
 for(let ra=0;ra<=360;ra+=5)for(let dec=-90;dec<=90;dec+=5){
  const {u,v}=photoCoordinates(ra,dec);assert.ok(u>=0&&u<1&&v>=0&&v<=1);
 }
});


test('panorama rectification verifies the two reported Capricorn stars in the resampled photograph',()=>{
 for(const name of ['Deneb Algedi','Nashira']){
  const anchor=registration.landmarks.find(a=>a.star===name);
  assert.ok(anchor, `${name} is a measured photographic anchor`);
  assert.ok(anchor.verifiedResidualPixels<.5, `${name} is aligned within half a source pixel`);
  assert.ok(Math.hypot(anchor.pixel[0]-anchor.sourcePixel[0],anchor.pixel[1]-anchor.sourcePixel[1])>1, 'the original stitching displacement was corrected');
 }
});
