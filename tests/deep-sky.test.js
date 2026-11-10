import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matches, readProgress, createSkyFrame, observerZenith, project} from '../src/game.js';
import {surveyWcs,skyViewUrl} from '../src/survey-sky.js';
import {angularOutline,projectOutline,outlineContains,objectType} from '../src/deep-sky.js';

const stars = JSON.parse(fs.readFileSync('public/data/stars.json'));
const deepSky = JSON.parse(fs.readFileSync('public/data/deep-sky.json'));

test('deep-sky catalogue has distinct identities, valid positions and catalogue aliases', () => {
  assert.equal(deepSky.length, 66);
  assert.equal(new Set([...stars,...deepSky].map(s=>s.id)).size, stars.length+deepSky.length);
  for (const object of deepSky) {
    assert.ok(['galaxy','nebula','cluster'].includes(object.type));
    assert.ok(Number.isFinite(object.ra) && object.ra>=0 && object.ra<360);
    assert.ok(Number.isFinite(object.dec) && Math.abs(object.dec)<=90);
    assert.ok(object.mag===null || Number.isFinite(object.mag));
    assert.ok(object.majorArcmin>0);
    assert.ok(matches(object, object.designation));
    assert.ok(matches(object, object.name));
  }
  const andromeda = deepSky.find(o=>o.id==='NGC0224');
  for (const answer of ['Andromeda', 'Andromeda Galaxy', 'M31', 'Messier 31', 'NGC224']) assert.ok(matches(andromeda,answer));
  assert.ok(matches(deepSky.find(o=>o.id==='NGC1976'),'M42'));
  assert.ok(!matches(andromeda,'M32'));
  assert.deepEqual([...readProgress({getItem:()=>JSON.stringify(['Vega','NGC0224'])},[...stars,...deepSky])],['Vega','NGC0224']);
});

test('survey TAN image pixels agree with the sky projection across observer frames and zoom levels', () => {
  const r=Math.PI/180;
  const vector=(ra,dec)=>[Math.cos(dec*r)*Math.cos(ra*r),Math.cos(dec*r)*Math.sin(ra*r),Math.sin(dec*r)];
  const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
  for (const latitude of [-90,-33,0,45,90]) for (const month of [1,6,11]) {
    const frame=createSkyFrame(observerZenith(latitude,month));
    for (const view of [{ra:0,dec:90,fov:30},{ra:359,dec:20,fov:8},{ra:120,dec:-70,fov:.1}]) {
      const width=1234,height=777,wcs=surveyWcs(view,frame,width,height);
      const params=new URL(skyViewUrl(wcs)).searchParams;
      const rotation=Number(params.get('Rotation'))*r;
      const scale=Number(params.get('Size').split(',')[0])/width;
      for (const [actual,expected] of [[-scale*Math.cos(rotation),wcs.CD1_1],[-scale*Math.sin(rotation),wcs.CD1_2],[-scale*Math.sin(rotation),wcs.CD2_1],[scale*Math.cos(rotation),wcs.CD2_2]]) assert.ok(Math.abs(actual-expected)<1e-10);
      const forward=vector(wcs.CRVAL1,wcs.CRVAL2),east=vector(wcs.CRVAL1+90,0),north=vector(wcs.CRVAL1,wcs.CRVAL2+90);
      for (const [x,y] of [[0,0],[1233,776],[616,388],[200,500]]) {
        const dx=x+.5-width/2,dy=height/2-y-.5;
        const sx=(wcs.CD1_1*dx+wcs.CD1_2*dy)*r,sy=(wcs.CD2_1*dx+wcs.CD2_2*dy)*r;
        const ray=forward.map((n,i)=>n+sx*east[i]+sy*north[i]);
        const ra=(Math.atan2(ray[1],ray[0])/r+360)%360,dec=Math.atan2(ray[2],Math.hypot(ray[0],ray[1]))/r;
        const local=frame.toLocal(ra,dec),point=project(local.ra,local.dec,view,width,height);
        assert.ok(Math.abs(point[0]-x-.5)<1e-6);
        assert.ok(Math.abs(point[1]-y-.5)<1e-6);
        assert.ok(Math.abs(dot(east,north))<1e-10);
      }
    }
  }
});

