(function(){
const MAP=['records','search','sim','recon','card','live','records'],rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
const dec=()=>document.querySelectorAll('#cards .card').forEach((c,i)=>{if(c.dataset.ix)return;c.dataset.ix=1;c.tabIndex=0;c.setAttribute('role','button');c.dataset.v=MAP[i]||'records';c.insertAdjacentHTML('beforeend','<em class="go">Open ▸</em>')});
const mo=new MutationObserver(dec);mo.observe(document.getElementById('cards'),{childList:true});dec();
const open=c=>{const v=c.dataset.v;if(!v||typeof go!=='function')return;c.classList.remove('pulse');void c.offsetWidth;c.classList.add('pulse');window._bp&&window._bp(700,.06,'sine',.04);setTimeout(()=>{go(v);scrollTo({top:document.querySelector('.wrap').offsetTop-10,behavior:'smooth'})},180)};
document.addEventListener('click',e=>{const c=e.target.closest&&e.target.closest('#cards .card');if(!c)return;const r=c.getBoundingClientRect(),d=Math.max(r.width,r.height)*2,rp=document.createElement('span');rp.className='rip';rp.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;c.append(rp);setTimeout(()=>rp.remove(),650);open(c)});
document.addEventListener('keydown',e=>{const c=e.target.closest&&e.target.closest('#cards .card');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(c)}});
document.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest('#cards .card');if(!c)return;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;c.style.setProperty('--cx',x*100+'%');c.style.setProperty('--cy',y*100+'%');if(!rm)c.style.transform=`perspective(600px) rotateX(${(.5-y)*10}deg) rotateY(${(x-.5)*12}deg) translateY(-3px)`},{passive:true});
document.addEventListener('pointerout',e=>{const c=e.target.closest&&e.target.closest('#cards .card');if(c&&!c.contains(e.relatedTarget))c.style.transform=''});
document.addEventListener('pointerover',e=>{const c=e.target.closest&&e.target.closest('#cards .card');if(c&&!c.contains(e.relatedTarget))window._bp&&window._bp(1100,.03,'sine',.012)});
/* count-up animation every time the numbers refresh */
const cu=()=>document.querySelectorAll('#cards b[data-n]').forEach(el=>{if(el.dataset.a===el.dataset.n)return;el.dataset.a=el.dataset.n;const n=+el.dataset.n,t0=performance.now();(function f(t){const p=Math.min(1,(t-t0)/600);el.textContent=Math.round(n*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f)})(t0)});
new MutationObserver(()=>setTimeout(cu,0)).observe(document.getElementById('cards'),{childList:true});
})();
