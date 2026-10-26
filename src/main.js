import './style.css';
import {matches,readProgress,project,starAppearance,formatCoordinates} from './game.js';
const $=s=>document.querySelector(s);
$('#app').innerHTML=`
<header><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Starhopper home"><span class="brand-icon">✧</span> starhopper<span class="beta">EXPLORER</span></a><div class="header-right"><span class="save"><i></i> <span id="save-status">Progress saved on this device</span></span><button id="done" class="done-button" disabled>Done · reveal sky</button><button id="help" class="quiet">How to play <span>↗</span></button></div></header>
<main><aside><div class="eyebrow">YOUR OWN PIECE OF THE UNIVERSE</div><h1>A sky full<br>of familiar<br><em>strangers.</em></h1><p class="intro">Every star has a story.<br>How many do you know by name?</p>
<section class="progress"><div class="eyebrow">YOUR DISCOVERIES <span>✦</span></div><div class="score"><strong id="score">0</strong><span>/ <b class="total">—</b> stars</span></div><div class="track"><div id="progress-bar"></div></div><div class="progress-caption"><span id="percent">0% of the sky named</span><span>∞ curiosity</span></div></section>
<div class="journal-heading"><h2>Field notes</h2><span id="note-count">00</span></div><div id="journal"><div class="empty"><span>✧</span><p>Your first discovery awaits.</p><small>Select a star and give it a name.<br>It will find a home here.</small></div></div>
<section id="review" hidden aria-label="Star results"><div class="eyebrow">YOUR SKY, REVEALED</div><h2>The stars you know.<br> The ones to meet.</h2><p id="review-summary" role="status"></p><div class="review-legend"><span class="got">● Got</span><span class="missed">● Missed</span></div><div class="review-columns"><span>BRIGHTEST FIRST</span><span>APP. MAG.</span></div><div id="results"></div><p class="review-hint">Click a star to fly to it. Names without a visual magnitude appear last.</p></section>
<footer><span class="tiny-star">✳</span><div>One sky. <span class="total">—</span> names.<br><span>No timer. Just you and the stars.</span></div></footer></aside>
<section class="observatory" aria-label="Interactive night sky"><canvas id="sky" tabindex="0" aria-label="Night sky. Drag or use arrow keys to look around. Scroll or use plus and minus to zoom. Tab selects the next visible named star."></canvas><div class="sky-heading"><span class="live-dot"></span> THE CELESTIAL SPHERE <span class="sky-sub">An invitation to look up</span></div><div class="map-tools"><button id="grid" class="tool" aria-pressed="false" title="Toggle coordinate grid">⊞</button></div>
<div class="sky-caption"><span id="coordinates">05h 36m &nbsp; +02°</span><span>J2000 · EQUATORIAL VIEW</span></div><div class="zoom"><button id="plus" aria-label="Zoom in">+</button><span id="zoom-value">1.0×</span><button id="minus" aria-label="Zoom out">−</button><div></div><button id="home" aria-label="Return to Orion" title="Return to Orion">⌖</button></div>
<div class="selection" id="selection"><div class="selection-icon">✦</div><div><div class="eyebrow" id="selection-title">MEET A STAR</div><p id="selection-description">Choose a light. See if you know its name.</p></div><span class="selection-arrow">↖</span></div>
<form id="guess-form" hidden><div class="guess-top"><div><div class="eyebrow" id="star-kind">UNNAMED STAR</div><p id="star-detail"></p></div><button class="quiet" id="close" type="button" aria-label="Close selected star">×</button></div><div class="guess-input"><input id="guess" aria-label="Star name" placeholder="What's this star's name?" autocomplete="off" spellcheck="false" required><button class="submit" type="submit">Name this star <span>↗</span></button></div><p id="feedback" role="status">A name is all it takes. Accents and capitals are optional.</p><div id="nearby"></div></form>
<div class="map-bottom"><span>✥ <span>Drag to explore</span></span><span>⊕ <span>Scroll to zoom</span></span><span>✦ <span>Click a star to name it</span></span></div><div id="loading" role="status">Charting the stars…</div></section></main>
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
 let selected=null,visible=[],showGrid=false,w=0,h=0,nearby=[],keyboardIndex=0;
 const canvas=$('#sky'),ctx=canvas.getContext('2d');
 function update(){
  $('#score').textContent=found.size;document.querySelectorAll('.total').forEach(el=>el.textContent=stars.length);$('#note-count').textContent=String(found.size).padStart(2,'0');$('#percent').textContent=`${(found.size/stars.length*100).toFixed(1)}% of the sky named`;$('#progress-bar').style.width=`${found.size/stars.length*100}%`;
  if(found.size){$('#journal').replaceChildren();[...found].reverse().forEach(id=>{const s=stars.find(s=>s.id===id);const b=document.createElement('button');b.className='discovery';const name=document.createElement('span');name.textContent=s.name;const detail=document.createElement('small');detail.textContent=`${s.constellation} ↗`;b.append(name,detail);b.onclick=()=>{view.ra=s.ra;view.dec=s.dec;choose(s);draw();};$('#journal').append(b);});}
 }
 const p=(ra,dec)=>project(ra,dec,view,w,h);
 function path(coords,color){ctx.beginPath();let last=null;for(const [ra,dec] of coords){const q=p(ra,dec);if(q && last && Math.hypot(q[0]-last[0],q[1]-last[1])<w)ctx.lineTo(...q);else if(q)ctx.moveTo(...q);last=q;}ctx.strokeStyle=color;ctx.lineWidth=.7;ctx.stroke();}
 function draw(){
  ctx.clearRect(0,0,w,h);visible=[];
  if(showGrid){for(let ra=0;ra<360;ra+=15)path(Array.from({length:91},(_,i)=>[ra,-90+i*2]),'#21323f');for(let dec=-75;dec<=75;dec+=15)path(Array.from({length:181},(_,i)=>[i*2,dec]),'#21323f');}
  if(reviewing)for(const line of lines.features)for(const segment of line.geometry.coordinates)path(segment,'#344c5d');
  // Use the same magnitude response for catalogue stars and background stars.
  function paintStar(q,mag,known=false,missed=false){
   const {radius,opacity,halo}=starAppearance(mag,76/view.fov);
   const color=known?'169,233,206':missed?'245,169,100':'211,227,245';
   if(halo>0){const glow=ctx.createRadialGradient(...q,0,...q,radius*5);glow.addColorStop(0,`rgba(${color},${halo})`);glow.addColorStop(.3,`rgba(${color},${halo*.25})`);glow.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=glow;ctx.beginPath();ctx.arc(...q,radius*5,0,Math.PI*2);ctx.fill();}
   ctx.fillStyle=`rgba(${color},${opacity})`;ctx.beginPath();ctx.arc(...q,radius,0,Math.PI*2);ctx.fill();
  }
  for(const s of background){const q=p(...s.geometry.coordinates);if(!q||q[0]<0||q[0]>w||q[1]<0||q[1]>h)continue;paintStar(q,s.properties.mag);}
  for(const s of stars){const q=p(s.ra,s.dec);if(!q||q[0]<-20||q[0]>w+20||q[1]<-20||q[1]>h+20)continue;visible.push({s,q});const known=found.has(s.id);paintStar(q,s.mag,known,reviewing&&!known);
   if(selected?.id===s.id){ctx.strokeStyle='#b0e7cf';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...q,12,0,Math.PI*2);ctx.stroke();}
  }
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
    const candidate={x,y,width};
    if(!labelBoxes.some(b=>x<b.x+b.width+5&&x+width+5>b.x&&y-13<b.y+4&&y+4>b.y-13)){box=candidate;break;}
   }
   box??={x:Math.max(5,Math.min(w-width-5,q[0]+10)),y:Math.max(17,Math.min(h-8,q[1]-8)),width};
   labelBoxes.push(box);const color=found.has(s.id)?'#a9e9ce':'#f5a964';
   if(Math.abs(box.y-(q[1]-8))>10){ctx.beginPath();ctx.moveTo(...q);ctx.lineTo(box.x-3,box.y-4);ctx.strokeStyle=found.has(s.id)?'#a9e9ce55':'#f5a96455';ctx.lineWidth=.6;ctx.stroke();}
   ctx.fillStyle=color;ctx.strokeStyle='#070e16';ctx.lineWidth=3;ctx.strokeText(s.name,box.x,box.y);ctx.fillText(s.name,box.x,box.y);
  }
  $('#zoom-value').textContent=`${(76/view.fov).toFixed(1)}×`;$('#coordinates').textContent=`${String(Math.floor(view.ra/15)).padStart(2,'0')}h ${String(Math.floor(view.ra%15*4)).padStart(2,'0')}m   ${view.dec>=0?'+':''}${view.dec.toFixed(0)}°`;
 }
 function resize(){w=canvas.clientWidth;h=canvas.clientHeight;const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}new ResizeObserver(resize).observe(canvas);
 function choose(s){selected=s;$('#selection').hidden=true;$('#guess-form').hidden=false;const known=found.has(s.id);$('#star-kind').textContent=known||reviewing?s.name:'UNNAMED STAR';$('#star-kind').classList.toggle('missed',reviewing&&!known);$('.guess-input').hidden=reviewing;$('#star-detail').textContent=s.mag==null?'No visual magnitude':`Magnitude ${s.mag.toFixed(2)}`;$('#guess').value='';$('#guess').disabled=known;$('.submit').disabled=known;$('#feedback').textContent=reviewing?(known?'Got it · You named this star.':'Missed · A new name to remember.'):known?'Already in your field notes. One star, one point.':'A name is all it takes. Accents and capitals are optional.';$('#feedback').className=reviewing?(known?'success':'missed'):'';$('#nearby').replaceChildren();if(nearby.length>1)nearby.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${found.has(n.id)||reviewing?n.name:`Nearby star ${i+1}`} ${n.id===s.id?'•':''}`;b.onclick=()=>choose(n);$('#nearby').append(b);});draw();}
 function close(){selected=null;$('#guess-form').hidden=true;$('#selection').hidden=false;draw();}$('#close').onclick=close;
 $('#guess-form').onsubmit=e=>{e.preventDefault();if(reviewing||!selected||found.has(selected.id))return;if(matches(selected,$('#guess').value)){found.add(selected.id);try{storage.setItem('starhopper.discovered',JSON.stringify([...found]));}catch{$('#save-status').textContent='Progress is session-only; storage unavailable';}update();choose(selected);$('#feedback').textContent=found.size===stars.length?'Every star named. The whole sky is yours!':`That's ${selected.name}. +1 point. A familiar face in the sky.`;$('#feedback').className='success';}else{$('#feedback').textContent='Not quite. Take another look and try again.';$('#feedback').className='incorrect';$('#guess').select();}};
 function zoom(f){view.fov=Math.max(3,Math.min(110,view.fov*f));draw();}$('#plus').onclick=()=>zoom(.8);$('#minus').onclick=()=>zoom(1.25);$('#home').onclick=()=>{Object.assign(view,{ra:84,dec:2,fov:76});close();};$('#grid').onclick=()=>{showGrid=!showGrid;$('#grid').classList.toggle('active',showGrid);$('#grid').setAttribute('aria-pressed',showGrid);draw();};canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
 const pointers=new Map();let moved=false,origin=null;
 canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){origin={x:e.clientX,y:e.clientY};moved=false;}else moved=true;};
 canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId),next={x:e.clientX,y:e.clientY};if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(after>0)zoom(before/after);}else{const scale=view.fov/Math.min(w,h);view.ra=(view.ra+(next.x-old.x)*scale+360)%360;view.dec=Math.max(-90,Math.min(90,view.dec+(next.y-old.y)*scale));if(Math.hypot(next.x-origin.x,next.y-origin.y)>5)moved=true;draw();}pointers.set(e.pointerId,next);};
 canvas.onpointerup=e=>{pointers.delete(e.pointerId);if(!moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const candidates=visible.map(v=>({...v,d:Math.hypot(v.q[0]-x,v.q[1]-y)})).filter(v=>v.d<18).sort((a,b)=>a.d-b.d);if(candidates.length){nearby=candidates.map(v=>v.s);const primary=candidates.filter(v=>v.d<=candidates[0].d+3).sort((a,b)=>(a.s.mag??20)-(b.s.mag??20))[0];choose(primary.s);}}};canvas.onpointercancel=e=>{pointers.delete(e.pointerId);moved=true;};
 canvas.onkeydown=e=>{if(e.key==='Escape'){close();$('#grid').focus();return;}if(e.key==='Tab'&&!e.shiftKey&&visible.length){e.preventDefault();nearby=[];choose(visible[keyboardIndex++%visible.length].s);return;}if(e.key==='Enter'&&selected&&!reviewing){e.preventDefault();$('#guess').focus();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')zoom(.8);else if(e.key==='-')zoom(1.25);else{const step=view.fov*.08;if(e.key==='ArrowLeft')view.ra+=step;if(e.key==='ArrowRight')view.ra-=step;if(e.key==='ArrowUp')view.dec+=step;if(e.key==='ArrowDown')view.dec-=step;view.ra=(view.ra+360)%360;view.dec=Math.max(-90,Math.min(90,view.dec));draw();}}};
 function setReview(value){
  reviewing=value;document.body.classList.toggle('reviewing',value);$('#review').hidden=!value;
  $('#done').textContent=value?'Back to exploring':'Done · reveal sky';$('#done').setAttribute('aria-pressed',value);
  $('#selection-title').textContent=value?'YOUR SKY, REVEALED':'MEET A STAR';
  $('#selection-description').textContent=value?'Green: got it. Orange: a name to remember.':'Choose a light. See if you know its name.';
  $('.map-bottom>span:last-child span').textContent=value?'Click a star to inspect it':'Click a star to name it';
  if(value){
   $('#review-summary').textContent=`${found.size} got · ${stars.length-found.size} missed · ${stars.length} stars`;
   const fragment=document.createDocumentFragment();
   [...stars].sort((a,b)=>(a.mag??Infinity)-(b.mag??Infinity)||a.name.localeCompare(b.name)).forEach(s=>{
    const known=found.has(s.id),button=document.createElement('button');button.className=`result ${known?'got':'missed'}`;button.dataset.star=s.id;
    const info=document.createElement('span'),name=document.createElement('strong'),status=document.createElement('small'),mag=document.createElement('span');
    name.textContent=s.name;status.textContent=formatCoordinates(s.ra,s.dec);status.title='Right ascension · Declination (J2000)';button.setAttribute('aria-label',`${s.name}, ${known?'got':'missed'}, ${status.textContent}`);info.append(name,status);mag.textContent=s.mag==null?'—':s.mag.toFixed(2);mag.className='result-mag';button.append(info,mag);
    button.onclick=()=>{view.ra=s.ra;view.dec=s.dec;view.fov=Math.min(view.fov,35);nearby=[];choose(s);document.querySelectorAll('.result[aria-current]').forEach(el=>el.removeAttribute('aria-current'));button.setAttribute('aria-current','true');if(matchMedia('(max-width:700px)').matches)$('.observatory').scrollIntoView({behavior:'smooth',block:'start'});};fragment.append(button);
   });$('#results').replaceChildren(fragment);
  }
  try{storage?.setItem('starhopper.review',String(value));}catch{}
  close();
 }
 $('#done').disabled=false;$('#done').onclick=()=>setReview(!reviewing);
 update();setReview(reviewing);resize();$('#loading').remove();
}
start().catch(error=>{$('#loading').textContent='The sky could not load. Please refresh to try again.';console.error(error);});