test('deep-sky footprints use traced nebula contours and correctly oriented angular galaxy axes',()=>{
  assert.equal(deepSky.filter(o=>o.type==='nebula'&&o.outlines).length,18);
  const orion=deepSky.find(o=>o.id==='NGC1976');
  assert.equal(angularOutline(orion),orion.outlines);
  for(const object of deepSky)for(const polygon of angularOutline(object)){
    assert.ok(polygon.length>=3);
    for(const [ra,dec] of polygon)assert.ok(Number.isFinite(ra)&&ra>=0&&ra<360&&Number.isFinite(dec)&&Math.abs(dec)<=90);
  }
  const galaxy=deepSky.find(o=>o.id==='NGC0224');
  const view={ra:galaxy.ra,dec:galaxy.dec,fov:8};
  const projection=(ra,dec)=>project(ra,dec,view,1000,1000);
  const outline=angularOutline(galaxy),footprint=projectOutline(outline,projection);
  assert.ok(outlineContains(footprint,500,500));
  const end=projection(...outline[0][0]);
  assert.ok(Math.hypot(end[0]-500,end[1]-500)>180,'measured diameter is represented at its angular scale');
  assert.ok(outlineContains(footprint,500+(end[0]-500)*.7,500+(end[1]-500)*.7),'the object is selectable far from the center');
  assert.ok(!outlineContains(footprint,footprint.bounds.right+1,500));
  const north=projection(...angularOutline({...galaxy,positionAngle:0})[0][0]);
  const east=projection(...angularOutline({...galaxy,positionAngle:90})[0][0]);
  assert.ok(Math.abs(north[0]-500)<1e-8 && north[1]<500);
  assert.ok(Math.abs(east[1]-500)<1e-8 && east[0]<500);
  assert.equal(projectOutline(outline,(ra,dec)=>project(ra,dec,{...view,fov:110},100,100)),null,'unresolved objects retain compact markers');
  const lmc=deepSky.find(o=>o.id==='ESO056-115');
  const lmcView={ra:lmc.ra,dec:lmc.dec,fov:20};
  const lmcFootprint=projectOutline(angularOutline(lmc),(ra,dec)=>project(ra,dec,lmcView,1000,1000));
  assert.ok(outlineContains(lmcFootprint,500,500),'LMC selection covers the galaxy centre, not the off-centre emission knots');
  assert.ok(Math.max(lmcFootprint.bounds.right-lmcFootprint.bounds.left,lmcFootprint.bounds.bottom-lmcFootprint.bounds.top)>500,'the boundary covers the full roughly 11-degree galaxy');
});


test('open and globular clusters retain their identities, names and catalogue aliases',()=>{
 const clusters=deepSky.filter(o=>o.type==='cluster');
 assert.equal(clusters.length,26);
 assert.equal(clusters.filter(o=>o.subtype==='GCl').length,10);
 assert.equal(clusters.filter(o=>o.subtype==='OCl').length,16);
 const hercules=clusters.find(o=>o.id==='NGC6205');
 assert.equal(objectType(hercules),'Globular cluster');
 for(const name of ['M13','Messier 13','NGC6205','Hercules Globular Cluster','Hercules Cluster'])assert.ok(matches(hercules,name));
 assert.ok(Math.abs(hercules.ra-250.42345833)<.0001);
 assert.ok(Math.abs(hercules.dec-36.46130556)<.0001);
 assert.ok(!matches(hercules,'M92'));
 const pleiades=clusters.find(o=>o.id==='Mel022');
 assert.equal(objectType(pleiades),'Open cluster');
 for(const name of ['M45','Pleiades','Seven Sisters','Melotte 22'])assert.ok(matches(pleiades,name));
 const hyades=clusters.find(o=>o.id==='C041');
 for(const name of ['Hyades','C41','Caldwell 41','Melotte 25'])assert.ok(matches(hyades,name));
 const saved=['Vega','NGC0224','NGC6205','Mel022'];
 assert.deepEqual([...readProgress({getItem:()=>JSON.stringify(saved)},[...stars,...deepSky])],saved);
});
