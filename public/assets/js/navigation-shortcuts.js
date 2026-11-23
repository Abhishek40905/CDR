(function(){
const $$=id=>document.getElementById(id),bp=(...a)=>window._bp&&window._bp(...a);
const toast2=t=>{const e=document.createElement('div');e.className='tt2';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2100)};
/* scroll progress + back to top + palette button */
const pb=document.createElement('div');pb.id='spb';const bt=document.createElement('button');bt.id='btt';bt.textContent='↑';bt.title='Back to top';
const kb=document.createElement('button');kb.id='kbtn';kb.textContent='⌘';kb.title='Quick jump (Ctrl/⌘+K or /)';document.body.append(pb,bt,kb);
addEventListener('scroll',()=>{const h=document.documentElement,m=h.scrollHeight-innerHeight;pb.style.width=(m>0?scrollY/m*100:0)+'%';bt.classList.toggle('on',scrollY>500)},{passive:true});
bt.onclick=()=>{bp(600,.08,'sine',.04);scrollTo({top:0,behavior:'smooth'})};
/* command palette */
const cm=document.createElement('div');cm.id='cmd';cm.innerHTML='<div class="bx"><input id="cq" placeholder="Jump to any stage… (type to search)" autocomplete="off"><ul id="cl2"></ul><div class="ft">↑ ↓ navigate · Enter open · Esc close</div></div>';document.body.append(cm);
let sel=0,list=[];
const render=()=>{const q=$$('cq').value.trim().toLowerCase();list=VIEWS.map((v,i)=>({v,i})).filter(o=>!q||(o.v[2]+' '+o.v[3]+' '+o.v[0]).toLowerCase().includes(q));sel=Math.min(sel,Math.max(0,list.length-1));
 $$('cl2').innerHTML=list.map((o,k)=>`<li class="${k==sel?'sel':''}" data-k="${k}"><b>${String(o.i+1).padStart(2,'0')}</b>${o.v[2]}<small>${o.v[0].split(' · ')[1]}</small></li>`).join('')||'<li>No matching stage</li>';const s=$$('cl2').querySelector('.sel');if(s)s.scrollIntoView({block:'nearest'})};
const openC=()=>{if($$('intro'))return;cm.classList.add('on');$$('cq').value='';sel=0;render();$$('cq').focus();bp(800,.05,'sine',.04)},closeC=()=>cm.classList.remove('on'),pick=k=>{const o=list[k];if(!o)return;closeC();go(o.v[1]);scrollTo({top:0,behavior:'smooth'})};
kb.onclick=openC;cm.onclick=e=>{if(e.target===cm)closeC()};
$$('cq').oninput=()=>{sel=0;render()};
$$('cl2').onclick=e=>{const l=e.target.closest('li[data-k]');if(l)pick(+l.dataset.k)};
$$('cl2').onpointermove=e=>{const l=e.target.closest('li[data-k]');if(l&&+l.dataset.k!==sel){sel=+l.dataset.k;render()}};
addEventListener('keydown',e=>{const t=e.target,typing=t.closest&&t.closest('input,select,textarea,.leaflet-container');
 if((e.key==='k'&&(e.ctrlKey||e.metaKey))||(e.key==='/'&&!typing)){e.preventDefault();cm.classList.contains('on')?closeC():openC();return}
 if(!cm.classList.contains('on')){if(e.key==='Escape')closeDr();return}
 if(e.key==='Escape')closeC();else if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(list.length-1,sel+1);render();bp(900,.02,'sine',.015)}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);render();bp(900,.02,'sine',.015)}else if(e.key==='Enter'){e.preventDefault();pick(sel)}},true);
/* nav search filter */
const addNF=()=>{const n=$$('nav');if(!n||$$('nf'))return;const i=document.createElement('input');i.id='nf';i.placeholder='Filter stages…';n.prepend(i);i.oninput=()=>{const q=i.value.toLowerCase();n.querySelectorAll('button').forEach(b=>b.style.display=!q||b.textContent.toLowerCase().includes(q)?'':'none');n.querySelectorAll('h4').forEach(h=>h.style.display=q?'none':'')};i.onkeydown=e=>e.stopPropagation()};
new MutationObserver(addNF).observe($$('nav'),{childList:true});addNF();
/* record detail drawer */
const dr=document.createElement('aside');dr.id='dr';document.body.append(dr);let actRow=null;
const closeDr=()=>{dr.classList.remove('on');if(actRow)actRow.classList.remove('act')};
const mark=()=>document.querySelectorAll('main table').forEach(t=>{const th=t.querySelectorAll('thead tr:first-child th').length;if(th!==COLS.length)return;t.querySelectorAll('tbody tr').forEach(r=>r.dataset.rec=1)});
new MutationObserver(mark).observe($$('main'),{childList:true,subtree:true});mark();
document.addEventListener('click',e=>{if(e.target.closest('#dr .x')){closeDr();return}
 const tr=e.target.closest&&e.target.closest('tbody tr[data-rec]');if(!tr){if(!e.target.closest('#dr'))closeDr();return}
 const idx=[...tr.parentNode.children].indexOf(tr),r=(typeof shown!=='undefined')&&shown[idx];if(!r)return;
 if(actRow)actRow.classList.remove('act');actRow=tr;tr.classList.add('act');bp(760,.06,'sine',.04);
 const q=encodeURIComponent(r.lat+','+r.lon);
 dr.innerHTML=`<button class="x">×</button><h3>Call record</h3><small style="color:var(--mut)">Click any value to copy it</small><dl>${COLS.map(k=>`<dt>${LBL[k]}</dt><dd data-c="${esc(r[k])}">${esc(r[k])||'–'}</dd>`).join('')}</dl><div class="row"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${q}">Open tower on map ↗</a></div>`;dr.classList.add('on')});
document.addEventListener('click',e=>{const d=e.target.closest&&e.target.closest('#dr dd[data-c]');if(!d)return;const v=d.dataset.c;try{navigator.clipboard.writeText(v)}catch(_){}bp(1000,.05,'sine',.04);toast2('Copied · '+v)});
})();
