export const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const matches = (star, guess) => [star.name, ...star.aliases].some(name => normalize(name) === normalize(guess));
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
