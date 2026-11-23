/* ===== Map diagnostics, no-coordinate help and tile fallback ===== */
(function(){
const $=id=>document.getElementById(id),xy=r=>isFinite(parseFloat(r.lat))&&isFinite(parseFloat(r.lon))&&r.lat!==''&&r.lon!=='';
const vm=V.map;
V.map=function(){vm.apply(this,arguments);const row=document.querySelector('#main .mp');if(!row)return;
 const loc=rows.filter(xy),cells=new Set(loc.map(r=>r.cell)).size,noXY=rows.length-loc.length,hasLib=typeof L!=='undefined';
 row.insertAdjacentHTML('beforebegin','<div id="mst" class="note"></div>');
 const st=t=>{const e=$('mst');if(e)e.innerHTML=t},base=()=>`${hasLib?'✓':'✗'} map library · ${loc.length.toLocaleString()} of ${rows.length.toLocaleString()} records have coordinates · ${cells} located towers`;
 st(base()+(hasLib?'':' — <b style="color:#ff3b6b">the map library did not load.</b> Check your internet connection and open this file in a full browser (Chrome/Safari), not inside a WhatsApp or file-manager preview.'));
 if(!loc.length){row.insertAdjacentHTML('beforebegin',`<div class="cs on" id="nox" style="margin:8px 0"><b>Nothing to draw yet: this case has no tower coordinates.</b><div class="note">Tracking needs a latitude and longitude for every cell ID. Your CDR only has the cell ID${rows.some(r=>r.addr)?' and tower address':''}. Pick one:</div><div class="row" style="margin-top:6px"><button class="btn" id="nx1">Geocode tower addresses online</button><label class="btn g">Import tower DB (cell → lat/long)<input type="file" id="nx2" accept=".csv,.txt,.xlsx" hidden></label><button class="btn g" id="nx3">Re-map columns (Import CDR)</button></div><div class="note" id="nxm">${rows.some(r=>r.addr)?'Addresses found – online geocoding uses OpenStreetMap (about 1 request per second).':'No address column either, so a tower database is needed.'}</div></div>`);
  const say=t=>{const e=$('nxm');if(e)e.textContent=t};
  $('nx1').onclick=()=>{$('nx1').disabled=true;_tc.geoEnrich(say).then(()=>V.map()).catch(e=>say('Failed: '+e.message))};
  $('nx3').onclick=()=>$('file').click();
  $('nx2').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{let out;if(/\.xlsx$/i.test(f.name)){await _tc.loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});out=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''}).map(r=>r.map(x=>String(x).trim()))}else out=_tc.rawParse(await f.text()).out;
   const T=_tc.toTable(out),m=_tc.autoMap(T.hdr);if(m.cell<0||m.lat<0||m.lon<0){say('Need columns for cell id, latitude and longitude. Found: '+T.hdr.join(', '));return}
   const D=_tc.TDBref();let n=0;T.data.forEach(r=>{const la=_tc.coord(r[m.lat],90),lo=_tc.coord(r[m.lon],180);if(r[m.cell]&&la&&lo){D[String(r[m.cell]).trim()]=[+la,+lo,m.addr>=0?r[m.addr]:'',m.state>=0?r[m.state]:'',m.country>=0?r[m.country]:''];n++}});
   try{localStorage.setItem('tcdr_towers',JSON.stringify(D))}catch(x){}const a=_tc.applyDB();_tc.sync();say(n+' towers loaded · '+a+' records located');V.map()}catch(x){say('Tower DB import failed: '+x.message)}}}
 else if(noXY)st($('mst').innerHTML+` · <span style="color:#19d3a2">${noXY} records without coordinates are skipped</span>`);
 /* tile fallback: Google's tile server is unofficial and can be blocked; fall back to OpenStreetMap */
 try{const sl=window._street;if(hasLib&&sl&&sl.on){let bad=0,done=0;sl.on('tileerror',()=>{if(done||++bad<4)return;done=1;const m=sl._map;if(!m)return;m.removeLayer(sl);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);const e=$('mst');if(e)e.innerHTML+=' · <span style="color:#19d3a2">Google tiles blocked – switched to OpenStreetMap</span>'})}}catch(e){}
 /* explain an empty track */
 const go=$('go');if(go){const g0=go.onclick;go.onclick=()=>{g0();const T=$('tg').value,n=rows.filter(r=>r.a==T&&xy(r)).length,mm=$('mst');if(mm&&!n&&loc.length)mm.innerHTML=base()+` · <b style="color:#ff3b6b">${T} has no located records as A-party</b> – tracking follows the number in the A-Party column. Pick another number or add coordinates.`}}};
})();
