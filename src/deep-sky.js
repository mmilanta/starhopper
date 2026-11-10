export const objectType = object => object.type === 'cluster' ? object.subtype === 'GCl' ? 'Globular cluster' : 'Open cluster' : object.type === 'galaxy' ? 'Galaxy' : object.type === 'nebula' ? 'Nebula' : 'Star';
export const objectColor = object => object.type === 'cluster' ? '#b9abd8' : object.type === 'galaxy' ? '#d3ba8a' : '#89b9cc';

export function angularOutline(object) {
  if (object.outlines?.length) return object.outlines;
  if (!(object.majorArcmin > 0)) return [];
  const r = Math.PI/180, a = object.ra*r, d = object.dec*r;
  const center = [Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)];
  const east = [-Math.sin(a),Math.cos(a),0];
  const north = [-Math.sin(d)*Math.cos(a),-Math.sin(d)*Math.sin(a),Math.cos(d)];
  const pa = (object.positionAngle||0)*r;
  const major = object.majorArcmin/120*r, minor = (object.minorArcmin||object.majorArcmin)/120*r;
  const polygon = Array.from({length:96},(_,i)=>{
    const angle = i/96*Math.PI*2;
    const n = major*Math.cos(angle)*Math.cos(pa)-minor*Math.sin(angle)*Math.sin(pa);
    const e = major*Math.cos(angle)*Math.sin(pa)+minor*Math.sin(angle)*Math.cos(pa);
    const radius = Math.hypot(n,e), scale = radius ? Math.sin(radius)/radius : 1;
    const v = center.map((c,j)=>c*Math.cos(radius)+(north[j]*n+east[j]*e)*scale);
    return [(Math.atan2(v[1],v[0])/r+360)%360,Math.atan2(v[2],Math.hypot(v[0],v[1]))/r];
  });
  return [polygon];
}

export function projectOutline(outlines, project) {
  const polygons = outlines.map(polygon=>polygon.map(([ra,dec])=>project(ra,dec)));
  const points = polygons.flat().filter(Boolean);
  if (!points.length) return null;
  const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
  const bounds = {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
  // Below chart resolution use the existing compact symbol.
  if (Math.max(bounds.right-bounds.left,bounds.bottom-bounds.top)<12) return null;
  return {polygons,bounds};
}

export function paintOutline(ctx, footprint, color, selected=false, subtype) {
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=selected?1.5:1;
  if (subtype === 'OCl') ctx.setLineDash([3,4]);
  if (selected) { ctx.shadowColor=color; ctx.shadowBlur=4; }
  for (const polygon of footprint.polygons) {
    ctx.beginPath(); let previous=null;
    for (const point of polygon) {
      if (point && previous && Math.hypot(point[0]-previous[0],point[1]-previous[1])<Math.max(ctx.canvas.clientWidth||ctx.canvas.width,ctx.canvas.clientHeight||ctx.canvas.height)) ctx.lineTo(...point);
      else if (point) ctx.moveTo(...point);
      previous=point;
    }
    if (polygon.every(Boolean)) ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

export function outlineContains(footprint,x,y) {
  if (!footprint || x<footprint.bounds.left || x>footprint.bounds.right || y<footprint.bounds.top || y>footprint.bounds.bottom) return false;
  return footprint.polygons.some(polygon=>{
    if (!polygon.every(Boolean)) return false;
    let inside=false;
    for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
      if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  });
}

// Fixed-size chart symbols remain selectable even when the real object is tiny.
// Larger objects use their projected outline instead.
export function paintDeepSkyMarker(ctx, object, [x, y], active=false) {
  ctx.save();
  if (!active) ctx.globalAlpha *= .3;
  ctx.strokeStyle = active ? '#b0e7cf' : objectColor(object);
  ctx.lineWidth = active ? 1.5 : 1;
  ctx.beginPath();
  if (object.type === 'cluster') {
    if (object.subtype === 'OCl') ctx.setLineDash([2,3]);
    ctx.arc(x,y,5,0,Math.PI*2);
    if (object.subtype === 'GCl') { ctx.moveTo(x-3,y); ctx.lineTo(x+3,y); ctx.moveTo(x,y-3); ctx.lineTo(x,y+3); }
  }
  else if (object.type === 'galaxy') ctx.ellipse(x, y, 6, 3, -.5, 0, Math.PI * 2);
  else { ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath(); }
  ctx.stroke();
  ctx.restore();
}
