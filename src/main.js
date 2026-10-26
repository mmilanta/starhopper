import './style.css';
import {stellarColor} from './star-color.js';
import {matches,isNearMiss,readProgress,project,starAppearance,formatCoordinates} from './game.js';
const $=s=>document.querySelector(s);
$('#app').innerHTML=`

<main><aside><h1 class="app-title">Starhopper</h1>
<section class="progress" aria-label="Named stars"><div class="score"><strong id="score">0</strong><span>/ <b class="total">—</b> named stars</span></div><div class="track" aria-hidden="true"><div id="progress-bar"></div></div></section>

<div class="journal-heading"><h2>Field notes</h2><span id="note-count">00</span></div><div id="journal"><div class="empty"><span>✧</span><p>Your first discovery awaits.</p><small>Select a star and give it a name.<br>It will find a home here.</small></div></div>
<section id="review" hidden aria-label="Star results"><div class="review-legend"><span class="got">● Got</span><span class="missed">● Missed</span></div><div class="review-columns"><span>BRIGHTEST FIRST</span><span>APP. MAG.</span></div><div id="results"></div><p class="review-hint">Click a star to fly to it. Names without a visual magnitude appear last.</p></section>
<footer class="action-footer"><div class="sidebar-actions"><div class="session-actions"><button id="done" class="done-button" disabled>Done · reveal sky</button><button id="restart" class="restart-button" hidden>Restart</button></div><button id="help" class="quiet">How to play</button><span id="save-status" role="status" hidden></span></div></footer></aside>
<section class="observatory" aria-label="Interactive night sky"><canvas id="sky" tabindex="0" aria-label="Night sky. Drag or use arrow keys to look around. Scroll or use plus and minus to zoom. Tab selects the next visible named star."></canvas><div class="map-tools"><button id="grid" class="tool" aria-pressed="false" title="Toggle coordinate grid">⊞</button></div>
<div class="sky-caption"><span id="coordinates">05h 36m &nbsp; +02°</span><span>J2000 · EQUATORIAL VIEW</span></div>
<div class="star-panel">
<div id="selection" class="panel-idle"><span aria-hidden="true">✦</span><p id="selection-description">Click on a star and name it</p></div>
<form id="guess-form" hidden>
<div class="panel-heading"><div class="panel-details"><div class="panel-name"><h2 id="star-kind"></h2><span id="star-status" hidden></span></div><p id="star-detail"></p></div><button id="close" type="button" aria-label="Close selected star">×</button></div>
<div class="guess-input"><input id="guess" aria-label="Star name" placeholder="Star name" autocomplete="off" spellcheck="false" required><button class="submit" type="submit">Name star</button></div>
<p id="feedback" role="status" aria-live="polite"></p><div id="nearby" aria-label="Nearby stars"></div>
</form></div>
<div id="loading" role="status">Charting the stars…</div></section></main>
<dialog id="help-dialog"><button id="close-help" class="quiet" aria-label="Close instructions">×</button><div class="eyebrow">WELCOME, STARGAZER</div><h2>Get to know the night.</h2><p>Drag the sky to look in any direction. Scroll or pinch to zoom. Select a star and enter its proper name to earn one point and reveal its label.</p><p>All <span class="total">—</span> catalogue names are included, even stars too faint to see with the naked eye. Their minimum display size is enlarged so you can select them. Close companions can be selected using the nearby-star buttons.</p><p>Accents, spaces, punctuation and capitals don’t matter. Each name earns one point, once. Progress stays in this browser. Choose Done to review all stars from brightest to faintest. Missed names appear in orange; click any result to center it in the sky. Return to exploring whenever you like.</p><p>Keyboard: focus the sky, use arrows to pan and + / − to zoom. Press Tab to cycle visible stars, Enter to type a guess, or Escape to leave the sky.</p><small>Star positions: <a href="https://exopla.net/star-names/modern-iau-star-names/" target="_blank" rel="noreferrer">IAU catalogue</a>. Background stars and constellation lines: <a href="https://github.com/ofrohn/d3-celestial" target="_blank" rel="noreferrer">D3 Celestial</a>. Static J2000 sky, not a live view from your location.</small></dialog>`;
$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();
async function start(){
 const [stars,bg,lines]=await Promise.all(['stars','background','constellations'].map(async name=>{const response=await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);if(!response.ok)throw Error('Catalogue unavailable');return response.json();}));
 // Named stars are already drawn by the game layer; don't draw them twice.
 const background=bg.features.filter(b=>!stars.some(s=>{
  const [ra,dec]=b.geometry.coordinates;
  const delta=((s.ra-ra+540)%360)-180;
  return Math.hypot(delta*Math.cos(dec*Math.PI/180),s.dec-dec)<.015;
 }));
 let storage;try{storage=window.localStorage;}catch{}
 const found=readProgress(storage,stars), view={ra:84,dec:2,fov:76};
 let reviewing=false;try{reviewing=storage?.getItem('starhopper.review')==='true';}catch{}
 let selected=null,hovered=null,pulse=null,visible=[],showGrid=false,w=0,h=0,nearby=[],keyboardIndex=0,frame=0,flight=0;
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const canvas=$('#sky'),ctx=canvas.getContext('2d');
 const emptyJournal=$('#journal').innerHTML;
 function update(){
  $('#score').textContent=found.size;document.querySelectorAll('.total').forEach(el=>el.textContent=stars.length);$('#note-count').textContent=String(found.size).padStart(2,'0');$('#progress-bar').style.width=`${found.size?Math.max(1,found.size/stars.length*100):0}%`;
  if(!found.size)$('#journal').innerHTML=emptyJournal;
  if(found.size){$('#journal').replaceChildren();[...found].reverse().forEach(id=>{const s=stars.find(s=>s.id===id);const b=document.createElement('button');b.className='discovery';const name=document.createElement('span');name.textContent=s.name;const detail=document.createElement('small');detail.textContent=`${s.constellation} ↗`;b.append(name,detail);b.onclick=()=>{nearby=[];flyTo(s.ra,s.dec);choose(s);};$('#journal').append(b);});}
 }
 const p=(ra,dec)=>project(ra,dec,view,w,h);
 function path(coords,color){ctx.beginPath();let last=null;for(const [ra,dec] of coords){const q=p(ra,dec);if(q && last && Math.hypot(q[0]-last[0],q[1]-last[1])<w)ctx.lineTo(...q);else if(q)ctx.moveTo(...q);last=q;}ctx.strokeStyle=color;ctx.lineWidth=.7;ctx.stroke();}
 // Continuous input (drag, wheel, hover) coalesces into one paint per frame.
 function draw(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
 function render(){
  cancelAnimationFrame(frame);frame=0;
  ctx.clearRect(0,0,w,h);visible=[];
  if(showGrid){for(let ra=0;ra<360;ra+=15)path(Array.from({length:91},(_,i)=>[ra,-90+i*2]),'#21323f');for(let dec=-75;dec<=75;dec+=15)path(Array.from({length:181},(_,i)=>[i*2,dec]),'#21323f');}
  if(reviewing)for(const line of lines.features)for(const segment of line.geometry.coordinates)path(segment,'#344c5d');
  // Use the same magnitude response for catalogue stars and background stars.
  function paintStar(q,mag,bv){
   const {radius,opacity,halo}=starAppearance(mag,76/view.fov);
   const color=stellarColor(bv);
   if(halo>0){const glow=ctx.createRadialGradient(...q,0,...q,radius*5);glow.addColorStop(0,`rgba(${color},${halo})`);glow.addColorStop(.3,`rgba(${color},${halo*.25})`);glow.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=glow;ctx.beginPath();ctx.arc(...q,radius*5,0,Math.PI*2);ctx.fill();}
   ctx.fillStyle=`rgba(${color},${opacity})`;ctx.beginPath();ctx.arc(...q,radius,0,Math.PI*2);ctx.fill();
  }
  for(const s of background){const q=p(...s.geometry.coordinates);if(!q||q[0]<0||q[0]>w||q[1]<0||q[1]>h)continue;paintStar(q,s.properties.mag,s.properties.bv);}
  for(const s of stars){const q=p(s.ra,s.dec);if(!q||q[0]<-20||q[0]>w+20||q[1]<-20||q[1]>h+20)continue;visible.push({s,q});paintStar(q,s.mag,s.bv);
   if(selected?.id===s.id){ctx.strokeStyle='#b0e7cf';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...q,12,0,Math.PI*2);ctx.stroke();}
   else if(hovered?.id===s.id){ctx.strokeStyle='#b0e7cf66';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...q,10,0,Math.PI*2);ctx.stroke();}
   if(pulse?.id===s.id){const t=(performance.now()-pulse.start)/900;if(t<1){ctx.strokeStyle=`rgba(176,231,207,${(1-t)*.8})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(...q,12+t*34,0,Math.PI*2);ctx.stroke();draw();}else pulse=null;}
  }
  // Keep labels clear of the overlays drawn on top of the sky.
  const sky=canvas.getBoundingClientRect(),overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const obstacles=[...document.querySelectorAll('.sky-caption,.map-tools,.star-panel')].map(el=>el.getBoundingClientRect()).filter(r=>r.width).map(r=>({left:r.left-sky.left-6,right:r.right-sky.left+6,top:r.top-sky.top-6,bottom:r.bottom-sky.top+6}));
  const labelBoxes=[];
  const labelled=visible.filter(v=>reviewing||found.has(v.s.id)).sort((a,b)=>(b.s.id===selected?.id)-(a.s.id===selected?.id)||(a.s.mag??Infinity)-(b.s.mag??Infinity));
  ctx.font='12px system-ui';
  for(const {s,q} of labelled){
   const width=ctx.measureText(s.name).width;
   let box;
   for(let step=0;step<24;step++){
    const offset=(step%2===0?1:-1)*Math.floor(step/2)*15;
    const x=Math.max(5,Math.min(w-width-5,q[0]+10));
    const y=Math.max(17,Math.min(h-8,q[1]-8+offset));
    const candidate={x,y,left:x-3,right:x+width+3,top:y-13,bottom:y+4};
    if(!labelBoxes.some(b=>overlaps(candidate,b))&&!obstacles.some(b=>overlaps(candidate,b))){box=candidate;break;}
   }
   if(!box){
    const x=Math.max(5,Math.min(w-width-5,q[0]+10)),y=Math.max(17,Math.min(h-8,q[1]-8));
    box={x,y,left:x-3,right:x+width+3,top:y-13,bottom:y+4};
    // A crowded label under an overlay is unreadable; only the selected star insists.
    if(s.id!==selected?.id&&obstacles.some(b=>overlaps(box,b)))continue;
   }
   labelBoxes.push(box);const color=found.has(s.id)?'#a9e9ce':'#f5a964';
   if(Math.abs(box.y-(q[1]-8))>10){ctx.beginPath();ctx.moveTo(...q);ctx.lineTo(box.x-3,box.y-4);ctx.strokeStyle=found.has(s.id)?'#a9e9ce55':'#f5a96455';ctx.lineWidth=.6;ctx.stroke();}
   ctx.fillStyle=color;ctx.strokeStyle='#070e16';ctx.lineWidth=3;ctx.strokeText(s.name,box.x,box.y);ctx.fillText(s.name,box.x,box.y);
  }
  const coordinates=`${String(Math.floor(view.ra/15)).padStart(2,'0')}h ${String(Math.floor(view.ra%15*4)).padStart(2,'0')}m   ${view.dec>=0?'+':''}${view.dec.toFixed(0)}°`;
  if($('#coordinates').textContent!==coordinates)$('#coordinates').textContent=coordinates;
 }
 function resize(){w=canvas.clientWidth;h=canvas.clientHeight;const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);render();}new ResizeObserver(resize).observe(canvas);
 function flyTo(ra,dec,fov=view.fov){
  cancelAnimationFrame(flight);flight=0;
  const from={...view},dra=((ra-from.ra+540)%360)-180,ddec=dec-from.dec;
  if(reducedMotion.matches){Object.assign(view,{ra:(ra+360)%360,dec,fov});render();return;}
  // Long hops pull back slightly mid-flight so the path stays readable.
  const distance=Math.hypot(dra*Math.cos((from.dec+dec)*Math.PI/360),ddec),bump=Math.min(40,distance*.35),duration=Math.min(1400,450+distance*6),start=performance.now();
  const step=now=>{
   const t=Math.min(1,(now-start)/duration),e=t<.5?4*t*t*t:1-(-2*t+2)**3/2;
   view.ra=(from.ra+dra*e+360)%360;view.dec=from.dec+ddec*e;view.fov=Math.min(110,from.fov+(fov-from.fov)*e+Math.sin(Math.PI*e)*bump);
   render();flight=t<1?requestAnimationFrame(step):0;
  };
  flight=requestAnimationFrame(step);
 }
 function stopFlight(){cancelAnimationFrame(flight);flight=0;}
 const hits=(x,y)=>visible.map(v=>({...v,d:Math.hypot(v.q[0]-x,v.q[1]-y)})).filter(v=>v.d<18).sort((a,b)=>a.d-b.d);
 function choose(s,{focus=false}={}){
  selected=s;
  const known=found.has(s.id),revealed=known||reviewing;
  $('#selection').hidden=true;$('#guess-form').hidden=false;
  $('#star-kind').textContent=revealed?s.name:'';
  $('#star-kind').classList.toggle('missed',reviewing&&!known);
  $('#star-status').hidden=!revealed;
  $('#star-status').textContent=known?'Named':'Missed';
  $('#star-status').className=known?'got':'missed';
  $('.guess-input').hidden=revealed;
  const magnitude=s.mag==null?'Visual magnitude unavailable':`Magnitude ${s.mag.toFixed(2)}`;
  // Designation and constellation would give the answer away while guessing.
  $('#star-detail').textContent=revealed?`${s.designation} · ${s.constellation} · ${magnitude}`:magnitude;
  $('#guess').value='';$('#guess').disabled=revealed;$('.submit').disabled=revealed;
  $('#feedback').textContent='';$('#feedback').className='';$('#guess').removeAttribute('aria-invalid');
  $('#nearby').replaceChildren();
  if(nearby.length>1){
   const caption=document.createElement('span');caption.className='nearby-caption';caption.textContent='Nearby stars';$('#nearby').append(caption);
   nearby.forEach((n,i)=>{
    const button=document.createElement('button');button.type='button';button.textContent=found.has(n.id)||reviewing?n.name:`Star ${i+1}`;
    button.setAttribute('aria-pressed',String(n.id===s.id));button.onclick=()=>choose(n);$('#nearby').append(button);
   });
  }
  if(focus&&!revealed)$('#guess').focus({preventScroll:true});
  render();
 }
 function close(){selected=null;$('#guess-form').hidden=true;$('#selection').hidden=false;render();}$('#close').onclick=close;
 $('#guess').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();canvas.focus();}};
 $('.guess-input').addEventListener('animationend',()=>$('.guess-input').classList.remove('shake'));
 $('#guess-form').onsubmit=e=>{e.preventDefault();if(reviewing||!selected||found.has(selected.id))return;if(matches(selected,$('#guess').value)){found.add(selected.id);try{storage.setItem('starhopper.discovered',JSON.stringify([...found]));}catch{$('#save-status').hidden=false;$('#save-status').textContent='Progress is session-only; storage unavailable';}update();pulse={id:selected.id,start:performance.now()};choose(selected);$('#feedback').textContent=found.size===stars.length?`All ${stars.length} stars named.`:`${selected.name} named. +1 point.`;$('#feedback').className='success';}else{const near=isNearMiss(selected,$('#guess').value);$('#feedback').textContent=near?'So close. Check the spelling.':'Not quite. Try again.';$('#feedback').className=near?'close':'incorrect';$('#guess').setAttribute('aria-invalid','true');$('#guess').select();const field=$('.guess-input');field.classList.remove('shake');void field.offsetWidth;field.classList.add('shake');}};
 function zoom(f){view.fov=Math.max(3,Math.min(110,view.fov*f));}$('#grid').onclick=()=>{showGrid=!showGrid;$('#grid').classList.toggle('active',showGrid);$('#grid').setAttribute('aria-pressed',showGrid);render();};canvas.addEventListener('wheel',e=>{e.preventDefault();stopFlight();zoom(Math.exp(e.deltaY*.001));draw();},{passive:false});
 const pointers=new Map();let moved=false,origin=null;
 canvas.onpointerdown=e=>{stopFlight();hovered=null;canvas.style.cursor='';canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){origin={x:e.clientX,y:e.clientY};moved=false;}else moved=true;};
 canvas.onpointermove=e=>{if(!pointers.has(e.pointerId)){if(e.pointerType==='mouse'){const rect=canvas.getBoundingClientRect(),next=hits(e.clientX-rect.left,e.clientY-rect.top)[0]?.s??null;if(next!==hovered){hovered=next;canvas.style.cursor=next?'pointer':'';draw();}}return;}const old=pointers.get(e.pointerId),next={x:e.clientX,y:e.clientY};if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(after>0){zoom(before/after);draw();}}else{const scale=view.fov/Math.min(w,h);view.ra=(view.ra+(next.x-old.x)*scale+360)%360;view.dec=Math.max(-90,Math.min(90,view.dec+(next.y-old.y)*scale));if(Math.hypot(next.x-origin.x,next.y-origin.y)>5)moved=true;draw();}pointers.set(e.pointerId,next);};
 canvas.onpointerup=e=>{pointers.delete(e.pointerId);if(!moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const candidates=hits(x,y);if(candidates.length){nearby=candidates.map(v=>v.s);const primary=candidates.filter(v=>v.d<=candidates[0].d+3).sort((a,b)=>(a.s.mag??20)-(b.s.mag??20))[0];choose(primary.s,{focus:e.pointerType==='mouse'});}}};canvas.onpointercancel=e=>{pointers.delete(e.pointerId);moved=true;};canvas.onpointerleave=e=>{if(hovered&&!pointers.size){hovered=null;canvas.style.cursor='';draw();}};
 canvas.onkeydown=e=>{if(e.key==='Escape'){close();$('#grid').focus();return;}if(e.key==='Tab'&&!e.shiftKey&&visible.length){e.preventDefault();nearby=[];choose(visible[keyboardIndex++%visible.length].s);return;}if(e.key==='Enter'&&selected&&!reviewing&&!found.has(selected.id)){e.preventDefault();$('#guess').focus();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key)){e.preventDefault();stopFlight();if(e.key==='+'||e.key==='=')zoom(.8);else if(e.key==='-')zoom(1.25);else{const step=view.fov*.08;if(e.key==='ArrowLeft')view.ra+=step;if(e.key==='ArrowRight')view.ra-=step;if(e.key==='ArrowUp')view.dec+=step;if(e.key==='ArrowDown')view.dec-=step;view.ra=(view.ra+360)%360;view.dec=Math.max(-90,Math.min(90,view.dec));}render();}};
 function setReview(value){
  reviewing=value;document.body.classList.toggle('reviewing',value);$('#review').hidden=!value;$('#restart').hidden=!value;
  $('#done').textContent=value?'Resume':'Done · reveal sky';$('#done').setAttribute('aria-pressed',value);
  $('#selection-description').textContent=value?'Select a star to view its details':'Click on a star and name it';
  if(value){
   const fragment=document.createDocumentFragment();
   [...stars].sort((a,b)=>(a.mag??Infinity)-(b.mag??Infinity)||a.name.localeCompare(b.name)).forEach(s=>{
    const known=found.has(s.id),button=document.createElement('button');button.className=`result ${known?'got':'missed'}`;button.dataset.star=s.id;
    const info=document.createElement('span'),name=document.createElement('strong'),status=document.createElement('small'),mag=document.createElement('span');
    name.textContent=s.name;status.textContent=formatCoordinates(s.ra,s.dec);status.title='Right ascension · Declination (J2000)';button.setAttribute('aria-label',`${s.name}, ${known?'got':'missed'}, ${status.textContent}`);info.append(name,status);mag.textContent=s.mag==null?'—':s.mag.toFixed(2);mag.className='result-mag';button.append(info,mag);
    button.onclick=()=>{nearby=[];flyTo(s.ra,s.dec,Math.min(view.fov,35));choose(s);document.querySelectorAll('.result[aria-current]').forEach(el=>el.removeAttribute('aria-current'));button.setAttribute('aria-current','true');if(matchMedia('(max-width:700px)').matches)$('.observatory').scrollIntoView({behavior:'smooth',block:'start'});};fragment.append(button);
   });$('#results').replaceChildren(fragment);
  }
  try{storage?.setItem('starhopper.review',String(value));}catch{}
  close();
 }
 $('#restart').onclick=()=>{
  if(!confirm('Restart? This clears all your discoveries and resets your score.'))return;
  stopFlight();found.clear();nearby=[];pulse=null;keyboardIndex=0;Object.assign(view,{ra:84,dec:2,fov:76});
  try{storage?.removeItem('starhopper.discovered');}catch{$('#save-status').hidden=false;$('#save-status').textContent='Progress is session-only; storage unavailable';}
  update();setReview(false);
 };
 $('#done').disabled=false;$('#done').onclick=()=>setReview(!reviewing);
 update();setReview(reviewing);resize();$('#loading').remove();
}
start().catch(error=>{$('#loading').textContent='The sky could not load. Please refresh to try again.';console.error(error);});
