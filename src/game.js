export const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const matches = (star, guess) => [star.name, ...star.aliases].some(name => normalize(name) === normalize(guess));
export const formatMagnitude = star => {
 if (star.magRange && star.magRange[1] - star.magRange[0] >= 0.2) return `mag ${star.magRange.map(n => n.toFixed(2)).join('–')}`;
 return star.mag == null ? '' : `mag ${star.mag.toFixed(2)}`;
};
// Optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps.
export function editDistance(a, b) {
 const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);
 for(let j=1;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
 }
 return d[a.length][b.length];
}
// A near miss earns no point; it only tells the player the spelling is almost right.
export const isNearMiss = (star, guess) => {
 const g=normalize(guess);
 return g.length>=3 && !matches(star,guess) && [star.name, ...star.aliases].some(name => {const n=normalize(name);return editDistance(n,g)<=(n.length>=7?2:1);});
};
export function readProgress(storage, stars) {
 try { const value=JSON.parse(storage.getItem('starhopper.discovered') || '[]'); return new Set(Array.isArray(value) ? value.filter(id => stars.some(s => s.id===id)) : []); } catch { return new Set(); }
}
// A representative seasonal sky: the 15th at 22:00 local mean solar time.
// At longitude zero this is 22:00 UT; longitude cancels when using local solar time.
// Use J2000's year to stay consistent with the static catalogue's equinox.
// GMST approximation: https://aa.usno.navy.mil/faq/GAST
export function observerZenith(latitude, month) {
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isInteger(month)||month<1||month>12)throw new RangeError('Invalid observer latitude or month');
 const days=(Date.UTC(2000,month-1,15,22)-Date.UTC(2000,0,1,12))/86400000;
 return {ra:((280.46061837+360.98564736629*days)%360+360)%360,dec:latitude};
}
export function readObserver(storage) {
 try {
  const value=JSON.parse(storage?.getItem('starhopper.observer')||'null');
  if(!value)return null;
  observerZenith(value.latitude,value.month);
  return {latitude:value.latitude,month:value.month};
 }catch{return null;}
}
// Rotate the navigation sphere so its north pole is the observer's zenith.
// Local axes are south, east, up; longitude turns around the local vertical
// and latitude is altitude. The existing ±90° pan limits now mean zenith/nadir.
export function createSkyFrame(zenith) {
 if(!zenith)return {toLocal:(ra,dec)=>({ra,dec}),toEquatorial:(ra,dec)=>({ra,dec})};
 const r=Math.PI/180,a=zenith.ra*r,d=zenith.dec*r;
 const south=[Math.sin(d)*Math.cos(a),Math.sin(d)*Math.sin(a),-Math.cos(d)];
 const east=[-Math.sin(a),Math.cos(a),0];
 const up=[Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)];
 const vector=(ra,dec)=>[Math.cos(dec*r)*Math.cos(ra*r),Math.cos(dec*r)*Math.sin(ra*r),Math.sin(dec*r)];
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 const angles=([x,y,z])=>({ra:Math.hypot(x,y)<1e-12?0:(Math.atan2(y,x)/r+360)%360,dec:Math.atan2(z,Math.hypot(x,y))/r});
 return {
  toLocal(ra,dec){const v=vector(ra,dec);return angles([dot(v,south),dot(v,east),dot(v,up)]);},
  toEquatorial(ra,dec){const v=vector(ra,dec);return angles(south.map((s,i)=>s*v[0]+east[i]*v[1]+up[i]*v[2]));},
 };
}
export function project(ra, dec, view, width, height) {
 const r=Math.PI/180, a=(ra-view.ra)*r, d=dec*r, c=view.dec*r;
 const z=Math.sin(c)*Math.sin(d)+Math.cos(c)*Math.cos(d)*Math.cos(a);
 if(z<=0.05)return null;
 const f=Math.min(width,height)/(2*Math.tan(view.fov*r/2));
 return [width/2-f*Math.cos(d)*Math.sin(a)/z,height/2-f*(Math.cos(c)*Math.sin(d)-Math.sin(c)*Math.cos(d)*Math.cos(a))/z];
}

// A compressed exponential response preserves the visual hierarchy on a screen.
// Hit areas stay independent of these small rendered points.
export function starAppearance(magnitude, zoom=1) {
 const mag=Number.isFinite(magnitude)?magnitude:16;
 const exposure=Math.max(0,Math.log2(Math.max(1,zoom)))*.6;
 const effective=mag-exposure;
 return {
  radius: Math.max(.55, Math.min(7, .35+3.8*10**(-.16*effective))),
  opacity: .16+.84/(1+10**(.32*(effective-3.8))),
  halo: Math.max(0,Math.min(.35,(2.8-effective)*.075)),
 };
}

export function formatCoordinates(ra,dec){
 const pad=n=>String(n).padStart(2,'0');
 const raSeconds=Math.round(ra/15*3600)%86400;
 const decSeconds=Math.round(Math.abs(dec)*3600);
 return `${pad(Math.floor(raSeconds/3600))}h ${pad(Math.floor(raSeconds/60)%60)}m ${pad(raSeconds%60)}s · ${dec<0?'−':'+'}${pad(Math.floor(decSeconds/3600))}° ${pad(Math.floor(decSeconds/60)%60)}′ ${pad(decSeconds%60)}″`;
}
