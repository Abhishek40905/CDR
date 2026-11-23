(function(){document.documentElement.dataset.theme=document.documentElement.dataset.theme||'dark';const tel=()=>{try{const n=new Set(),t=new Set();rows.forEach(r=>{if(r.a)n.add(r.a);if(r.b)n.add(r.b);if(r.cell)t.add(r.cell)});$('tel').textContent=rows.length+' records · '+n.size+' subscribers · '+t.size+' towers'}catch(e){}};const _s=stats;stats=function(){const x=_s.apply(this,arguments);tel();return x};tel();
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches,reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const io=new MutationObserver(()=>{if(!document.getElementById('intro')){document.body.classList.add('rv');io.disconnect()}});io.observe(document.body,{childList:true});
return;
const d=document.createElement('div');d.id='cd';document.body.append(d);
addEventListener('pointermove',e=>{d.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)';d.classList.toggle('h',!!e.target.closest('a,button,select,input,label,th,tr,.bar,.btn,g[data-n],[onclick]'))},{passive:true});
addEventListener('pointerdown',()=>d.classList.add('d'));addEventListener('pointerup',()=>d.classList.remove('d'));
})();
