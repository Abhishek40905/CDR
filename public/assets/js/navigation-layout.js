(function(){
const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
const PH=[['I','Acquisition','ᚠ'],['II','Correlation','ᛟ'],['III','Visualisation','ᛉ'],['IV','Investigation','ᛞ']];
const GL={cases:'⌂',records:'☰',search:'⌕',live:'◉',common:'⋈',conf:'⌬',follow:'↠',similar:'◈',exact:'≡',sim:'⇄',group:'▦',map:'◎',graph:'✶',corr:'⚙',kg:'❖',recon:'▶',seq:'⏱',card:'☗'};
const WS=VIEWS.map((v,i)=>[v[2],GL[v[1]]||'◆',[v[1]],Math.max(0,PH.findIndex(p=>p[0]==v[0].split(' · ')[0]))]);
const open=new Set([0]);let lastPh=-1;
const wsOf=v=>WS.findIndex(w=>w[2].includes(v)),last={},nm=id=>(VIEWS.find(x=>x[1]==id)||[])[2]||id;
const cl=()=>{try{return JSON.parse(localStorage.getItem('tcdr_cl')||'[]')}catch(e){return[]}};
const dk=document.createElement('aside');dk.id='dock';document.querySelector('.wrap').append(dk);
function dock(){const c=cur();if(!c){dk.innerHTML='';return}let p=null;try{p=c.suspect?prof(c.suspect):null}catch(e){}const L=p?lvl(p.score):['–','#38b6ff'],u=f=>new Set(rows.map(f)).size;
 dk.innerHTML=`<section class="dkc"><h4>Active matter</h4><b>${esc(c.fir)}</b><p>${esc(c.title)}</p><span class="tag">${esc(c.status)}</span></section>`+
 (p?`<section class="dkc"><h4>Primary subject</h4><div class="gz" style="--p:${p.score};--gc:${L[1]}"><b>${p.score}</b></div><div class="gl2"><b style="color:${L[1]}">${L[0]}</b><span>${esc(c.suspect)}</span></div><table class="mini2"><tr><td>Rule risk</td><td>${p.risk}</td></tr><tr><td>Vector cosine match</td><td>${p.sim}%</td></tr><tr><td>Match entity</td><td style="font-size:11px;word-break:break-word;max-width:130px">${esc(p.simTo)}</td></tr><tr><td>Vector bonus</td><td>${sg(p.bonus)}</td></tr><tr><td>Synergy bonus</td><td>${sg(p.syn)}</td></tr><tr><td>Final score</td><td style="color:${L[1]}">${p.score}</td></tr></table>${p.f.slice(0,4).map(f=>`<div class="note">▸ ${esc(f)}</div>`).join('')}</section>`:'')+
 `<section class="dkc"><h4>Telemetry</h4><table class="mini2"><tr><td>Records</td><td>${rows.length}</td></tr><tr><td>Numbers</td><td>${new Set(rows.flatMap(r=>[r.a,r.b])).size}</td></tr><tr><td>Towers</td><td>${u(r=>r.cell)}</td></tr><tr><td>Handsets</td><td>${u(r=>r.imei)}</td></tr></table></section><section class="dkc"><h4>Quick jump</h4><button class="btn g" data-j="similar">Find similar calls</button><button class="btn g" data-j="recon">Replay movement</button><button class="btn g" data-j="card">Open dossier</button></section>`;
 dk.querySelectorAll('[data-j]').forEach(b=>b.onclick=()=>go(b.dataset.j))}
function layout(v){const wi=wsOf(v);if(wi<0)return;last[wi]=v;const W=WS[wi],c=cl(),ph=W[3],tot=WS.length,done=i=>WS[i][2].every(q=>c.includes(q));
 if(ph!=lastPh){open.add(ph);lastPh=ph}
 $('nav').innerHTML=PH.map((p,pi)=>{const ids=WS.map((w,i)=>i).filter(i=>WS[i][3]==pi),d=ids.filter(done).length;
  return `<div class="phs ${open.has(pi)?'open':''}"><button class="phh" data-ph="${pi}"><u>${p[2]}</u><em>${p[0]}</em><span>${p[1]}</span><small>${d}/${ids.length}</small><i class="car"></i></button><div class="phl">${ids.map(i=>`<button class="ws ${i==wi?'on':done(i)?'done':''}" data-ws="${i}"><i></i><b>${String(i+1).padStart(2,'0')}</b><span>${esc(WS[i][0])}</span></button>`).join('')}</div></div>`}).join('');
 $('nav').querySelectorAll('.ws').forEach(b=>b.onclick=()=>{const i=+b.dataset.ws;go(last[i]||WS[i][2][0])});
 $('nav').querySelectorAll('.phh').forEach(b=>b.onclick=()=>{const i=+b.dataset.ph;open.has(i)?open.delete(i):open.add(i);b.parentElement.classList.toggle('open',open.has(i))});
 $('crumb').innerHTML=`<div class="n">${String(wi+1).padStart(2,'0')}</div><div style="min-width:0"><small>Phase ${PH[ph][0]} — ${PH[ph][1]} · Stage ${wi+1} of ${tot}</small><div class="wsn">${esc(W[0])}</div><div class="seg">${WS.map((w,i)=>`<i class="${i<wi?'d':i==wi?'a':''}" data-go="${i}" title="${String(i+1).padStart(2,'0')} · ${esc(w[0])}"></i>`).join('')}</div></div>`+(W[2].length>1?`<div class="stabs">${W[2].map(id=>`<button class="${id==v?'on':''}" data-v="${id}">${esc(nm(id))}</button>`).join('')}</div>`:'');
 $('crumb').querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));$('crumb').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(WS[+b.dataset.go][2][0]));
 const pw=WS[wi-1],nw=WS[wi+1];$('pager').innerHTML=(pw?`<button data-g="${wi-1}"><small>◂ Previous stage</small>${esc(pw[0])}</button>`:'<span></span>')+(nw?`<button class="nx" data-g="${wi+1}"><small>Next stage ▸</small>${esc(nw[0])}</button>`:'');
 $('pager').querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{go(WS[+b.dataset.g][2][0]);scrollTo({top:0,behavior:'smooth'})});dock()}
