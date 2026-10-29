import './style.css';
import {stellarColor} from './star-color.js';
import {matches,isNearMiss,readProgress,readObserver,observerZenith,createSkyFrame,project,starAppearance,formatMagnitude} from './game.js';
const $=s=>document.querySelector(s);
$('#app').innerHTML=`

<main><aside><div class="sidebar-header"><h1 class="app-title">Starhopper</h1>
<div class="score" aria-label="Named stars"><strong id="score">0</strong><span>/ <b class="total">—</b></span></div></div>

<div id="journal" aria-label="Named stars"><div class="empty"><span>✧</span><p>Your first discovery awaits.</p><small>Select a star and guess its name.</small></div></div>
<section id="review" hidden aria-label="Star results"><input id="result-search" type="search" aria-label="Search stars" placeholder="Search stars" autocomplete="off"><div class="discovery-heading"><span>Star</span><span>Magnitude</span></div><div id="results"></div></section>
<footer class="action-footer"><div class="sidebar-actions"><div class="session-actions"><button id="done" class="done-button" disabled>Done · reveal sky</button><button id="restart" class="restart-button" hidden>Restart</button><button id="help" class="quiet" aria-label="How to play">[?]</button></div><span id="save-status" role="status" hidden></span></div></footer></aside>
<section class="observatory" aria-label="Interactive night sky"><canvas id="sky" tabindex="0" aria-label="Night sky. Drag or use arrow keys to look around. Scroll or use plus and minus to zoom. Tab selects the next visible named star."></canvas><div class="map-tools"><button id="observer" class="tool observer-tool" aria-haspopup="dialog" title="Set observer zenith" disabled>Zenith</button><button id="review-toggle" class="tool" aria-controls="review" aria-expanded="true" aria-label="Hide star list" title="Hide star list"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.25 8 5.75l4.5 4.5"/></svg></button><button id="grid" class="tool" aria-pressed="false" title="Toggle coordinate grid">⊞</button></div>
<div class="sky-caption"><span id="coordinates">05h 36m &nbsp; +02°</span><span id="view-context">J2000 · EQUATORIAL VIEW</span></div>
<div class="star-panel">
<div id="selection" class="panel-idle"><span aria-hidden="true">✦</span><p id="selection-description">Click on a star and name it</p></div>
<form id="guess-form" hidden>
<div class="panel-heading"><div class="panel-details"><div class="panel-name"><h2 id="star-kind"></h2></div><p id="star-detail"></p></div></div>
<div class="guess-input"><div class="guess-field"><input id="guess" aria-label="Star name" aria-describedby="guess-magnitude" placeholder="Star name" autocomplete="off" spellcheck="false" required><span id="guess-magnitude"></span></div><button class="submit" type="submit">Name star</button></div>
<p id="feedback" role="status" aria-live="polite"></p>
</form></div>
<div id="loading" role="status">Charting the stars…</div></section></main>
<dialog id="observer-dialog" aria-labelledby="observer-title"><div class="observer-heading"><h2 id="observer-title">Set Zenith</h2><button id="close-observer" class="quiet dialog-close" aria-label="Close observer settings">×</button></div>
<form id="observer-form"><div class="observer-fields"><div><label for="latitude">Observer latitude</label><div class="latitude-field"><input id="latitude" type="number" min="-90" max="90" step="any" value="47" required><span>°</span></div></div>
<div><label for="month">Month</label><select id="month">${['January','February','March','April','May','June','July','August','September','October','November','December'].map((name,i)=>`<option value="${i+1}">${name}</option>`).join('')}</select></div></div>
<button class="submit" type="submit">Set navigation zenith</button></form></dialog>
<dialog id="help-dialog"><button id="close-help" class="quiet" aria-label="Close instructions">×</button><div class="eyebrow">WELCOME, STARGAZER</div><h2>Get to know the night.</h2><p>Drag the sky to look in any direction. Scroll or pinch to zoom. Select a star and enter its proper name to reveal its label.</p><p>All <span class="total">—</span> catalogue names are included, even stars too faint to see with the naked eye. Their minimum display size is enlarged so you can select them.</p><p>Accents, spaces, punctuation and capitals don’t matter. Each star can be named once. Progress stays in this browser. Choose Done to review all stars from brightest to faintest. Missed names appear in orange; click any result to center it in the sky. Return to exploring whenever you like.</p><p>Keyboard: focus the sky, use arrows to pan and + / − to zoom. Press Tab to cycle visible stars, Enter to type a guess, or Escape to leave the sky.</p><small>Star positions: <a href="https://exopla.net/star-names/modern-iau-star-names/" target="_blank" rel="noreferrer">IAU catalogue</a>. Background stars and constellation lines: <a href="https://github.com/ofrohn/d3-celestial" target="_blank" rel="noreferrer">D3 Celestial</a>. Static J2000 sky. Use Zenith to set the navigation pole for your latitude and month at 10 pm.</small></dialog>`;
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
 const found=readProgress(storage,stars);
 let observer=readObserver(storage);
 let skyFrame=createSkyFrame(observer?observerZenith(observer.latitude,observer.month):null);
 const initialView=()=>({...(observer?{ra:0,dec:90}:{ra:84,dec:2}),fov:76});
 const view=initialView();
 let reviewing=false;try{reviewing=storage?.getItem('starhopper.review')==='true';}catch{}
 let selected=null,hovered=null,pulse=null,visible=[],showGrid=false,w=0,h=0,keyboardIndex=0,frame=0,flight=0;
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const canvas=$('#sky'),ctx=canvas.getContext('2d');
 const emptyJournal=$('#journal').innerHTML;
 function observerContext(){
  $('#view-context').textContent=observer?`${Math.abs(observer.latitude)}°${observer.latitude<0?'S':'N'} · ${$('#month').options[observer.month-1].text} · 10 PM`:'J2000 · EQUATORIAL VIEW';
 }
 $('#latitude').value=observer?.latitude??47;
 $('#month').value=observer?.month??new Date().getMonth()+1;
 $('#observer').disabled=false;
 $('#observer').onclick=()=>$('#observer-dialog').showModal();
 $('#close-observer').onclick=()=>$('#observer-dialog').close();
 $('#observer-form').onsubmit=e=>{
  e.preventDefault();
  observer={latitude:Number($('#latitude').value),month:Number($('#month').value)};
  try{storage?.setItem('starhopper.observer',JSON.stringify(observer));}catch{
   $('#save-status').hidden=false;$('#save-status').textContent='Settings are session-only; storage unavailable';
  }
  stopFlight();skyFrame=createSkyFrame(observerZenith(observer.latitude,observer.month));Object.assign(view,initialView());observerContext();close();
  $('#observer-dialog').close();canvas.focus({preventScroll:true});
 };
 observerContext();
 const starDetail=s=>[s.bayer || `${s.designation} · ${s.constellation}`, formatMagnitude(s)].filter(Boolean).join(' · ');
 function update(){
  $('#score').textContent=found.size;document.querySelectorAll('.total').forEach(el=>el.textContent=stars.length);
  if(!found.size)$('#journal').innerHTML=emptyJournal;
  if(found.size){$('#journal').replaceChildren();const heading=document.createElement('div');heading.className='discovery-heading';const starHeading=document.createElement('span'),magnitudeHeading=document.createElement('span');starHeading.textContent='Star';magnitudeHeading.textContent='Magnitude';heading.append(starHeading,magnitudeHeading);const entries=document.createElement('div');entries.id='discoveries';$('#journal').append(heading,entries);[...found].reverse().forEach(id=>{const s=stars.find(s=>s.id===id);const b=document.createElement('button');b.className='discovery';const identity=document.createElement('span');identity.className='discovery-identity';const name=document.createElement('span');name.textContent=s.name;const detail=document.createElement('small');detail.textContent=s.bayer || `${s.designation} · ${s.constellation}`;identity.append(name,detail);const magnitude=document.createElement('small');magnitude.className='discovery-magnitude';magnitude.textContent=formatMagnitude(s).replace(/^mag /,'');b.append(identity,magnitude);b.onclick=()=>{flyTo(s.ra,s.dec);choose(s);};entries.append(b);});}
 }
 const p=(ra,dec)=>{const local=skyFrame.toLocal(ra,dec);return project(local.ra,local.dec,view,w,h);};
 function path(coords,color){ctx.beginPath();let last=null;for(const [ra,dec] of coords){const q=p(ra,dec);if(q && last && Math.hypot(q[0]-last[0],q[1]-last[1])<w)ctx.lineTo(...q);else if(q)ctx.moveTo(...q);last=q;}ctx.strokeStyle=color;ctx.lineWidth=.7;ctx.stroke();}
 // Continuous input (drag, wheel, hover) coalesces into one paint per frame.
 function draw(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
 function render(){
  cancelAnimationFrame(frame);frame=0;
  ctx.clearRect(0,0,w,h);visible=[];
  if(observer){
   const zenith=observerZenith(observer.latitude,observer.month),q=p(zenith.ra,zenith.dec);
   if(q){ctx.strokeStyle='#e5bd7766';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q[0]-7,q[1]);ctx.lineTo(q[0]+7,q[1]);ctx.moveTo(q[0],q[1]-7);ctx.lineTo(q[0],q[1]+7);ctx.stroke();}
  }
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
  ctx.font='11px "JetBrains Mono", monospace';
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
   ctx.fillStyle=color;ctx.strokeStyle='#111415';ctx.lineWidth=3;ctx.strokeText(s.name,box.x,box.y);ctx.fillText(s.name,box.x,box.y);
  }
  const center=skyFrame.toEquatorial(view.ra,view.dec);
  const coordinates=`${String(Math.floor(center.ra/15)).padStart(2,'0')}h ${String(Math.floor(center.ra%15*4)).padStart(2,'0')}m   ${center.dec>=0?'+':''}${center.dec.toFixed(0)}°`;
  if($('#coordinates').textContent!==coordinates)$('#coordinates').textContent=coordinates;
 }
 function resize(){w=canvas.clientWidth;h=canvas.clientHeight;const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);render();}new ResizeObserver(resize).observe(canvas);
 function flyTo(ra,dec,fov=view.fov){
  ({ra,dec}=skyFrame.toLocal(ra,dec));
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
  $('.star-panel').classList.toggle('named',known);
  $('.star-panel').classList.toggle('missed',reviewing&&!known);
  $('.guess-input').hidden=revealed;
  $('#guess-magnitude').textContent=formatMagnitude(s);
  // Designation and constellation would give the answer away while guessing.
  $('#star-detail').textContent=revealed?starDetail(s):'';
  $('#guess').value='';$('#guess').disabled=revealed;$('.submit').disabled=revealed;
  $('#feedback').textContent='';$('#feedback').className='';$('#guess').removeAttribute('aria-invalid');
  if(focus&&!revealed)$('#guess').focus({preventScroll:true});
  render();
 }
 function close(){selected=null;$('.star-panel').classList.remove('named','missed');$('#guess-form').hidden=true;$('#selection').hidden=false;render();}
 $('#guess').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();canvas.focus();}};
 $('.guess-input').addEventListener('animationend',()=>$('.guess-input').classList.remove('shake'));
 $('#guess-form').onsubmit=e=>{e.preventDefault();if(reviewing||!selected||found.has(selected.id))return;if(matches(selected,$('#guess').value)){found.add(selected.id);try{storage.setItem('starhopper.discovered',JSON.stringify([...found]));}catch{$('#save-status').hidden=false;$('#save-status').textContent='Progress is session-only; storage unavailable';}update();pulse={id:selected.id,start:performance.now()};choose(selected);}else{const near=isNearMiss(selected,$('#guess').value);$('#feedback').textContent=near?'So close. Check the spelling.':'Not quite. Try again.';$('#feedback').className=near?'close':'incorrect';$('#guess').setAttribute('aria-invalid','true');$('#guess').select();const field=$('.guess-input');field.classList.remove('shake');void field.offsetWidth;field.classList.add('shake');}};
 function zoom(f){view.fov=Math.max(3,Math.min(110,view.fov*f));}$('#grid').onclick=()=>{showGrid=!showGrid;$('#grid').classList.toggle('active',showGrid);$('#grid').setAttribute('aria-pressed',showGrid);render();};canvas.addEventListener('wheel',e=>{e.preventDefault();stopFlight();zoom(Math.exp(e.deltaY*.001));draw();},{passive:false});
 const pointers=new Map();let moved=false,origin=null;
 canvas.onpointerdown=e=>{stopFlight();hovered=null;canvas.style.cursor='';canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){origin={x:e.clientX,y:e.clientY};moved=false;}else moved=true;};
 canvas.onpointermove=e=>{if(!pointers.has(e.pointerId)){if(e.pointerType==='mouse'){const rect=canvas.getBoundingClientRect(),next=hits(e.clientX-rect.left,e.clientY-rect.top)[0]?.s??null;if(next!==hovered){hovered=next;canvas.style.cursor=next?'pointer':'';draw();}}return;}const old=pointers.get(e.pointerId),next={x:e.clientX,y:e.clientY};if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(after>0){zoom(before/after);draw();}}else{const scale=view.fov/Math.min(w,h);view.ra=(view.ra+(next.x-old.x)*scale+360)%360;view.dec=Math.max(-90,Math.min(90,view.dec+(next.y-old.y)*scale));if(Math.hypot(next.x-origin.x,next.y-origin.y)>5)moved=true;draw();}pointers.set(e.pointerId,next);};
 canvas.onpointerup=e=>{pointers.delete(e.pointerId);if(!moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const candidates=hits(x,y);if(candidates.length){const primary=candidates.filter(v=>v.d<=candidates[0].d+3).sort((a,b)=>(a.s.mag??20)-(b.s.mag??20))[0];choose(primary.s,{focus:e.pointerType==='mouse'});}}};canvas.onpointercancel=e=>{pointers.delete(e.pointerId);moved=true;};canvas.onpointerleave=e=>{if(hovered&&!pointers.size){hovered=null;canvas.style.cursor='';draw();}};
 canvas.onkeydown=e=>{if(e.key==='Escape'){close();$('#grid').focus();return;}if(e.key==='Tab'&&!e.shiftKey&&visible.length){e.preventDefault();choose(visible[keyboardIndex++%visible.length].s);return;}if(e.key==='Enter'&&selected&&!reviewing&&!found.has(selected.id)){e.preventDefault();$('#guess').focus();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key)){e.preventDefault();stopFlight();if(e.key==='+'||e.key==='=')zoom(.8);else if(e.key==='-')zoom(1.25);else{const step=view.fov*.08;if(e.key==='ArrowLeft')view.ra+=step;if(e.key==='ArrowRight')view.ra-=step;if(e.key==='ArrowUp')view.dec+=step;if(e.key==='ArrowDown')view.dec-=step;view.ra=(view.ra+360)%360;view.dec=Math.max(-90,Math.min(90,view.dec));}render();}};
 function setReview(value){
  reviewing=value;document.body.classList.toggle('reviewing',value);$('#review').hidden=!value;$('#restart').hidden=!value;
  if(!value){document.body.classList.remove('review-collapsed');$('#review-toggle').setAttribute('aria-expanded','true');$('#review-toggle').setAttribute('aria-label','Hide star list');$('#review-toggle').title='Hide star list';}
  $('#done').textContent=value?'Resume':'Done · reveal sky';$('#done').setAttribute('aria-pressed',value);
  $('#selection-description').textContent=value?'Select a star to view its details':'Click on a star and name it';
  if(value){
   const fragment=document.createDocumentFragment();
   [...stars].sort((a,b)=>(a.mag??Infinity)-(b.mag??Infinity)||a.name.localeCompare(b.name)).forEach(s=>{
    const known=found.has(s.id),button=document.createElement('button');button.className=`result ${known?'got':'missed'}`;button.dataset.star=s.id;
    const info=document.createElement('span'),name=document.createElement('span'),detail=document.createElement('small'),mag=document.createElement('small');
    info.className='discovery-identity';name.textContent=s.name;detail.textContent=s.bayer || `${s.designation} · ${s.constellation}`;button.setAttribute('aria-label',`${s.name}, ${known?'named':'missed'}, ${starDetail(s)}`);info.append(name,detail);mag.textContent=formatMagnitude(s).replace(/^mag /,'')||'—';mag.className='result-mag discovery-magnitude';button.dataset.mag=s.mag??'';button.dataset.search=[s.name,...s.aliases,s.bayer||'',s.designation,s.constellation].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();button.append(info,mag);
    button.onclick=()=>{flyTo(s.ra,s.dec,Math.min(view.fov,35));choose(s);document.querySelectorAll('.result[aria-current]').forEach(el=>el.removeAttribute('aria-current'));button.setAttribute('aria-current','true');};fragment.append(button);
   });$('#results').replaceChildren(fragment);filterResults();
  }
  try{storage?.setItem('starhopper.review',String(value));}catch{}
  close();
 }
 $('#review-toggle').onclick=()=>{const collapsed=document.body.classList.toggle('review-collapsed');const label=collapsed?'Show star list':'Hide star list';$('#review-toggle').setAttribute('aria-expanded',String(!collapsed));$('#review-toggle').setAttribute('aria-label',label);$('#review-toggle').title=label;};
 function filterResults(){const query=$('#result-search').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();document.querySelectorAll('.result').forEach(row=>{row.hidden=!row.dataset.search.includes(query);});}
 $('#result-search').addEventListener('input',filterResults);
 $('#restart').onclick=()=>{
  if(!confirm('Restart? This clears all your discoveries and resets your score.'))return;
  stopFlight();found.clear();pulse=null;keyboardIndex=0;Object.assign(view,initialView());
  try{storage?.removeItem('starhopper.discovered');}catch{$('#save-status').hidden=false;$('#save-status').textContent='Progress is session-only; storage unavailable';}
  update();setReview(false);
 };
 $('#done').disabled=false;$('#done').onclick=()=>setReview(!reviewing);
 update();setReview(reviewing);resize();$('#loading').remove();
 document.fonts.ready.then(draw);
}
start().catch(error=>{$('#loading').textContent='The sky could not load. Please refresh to try again.';console.error(error);});
