(function(){const o=$('intro'),tc=$('tc');if(!o||!tc||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const C=[[600,'<em>In a city of a billion calls…</em>'],[3600,'<em>…one number is lying.</em>'],[6600,'<h2>TRACE<b>CDR</b></h2><em>Every call leaves a trace.</em>']];
o.classList.add('cine');C.forEach((c,i)=>setTimeout(()=>{if($('intro'))tc.innerHTML='<div class="tcard'+(i==2?' big':'')+'">'+c[1]+'</div>'},c[0]));
setTimeout(()=>{tc.innerHTML='';o.classList.remove('cine')},10200)})();