const _g=go;go=function(v){const r=_g.apply(this,arguments);try{layout(v)}catch(e){console.error(e)}return r};layout(view);
if(rm)return;
const cv=document.createElement('canvas');cv.id='ag';document.body.prepend(cv);const x=cv.getContext('2d');let W,H,mx=-999,my=-999,zg=true,G=-.02;
const rz=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight};rz();addEventListener('resize',rz);if($('fx'))$('fx').style.display='none';
const mk=r=>({x:Math.random()*W,y:r?Math.random()*H:H+20,vx:(Math.random()-.5)*.3,vy:-Math.random()*.4,s:2+Math.random()*7,t:Math.random()*4|0,a:Math.random()*6.28,w:(Math.random()-.5)*.03});
const P=Array.from({length:Math.min(80,innerWidth/16|0)},()=>mk(true));
const shape=p=>{x.save();x.translate(p.x,p.y);x.rotate(p.a);x.beginPath();if(p.t==0)x.arc(0,0,p.s/2,0,6.28);else if(p.t==1)x.rect(-p.s/2,-p.s/2,p.s,p.s);else if(p.t==2){x.moveTo(0,-p.s/2);x.lineTo(p.s/2,p.s/2);x.lineTo(-p.s/2,p.s/2);x.closePath()}else{x.lineWidth=1.8;x.arc(0,0,p.s*.65,0,6.283)}
 x.globalAlpha=.25+p.s/14;if(p.t>0)x.stroke();else x.fill();x.restore()};
addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY},{passive:true});
addEventListener('pointerdown',e=>{if(e.target.closest('#intro'))return;P.forEach(p=>{const dx=p.x-e.clientX,dy=p.y-e.clientY,d=Math.hypot(dx,dy);if(d<240&&d>1){const f=(1-d/240)*5;p.vx+=dx/d*f;p.vy+=dy/d*f}})});
const b=document.createElement('button');b.id='zg';b.className='btn g';b.textContent='◌ Zero‑G';b.title='Toggle anti-gravity';$('xp').append(b);
b.onclick=()=>{zg=!zg;G=zg?-.02:.06;b.textContent=zg?'◌ Zero‑G':'▼ Gravity';P.forEach(p=>p.vy+=zg?-1.5:0)};
(function f(){requestAnimationFrame(f);if(document.hidden)return;x.clearRect(0,0,W,H);x.fillStyle=x.strokeStyle=window._ph||'#19d3a2';x.lineWidth=1.2;
 for(const p of P){p.vy+=G;const dx=p.x-mx,dy=p.y-my,d=Math.hypot(dx,dy);if(d<150&&d>1){const f=(1-d/150)*.5;p.vx+=dx/d*f;p.vy+=dy/d*f}
  p.vx*=.985;p.vy*=.985;if(G<0&&p.vy<-.7)p.vy=-.7;p.x+=p.vx;p.y+=p.vy;p.a+=p.w+p.vx*.01;if(p.x<-20)p.x=W+20;if(p.x>W+20)p.x=-20;
  if(G<0){if(p.y<-24)Object.assign(p,mk(false))}else if(p.y>H-p.s/2){p.y=H-p.s/2;p.vy*=-.5;p.vx*=.96}shape(p)}})();
})();
