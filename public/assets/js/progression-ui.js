(function(){
const rm=matchMedia('(prefers-reduced-motion:reduce)').matches,PC=['#19d3a2','#38b6ff','#7dffb2'],RU=['ᚠ','ᛟ','ᛉ'],PHS=[...new Set(VIEWS.map(v=>v[0]))];
const RK=[[0,'Initiate'],[300,'Tracker'],[700,'Warden'],[1200,'Sentinel'],[1800,'Archmage of Signals']];
let cl=[];try{cl=JSON.parse(localStorage.getItem('tcdr_cl')||'[]')}catch(e){}
const save=()=>{try{localStorage.setItem('tcdr_cl',JSON.stringify(cl))}catch(e){}};
const done=p=>VIEWS.filter(v=>v[0]==p).every(v=>cl.includes(v[1]));
const XP=()=>cl.length*100+PHS.filter(done).length*300,rk=x=>{let r=0;RK.forEach((k,i)=>{if(x>=k[0])r=i});return r};
const ts=document.createElement('div');ts.id='ts';document.body.append(ts);
const toast=()=>{};
let ac,snd=true;try{snd=localStorage.getItem('tcdr_snd')!=='0'}catch(e){}
const bp=(f,d=.08,ty='square',v=.025)=>{if(!snd)return;try{ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume();const o=ac.createOscillator(),g=ac.createGain();o.type=ty;o.frequency.value=f;g.gain.setValueAtTime(v,ac.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}};
const xp=document.createElement('div');xp.id='xp';xp.title='Use ← → to move between stages';xp.innerHTML='<button id="snd" class="btn g">♪ On</button>';
const hd=document.querySelector('header');hd.insertBefore(xp,hd.children[2]||null);
const hud=()=>{};
$('snd').textContent=snd?'♪ On':'♪ Off';
$('snd').onclick=()=>{snd=!snd;try{localStorage.setItem('tcdr_snd',snd?'1':'0')}catch(e){}$('snd').textContent=snd?'♪ On':'♪ Off';bp(660,.1)};
window._bp=bp;
const unlock=()=>{try{ac=ac||new AudioContext();if(ac.state==='suspended')ac.resume()}catch(e){}};['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,unlock,{passive:true}));
/* whoosh + rising chime on every navigation */
const whoosh=(i)=>{if(!snd)return;try{ac=ac||new AudioContext();const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type='sawtooth';f.type='bandpass';f.Q.value=2;f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(3200,t+.35);o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(520,t+.35);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.05,t+.12);g.gain.exponentialRampToValueAtTime(.0001,t+.45);o.connect(f);f.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.5)}catch(e){}
 const b=[392,440,494,523,587,659,698,784][i%8];setTimeout(()=>bp(b,.14,'triangle',.05),120);setTimeout(()=>bp(b*1.5,.2,'sine',.035),230)};
const award=i=>{const v=VIEWS[i];if(cl.includes(v[1]))return;const r0=rk(XP());cl.push(v[1]);save();bp(520,.09);setTimeout(()=>bp(780,.12),90);
 if(done(v[0])){setTimeout(()=>{bp(660,.1);bp(990,.2)},300)}
 const r1=rk(XP());hud()};
const wp=document.createElement('div');wp.id='wp';wp.innerHTML='<span></span>';document.body.append(wp);
const wipe=i=>{if(rm)return;wp.innerHTML='<small>Phase '+VIEWS[i][0].replace(' · ',' — ')+'</small><span>Stage '+String(i+1).padStart(2,'0')+' · '+VIEWS[i][2]+'</span>';wp.classList.remove('go');void wp.offsetWidth;wp.classList.add('go')};
const scr=el=>{if(!el||rm)return;const t=el.textContent;let n=0;const iv=setInterval(()=>{n++;el.textContent=t.split('').map((c,i)=>c==' '||i<n/1.5?c:'▓▒░ᚠᚢᚦ01'[Math.random()*8|0]).join('');if(n>t.length*1.5){el.textContent=t;clearInterval(iv)}},28)};
const deco=()=>{document.querySelectorAll('nav h4').forEach((h,i)=>h.insertAdjacentHTML('afterbegin','<u>'+RU[i]+'</u>'));
 document.querySelectorAll('nav button').forEach((b,i)=>{if(VIEWS[i]&&cl.includes(VIEWS[i][1])&&!b.classList.contains('on'))b.classList.add('cl')});
 document.querySelectorAll('#pager small').forEach(s=>{if(!s.dataset.k){s.dataset.k=1;s.textContent+=s.textContent.includes('Next')?'  [→]':'  [←]'}})};
const col=i=>{const b=$('phb');let c=b&&getComputedStyle(b).getPropertyValue('--ph').trim();if(!c)c=PC[PHS.indexOf(VIEWS[i][0])]||PC[0];document.documentElement.style.setProperty('--ph',c);window._ph=c};
const _go=go;go=function(v){const old=view,r=_go.apply(this,arguments),i=VIEWS.findIndex(x=>x[1]==v);
 if(!$('intro')){if(old!=v){wipe(i);whoosh(i)}award(i);scr(document.querySelector('main h2'))}
 deco();col(i);setTimeout(()=>col(i),90);return r};
{const o=new MutationObserver(()=>{if(!$('intro')){o.disconnect();const i=VIEWS.findIndex(x=>x[1]==view);award(i)}});o.observe(document.body,{childList:true})}
deco();col(Math.max(0,VIEWS.findIndex(x=>x[1]==view)));hud();
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,select,textarea,.leaflet-container')||e.ctrlKey||e.metaKey||e.altKey||$('intro'))return;const i=VIEWS.findIndex(x=>x[1]==view),n=e.key=='ArrowRight'?i+1:e.key=='ArrowLeft'?i-1:-1;if(n>=0&&n<VIEWS.length){go(VIEWS[n][1]);scrollTo({top:0,behavior:'smooth'})}});
addEventListener('pointerdown',e=>{if(rm||e.target.closest('#intro'))return;for(let k=0;k<9;k++){const s=document.createElement('div');s.className='bs';s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';document.body.append(s);const a=k/9*6.283+Math.random()*.5,d=30+Math.random()*34;s.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(.1) rotate(180deg)`,opacity:0}],{duration:600,easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish=()=>s.remove()}});
let lo=null;addEventListener('pointerover',e=>{const t=e.target.closest&&e.target.closest('nav button,.btn,#pager button');if(t&&t!==lo)bp(900,.03,'sine',.015);lo=t});
addEventListener('pointermove',e=>{const m=e.target.closest&&e.target.closest('.btn,#pager button');if(m&&!rm){const r=m.getBoundingClientRect();m.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.16}px,${(e.clientY-r.top-r.height/2)*.22}px)`}
 const w=e.target.closest&&e.target.closest('.tw');if(w){const r=w.getBoundingClientRect();w.style.setProperty('--mx',e.clientX-r.left+'px');w.style.setProperty('--my',e.clientY-r.top+'px')}},{passive:true});
addEventListener('pointerout',e=>{const m=e.target.closest&&e.target.closest('.btn,#pager button');if(m)m.style.transform=''});
if(rm)return;
const cv=document.createElement('canvas');cv.id='fx';document.body.prepend(cv);const x=cv.getContext('2d');let W,H,mx=-999,my=-999;const P=[];
const rz=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight};rz();addEventListener('resize',rz);
for(let i=0;i<Math.min(70,innerWidth/18|0);i++)P.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,s:1+Math.random()*1.6});
addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY},{passive:true});
(function f(){requestAnimationFrame(f);if(document.hidden)return;x.clearRect(0,0,W,H);x.fillStyle=x.strokeStyle=window._ph||'#19d3a2';
 for(const p of P){const dx=p.x-mx,dy=p.y-my,d=dx*dx+dy*dy;if(d<16000&&d>1){p.x+=dx/Math.sqrt(d)*.9;p.y+=dy/Math.sqrt(d)*.9}p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;x.globalAlpha=.55;x.fillRect(p.x,p.y,p.s*1.5,p.s*1.5)}
})();
})();
