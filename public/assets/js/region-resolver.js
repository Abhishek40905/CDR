/* ===== Region resolver: makes interstate / international comets work for ANY data ===== */
(function(){
const $=id=>document.getElementById(id),LS=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
let RG=LS('tcdr_rg',{});window._RG=RG;const save=()=>{try{localStorage.setItem('tcdr_rg',JSON.stringify(RG))}catch(e){}};
const rk=p=>(+p.lat).toFixed(1)+','+(+p.lon).toFixed(1),xy=p=>isFinite(parseFloat(p.lat))&&isFinite(parseFloat(p.lon));
const reg0=reg;
window.reg=function(p){if(!p.state&&!p.country&&xy(p)){const g=RG[rk(p)];if(g&&(g[0]||g[1]))return{st:g[0]||'?',co:g[1]||'India'}}return reg0(p)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const missing=()=>{const q={};rows.forEach(r=>{if(r.state||r.country||!xy(r))return;const k=rk(r);if(!RG[k]&&!q[k])q[k]=r});return Object.values(q)};
async function resolve(say){if(window._rgBusy)return;const todo=missing().slice(0,40);if(!todo.length)return;window._rgBusy=1;let n=0,fail=false;
 for(const r of todo){say(`Resolving state/country for map comets… ${++n}/${todo.length}`);try{const res=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=5&accept-language=en&lat=${(+r.lat).toFixed(2)}&lon=${(+r.lon).toFixed(2)}`,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error('HTTP '+res.status);const j=await res.json(),a=j.address||{};RG[rk(r)]=[a.state||a.region||a.state_district||a.province||'',a.country||''];await sleep(1100)}catch(e){fail=true;break}}
 save();for(const k in RC)delete RC[k];window._rgBusy=0;
 if(fail){say('Region lookup needs internet. Comets appear when each tower has a State/Country (add the columns to your CDR or tower DB) or when you are online.');return}
 if(missing().length){say('Resolved '+todo.length+' places; more remain – press Track again to continue.')}else say('Regions resolved – comets are active.');
 const g=$('go');if(g&&view=='map')g.onclick()}
const vm=V.map;V.map=function(){vm.apply(this,arguments);const o=$('olk');if(!o)return;o.insertAdjacentHTML('beforebegin','<div class="note" id="rgs"></div>');const say=t=>{const e=$('rgs');if(e)e.textContent=t};
 if(missing().length)resolve(say)};
})();
