/* ===== TraceCDR data engine: real import, mapping, tower DB, geocoding, live source, storage ===== */
(function(){
const $=id=>document.getElementById(id),LS=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const p2=n=>String(n).padStart(2,'0'),norm=h=>String(h).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const flash=t=>{const e=document.createElement('div');e.className='tt2';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),3200)};
const FIELDS=[['a','A-Party (calling) *'],['b','B-Party (called) *'],['datetime','Date & time (combined)'],['date','Date *'],['time','Time'],['dur','Duration'],['type','Call type'],['imei','IMEI'],['imsi','IMSI'],['cell','Cell ID'],['addr','Tower address'],['lat','Latitude'],['lon','Longitude'],['state','State / circle'],['country','Country']];
const ORDER=['a','b','datetime','dur','date','time','type','imei','imsi','cell','lat','lon','addr','state','country'];
const SYN={a:h=>/^a$/.test(h)||/\b(a ?party|a ?number|a ?no|a ?num|calling|caller|msisdn|originat|source)\b/.test(h),
 b:h=>/^b$/.test(h)||/^to$/.test(h)||/\b(b ?party|b ?number|b ?no|b ?num|called|callee|destination|dialled|dialed|other ?(party|number|no))\b/.test(h),
 datetime:h=>/(date ?(and )?time|time ?stamp|start ?date ?time|call ?start ?(date|time ?stamp))/.test(h),dur:h=>/(dur|call ?length|talk ?time|^secs?$|seconds)/.test(h),
 date:h=>/date/.test(h)&&!/time|stamp/.test(h),time:h=>/time/.test(h)&&!/date|stamp|zone|dur|talk|time ?stamp/.test(h),
 type:h=>/(call ?type|^type$|service|direction|record ?type|usage ?type|cdr ?type|^category$)/.test(h),imei:h=>/imei/.test(h),imsi:h=>/imsi/.test(h),
 cell:h=>/(cell ?id|^cgi|first ?cell|^cell$|^cid$|site ?id|bts ?id|tower ?id|cell ?global|^ci$)/.test(h),addr:h=>/(addr|site ?(name|location)|location|tower ?(name|loc)|bts ?(name|addr))/.test(h),
 lat:h=>/\blat(itude)?\b/.test(h),lon:h=>/\b(lon|lng|long|longitude)\b/.test(h),state:h=>/(state|circle|region|^lsa$)/.test(h),country:h=>/country/.test(h)};
/* ---- raw parsing ---- */
function rawParse(t){t=String(t).replace(/^\uFEFF/,'');const f=t.split(/\r?\n/,6).join('\n'),D=[',',';','\t','|'].map(d=>[d,f.split(d).length-1]).sort((a,b)=>b[1]-a[1])[0][0],out=[];let row=[],c='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}else if(ch=='"')q=true;else if(ch==D){row.push(c);c=''}else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;row.push(c);c='';if(row.some(x=>x.trim()!==''))out.push(row);row=[]}else c+=ch}
 row.push(c);if(row.some(x=>x.trim()!==''))out.push(row);return{D,out:out.map(r=>r.map(x=>String(x).trim()))}}
function toTable(out){if(out[0]&&/^BW-CDR-/i.test(String(out[0][0]||''))){const n=Math.max(...out.slice(0,3).map(r=>r.length));return{hdr:Array.from({length:n},(_,i)=>'Column '+(i+1)),data:out.filter(r=>r.some(x=>String(x).trim()!=='')),hi:-1}}const sc=r=>{let n=0;r.forEach(h=>{const x=norm(h);if(x)for(const k in SYN)if(SYN[k](x)){n++;break}});return n};let hi=0,best=-1;out.slice(0,15).forEach((r,i)=>{const n=sc(r);if(n>best&&r.length>=3){best=n;hi=i}});if(best<2)hi=0;
 return{hdr:(out[hi]||[]).map((h,i)=>h||('Column '+(i+1))),data:out.slice(hi+1).filter(r=>r.some(x=>String(x).trim()!=='')),hi}}
function autoMap(hdr,data){const map={};FIELDS.forEach(f=>map[f[0]]=-1);const H=hdr.map(norm),find=(...names)=>names.map(n=>H.indexOf(n)).find(i=>i>=0);const used=new Set();ORDER.forEach(k=>{const i=hdr.findIndex((h,j)=>!used.has(j)&&SYN[k](norm(h)));if(i>=0){map[k]=i;used.add(i)}});
 if(H.includes('tme')&&H.includes('clng')&&H.includes('cled'))Object.assign(map,{datetime:find('tme'),a:find('clng'),b:find('cled'),dur:find('dur'),type:find('typ')});
 if(H.includes('imsi')&&H.includes('to imsi'))Object.assign(map,{a:find('imsi'),b:find('to msisdn','to imsi'),imsi:find('imsi'),date:find('start date'),time:find('start time'),dur:find('duration'),type:find('type'),cell:find('location id'),aImsi:true});
 if(H.includes('a number')&&H.includes('b number'))Object.assign(map,{a:find('a number'),b:find('b number'),imsi:find('imsi'),imei:find('imei'),datetime:find('start time'),dur:find('call network volume'),type:find('call type'),lat:find('latitude'),lon:find('longitude'),addr:find('location')});
 if(H[0]==='column 1'&&data&&data[0]&&/^BW-CDR-/i.test(String(data[0][0]||'')))Object.assign(map,{a:3,b:8,datetime:9,offset:10,dur:14,type:15});
 for(const k of ['a','b','datetime','date','time','offset','dur','type','imei','imsi','cell','lat','lon','addr'])if(map[k]>=0)used.add(map[k]);
 if(data&&data.length){const S=data.slice(0,30),frac=(j,f)=>S.filter(r=>f(String(r[j]==null?'':r[j]).trim())).length/S.length;
  if(map.date<0&&map.datetime<0){for(let j=0;j<hdr.length;j++){if(used.has(j))continue;if(frac(j,v=>{const d=v&&parseDT(v,true);return d&&d.date})>=.6){map.datetime=j;used.add(j);break}}}
  const isNo=v=>/^\+?[\d\s\-()]{10,16}$/.test(v)&&v.replace(/\D/g,'').length>=10;
  ['a','b'].forEach(k=>{if(map[k]<0){for(let j=0;j<hdr.length;j++){if(used.has(j))continue;if(frac(j,isNo)>=.7){map[k]=j;used.add(j);break}}}})}
 return map}
/* ---- value normalisers ---- */
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const xl=n=>{const d=new Date(Math.round((n-25569)*864e5));return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()]};
function parseDT(v,df){let s=String(v==null?'':v).trim();if(!s)return null;let m;
 if(/^\d{10}$/.test(s)||/^\d{13}$/.test(s)){const d=new Date(+s*(s.length==10?1000:1));return isNaN(d.getTime())?null:{date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,19)}}
 if(m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?$/))return{date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]+':'+m[6]};
 if(/^\d+(\.\d+)?$/.test(s)){const n=+s;if(n>20000&&n<80000){const a=xl(n);return{date:a[0]+'-'+p2(a[1])+'-'+p2(a[2]),time:n%1?p2(a[3])+':'+p2(a[4])+':'+p2(a[5]):''}}
  if(n>=0&&n<1){const x=Math.round(n*86400);return{date:'',time:p2(x/3600|0)+':'+p2(x%3600/60|0)+':'+p2(x%60)}}
  if(/^\d{8}$/.test(s))return{date:s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6),time:''};
  if(m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/))return{date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]+':'+m[6]};return null}
 if(m=s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i)){let h=+m[1];if(m[4])h=h%12+(/pm/i.test(m[4])?12:0);return{date:'',time:p2(h)+':'+m[2]+':'+p2(m[3]||0)}}
 const tm=s.match(/[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(am|pm)?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?$/i);let ds=s,time='';
 if(tm){ds=s.slice(0,tm.index).trim();let h=+tm[1];if(tm[4])h=h%12+(/pm/i.test(tm[4])?12:0);time=p2(h)+':'+tm[2]+':'+p2(tm[3]||0)}
 let Y,M,D;
 if(m=ds.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/)){Y=+m[1];M=+m[2];D=+m[3]}
 else if(m=ds.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/)){const a=+m[1],b=+m[2];Y=+m[3];if(Y<100)Y+=2000;if(df){D=a;M=b}else{M=a;D=b}}
 else if(m=ds.match(/^(\d{1,2})[-\/ .]([A-Za-z]{3})[a-z]*[-\/ .,]*(\d{2,4})$/)){D=+m[1];M=MON[m[2].toLowerCase()];Y=+m[3];if(Y<100)Y+=2000}
 else if(m=ds.match(/^([A-Za-z]{3})[a-z]*[ -](\d{1,2}),? (\d{4})$/)){M=MON[m[1].toLowerCase()];D=+m[2];Y=+m[3]}
 else return null;
 if(!M||M>12||D>31||D<1)return null;return{date:Y+'-'+p2(M)+'-'+p2(D),time}}
const sci=v=>/^\d(\.\d+)?e\+?\d+$/i.test(String(v).trim());
const num=(v,ind)=>{let s=String(v==null?'':v).trim();if(!s)return'';if(sci(s))s=String(Math.round(Number(s)));const raw=s;s=s.replace(/[\s\-().]/g,'').replace(/^\+/,'');if(/^\d+$/.test(s)){if(ind){if(s.length==12&&s.startsWith('91'))s=s.slice(2);else if(s.length==11&&s[0]=='0')s=s.slice(1);else if(s.length==13&&s.startsWith('091'))s=s.slice(3)}return s}return raw};
const durS=v=>{const s=String(v==null?'':v).trim();if(!s)return 0;const u=s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/i);if(u&&(u[1]||u[2]||u[3]))return(+u[1]||0)*3600+(+u[2]||0)*60+(+u[3]||0);if(s.includes(':')){const q=s.split(':').map(Number);return q.length==3?q[0]*3600+q[1]*60+q[2]:q[0]*60+(q[1]||0)}const n=parseFloat(s);return isFinite(n)?Math.round(n):0};
const typeN=v=>{const s=String(v||'').trim();if(!s)return'Voice';if(/sms|msg|text/i.test(s))return'SMS';if(/data|gprs|gsn|internet/i.test(s))return'Data';if(/voice|call|moc|mtc|incoming|outgoing|^mo$|^mt$/i.test(s))return'Voice';return s};
const coord=(v,lim)=>{const n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)&&Math.abs(n)<=lim&&n!==0?String(n):''};
let TDB=LS('tcdr_towers',{});
const detectDF=(T,map)=>{const k=map.date>=0?map.date:map.datetime;if(k<0)return true;let f=0,m=0;T.data.slice(0,800).forEach(r=>{const x=String(r[k]).match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.]\d{2,4}/);if(x){if(+x[1]>12)f++;if(+x[2]>12)m++}});return !(m>f)};
function build(T,map,o){const st={total:T.data.length,kept:0,noParty:0,badDate:0,dup:0,filled:0,noCoordRows:0,sci:0},out=[],seen=new Set(),g=(r,k)=>map[k]>=0?r[map[k]]:'';
 T.data.forEach(r=>{let a=num(g(r,'a'),o.indian),b=num(g(r,'b'),o.indian);if(!a&&o.defA)a=num(o.defA,o.indian);if(!a||!b){st.noParty++;return}
  let d='',t='';if(map.datetime>=0){const x=parseDT(g(r,'datetime'),o.dayFirst);if(x){d=x.date;t=x.time;const z=String(g(r,'offset')||'').match(/([+-])(\d{2})(\d{2})?/);if(z&&d){const minutes=(+z[2]*60+(+z[3]||0))*(z[1]=='-'?-1:1),utc=new Date(Date.parse(d+'T'+(t||'00:00:00')+'Z')-minutes*60000);if(!isNaN(utc.getTime())){d=utc.toISOString().slice(0,10);t=utc.toISOString().slice(11,19)}}}}
  if(!d&&map.date>=0){const x=parseDT(g(r,'date'),o.dayFirst);if(x){d=x.date;if(x.time)t=x.time}}
  if(!t&&map.time>=0){const x=parseDT(g(r,'time'),o.dayFirst);if(x&&x.time)t=x.time}
  if(!d||!isFinite(Date.parse(d+'T'+(t||'00:00:00')+'Z'))){st.badDate++;return}
  let imei=String(g(r,'imei')||'').trim();if(sci(imei))st.sci++;imei=imei.replace(/[\s\-]/g,'');
  if(map.aImsi)a='IMSI:'+a;
  const row={a,b,date:d,time:t||'00:00:00',dur:durS(g(r,'dur')),type:typeN(g(r,'type')),imei,imsi:String(g(r,'imsi')||'').trim().replace(/[\s\-]/g,''),cell:String(g(r,'cell')||'').trim(),addr:String(g(r,'addr')||'').trim(),lat:coord(g(r,'lat'),90),lon:coord(g(r,'lon'),180),state:String(g(r,'state')||'').trim(),country:String(g(r,'country')||'').trim()};
  const td=row.cell&&TDB[row.cell];if(td){let f=0;if(!row.lat&&td[0]){row.lat=String(td[0]);row.lon=String(td[1]);f=1}if(!row.addr&&td[2]){row.addr=td[2];f=1}if(!row.state&&td[3])row.state=td[3];if(!row.country&&td[4])row.country=td[4];if(f)st.filled++}
  if(o.dedupe){const k=[row.a,row.b,row.date,row.time,row.dur,row.type,row.cell].join('|');if(seen.has(k)){st.dup++;return}seen.add(k)}
  out.push(row)});
 const cc={};out.forEach(r=>{if(r.cell&&r.lat&&!cc[r.cell])cc[r.cell]=r});out.forEach(r=>{if(r.cell&&!r.lat&&cc[r.cell]){const c=cc[r.cell];r.lat=c.lat;r.lon=c.lon;if(!r.addr)r.addr=c.addr;if(!r.state)r.state=c.state;if(!r.country)r.country=c.country;st.filled++}});
 out.forEach(r=>{if(!r.lat)st.noCoordRows++});out.sort((x,y)=>Date.parse(x.date+'T'+x.time)-Date.parse(y.date+'T'+y.time));st.kept=out.length;return{rows:out,st}}
/* quick path (live append / paste): automatic mapping, no dialog */
window.parseCSV=function(text){const T=toTable(rawParse(text).out),map=autoMap(T.hdr,T.data);return build(T,map,{dayFirst:detectDF(T,map),indian:true,dedupe:false,defA:''}).rows};
/* ---- file reading ---- */
const loadScript=u=>new Promise((res,rej)=>{if(window.XLSX)return res();const e=document.createElement('script');e.src=u;e.onload=res;e.onerror=()=>rej(new Error('Could not load the Excel reader (internet needed for .xlsx).'));document.head.append(e)});
const hex=async buf=>{try{const d=await crypto.subtle.digest('SHA-256',buf);return[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return''}};
async function readFile(f){try{const ext=(f.name.split('.').pop()||'').toLowerCase(),buf=await f.arrayBuffer(),sha=await hex(buf);
  if(ext=='xlsx'||ext=='xls'){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');const wb=XLSX.read(buf,{type:'array'});
   const sheets=wb.SheetNames.map(n=>({n,out:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''}).map(r=>r.map(x=>String(x==null?'':x).trim()))})).filter(x=>x.out.length);
   if(!sheets.length)throw new Error('The workbook is empty.');wizard({name:f.name,sha,sheets,D:'xlsx'})}
  else{const r=rawParse(new TextDecoder('utf-8').decode(buf));if(!r.out.length)throw new Error('The file is empty.');wizard({name:f.name,sha,sheets:[{n:'',out:r.out}],D:r.D=='\t'?'tab':r.D})}}
 catch(e){alert('Import failed: '+e.message)}}
$('file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)readFile(f)};
$('file').parentElement.firstChild.nodeValue='Import CDR (CSV / Excel) ';
addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length){e.preventDefault();readFile(e.dataTransfer.files[0])}});
/* ---- import wizard ---- */
function wizard(src){let sh=0,T=toTable(src.sheets[0].out),map,msv=LS('tcdr_maps',{});
 const sig=()=>T.hdr.map(norm).join('|'),setMap=()=>{map=msv[sig()]||autoMap(T.hdr,T.data)};setMap();
 const c=cur()||{},hasRows=rows.length>0,w=document.createElement('div');w.className='mdl';w.id='imw';
 const samp=i=>{for(const r of T.data.slice(0,40))if(String(r[i]||'').trim())return String(r[i]).slice(0,22);return''};
 w.innerHTML=`<div class="mbx"><h3>Import CDR · ${esc(src.name)}</h3><p class="note" id="imi"></p>${src.sheets.length>1?`<div class="row"><b class="note">Worksheet</b><select id="imsh">${src.sheets.map((x,i)=>`<option value="${i}">${esc(x.n)}</option>`).join('')}</select></div>`:''}
 <div class="mg" id="img"></div>
 <div class="row" style="margin-top:10px"><label class="note"><input type="checkbox" id="imdf"> Day-first dates (dd/mm/yyyy)</label><label class="note"><input type="checkbox" id="imin" checked> Normalise Indian numbers (+91 / leading 0)</label><label class="note"><input type="checkbox" id="imdd"> Remove exact duplicates</label><input id="imda" placeholder="Default A-party if file has none" style="min-width:210px"></div>
 <div id="imv"></div>
 <div class="row" style="margin-top:10px"><label class="note"><input type="radio" name="imm" value="replace" ${hasRows?'':'checked'}> Replace data in <b>${esc(c.fir||'this case')}</b></label><label class="note"><input type="radio" name="imm" value="append" ${hasRows?'checked':''}> Append to <b>${esc(c.fir||'this case')}</b></label><label class="note"><input type="radio" name="imm" value="new"> New case</label><input id="imt" placeholder="New case title" style="flex:1;min-width:160px"></div>
 <div class="row"><button class="btn" id="imgo">Import</button><button class="btn g" id="imx">Cancel</button></div></div>`;
 document.body.append(w);
 const ui=()=>{$('img').innerHTML=FIELDS.map(([k,l])=>`<label>${l}<select data-f="${k}"><option value="-1">— not in file —</option>${T.hdr.map((h,i)=>`<option value="${i}" ${map[k]==i?'selected':''}>${esc(h)}${samp(i)?'  ·  '+esc(samp(i)):''}</option>`).join('')}</select></label>`).join('');
  $('img').querySelectorAll('select').forEach(x=>x.onchange=()=>{map[x.dataset.f]=+x.value;calc()});$('imi').textContent=`${T.data.length.toLocaleString()} data rows · ${T.hdr.length} columns · delimiter: ${src.D} · header found on line ${T.hi+1} · SHA-256 ${src.sha?src.sha.slice(0,16)+'…':'n/a'}`;$('imdf').checked=detectDF(T,map);calc()};
 let B=null;const opts=()=>({dayFirst:$('imdf').checked,indian:$('imin').checked,dedupe:$('imdd').checked,defA:$('imda').value.trim()});
 function calc(){B=build(T,map,opts());const st=B.st,miss=!(map.a>=0||opts().defA)||map.b<0||(map.date<0&&map.datetime<0);
  $('imv').innerHTML=`<div class="row"><span class="tag" style="color:#2fd9a0">${st.kept.toLocaleString()} valid / ${st.total.toLocaleString()}</span>${st.noParty?`<span class="tag" style="color:#19d3a2">${st.noParty} no number</span>`:''}${st.badDate?`<span class="tag" style="color:#ff3b6b">${st.badDate} unreadable date</span>`:''}${st.dup?`<span class="tag">${st.dup} duplicates removed</span>`:''}${st.filled?`<span class="tag">${st.filled} coords filled from tower DB / other rows</span>`:''}${st.noCoordRows?`<span class="tag" style="color:#19d3a2">${st.noCoordRows} rows without coordinates</span>`:''}${st.sci?`<span class="tag" style="color:#ff3b6b">${st.sci} IMEIs in scientific notation (precision lost in the source file)</span>`:''}</div>${miss?'<p class="note" style="color:#ff3b6b">Map at least A-party (or enter a default) and Date.</p>':''}<div class="tw" style="max-height:180px"><table><thead><tr>${['a','b','date','time','dur','type','imei','cell','lat','lon'].map(k=>`<th>${LBL[k]}</th>`).join('')}</tr></thead><tbody>${B.rows.slice(0,5).map(r=>`<tr>${['a','b','date','time','dur','type','imei','cell','lat','lon'].map(k=>`<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="10">Nothing to preview yet</td></tr>'}</tbody></table></div>`;$('imgo').disabled=miss||!st.kept}
 ['imdf','imin','imdd'].forEach(i=>$(i).onchange=calc);$('imda').oninput=calc;
 if($('imsh'))$('imsh').onchange=()=>{T=toTable(src.sheets[+$('imsh').value].out);setMap();ui()};
 $('imx').onclick=()=>w.remove();
 $('imgo').onclick=()=>{calc();if(!B.rows.length)return;msv[sig()]=map;SV('tcdr_maps',msv);let cs=cur();const mode=document.querySelector('input[name=imm]:checked').value,topA=(()=>{const q={};B.rows.forEach(r=>q[r.a]=(q[r.a]||0)+1);return Object.entries(q).sort((a,b)=>b[1]-a[1])[0][0]})(),log={file:src.name,at:new Date().toISOString(),sha:src.sha,rows:B.rows.length,total:B.st.total,skipped:B.st.noParty+B.st.badDate,dups:B.st.dup};
  if(mode=='new'){cs=newCase({title:$('imt').value.trim()||'Case from '+src.name,suspect:topA,rows:B.rows});cs.imports=[log];setCase(cs.id,'records')}
  else{if(mode=='append'){const key=r=>[r.a,r.b,r.date,r.time,r.dur,r.type,r.cell].join('|'),sn=new Set(cs.rows.map(key));const add=opts().dedupe?B.rows.filter(r=>!sn.has(key(r))):B.rows;cs.rows=cs.rows.concat(add).sort((x,y)=>Date.parse(x.date+'T'+x.time)-Date.parse(y.date+'T'+y.time));log.rows=add.length}else cs.rows=B.rows;
   if(!cs.suspect)cs.suspect=topA;cs.imports=(cs.imports||[]).concat(log);rows=cs.rows;setCase(cs.id,'records')}
  w.remove();try{tcPersist()}catch(e){}flash(`Imported ${log.rows.toLocaleString()} records from ${src.name}`)};
 ui()}
/* ---- empty states, error guards, onboarding ---- */
const welcome=()=>`<div class="cs on" style="margin-bottom:14px"><h3 style="margin:0 0 6px">Get started</h3><div class="note">1 · <b>Import</b> a CDR file (CSV, TSV or Excel). Column names are detected automatically and you confirm the mapping.<br>2 · Optionally add a <b>tower database</b> (cell ID → coordinates) so every record can be placed on the map.<br>3 · Explore the modules, or connect a <b>live source URL</b> in Live ingestion.</div><div class="row" style="margin-top:8px"><button class="btn" data-boot="imp">Import CDR file</button><button class="btn g" data-boot="paste">Paste rows / live source</button><button class="btn g" data-boot="demo">Load demo data</button></div></div>`;
const bootBtns=r=>r.querySelectorAll('[data-boot]').forEach(b=>b.onclick=()=>{const k=b.dataset.boot;if(k=='imp')$('file').click();else if(k=='paste')go('live');else $('sample').onclick()});
const nameOf=k=>(VIEWS.find(x=>x[1]==k)||[])[2]||k;
Object.keys(V).forEach(k=>{if(k=='cases'||k=='live')return;const f=V[k];V[k]=function(){if(!rows.length){$('main').innerHTML=`<h2>${esc(nameOf(k))}</h2>`+welcome();bootBtns($('main'));return}try{return f.apply(this,arguments)}catch(e){console.error(k,e);$('main').innerHTML=`<h2>${esc(nameOf(k))}</h2><div class="cs"><b>This module could not process the current data.</b><p class="note">${esc(e.message||e)}</p><button class="btn g" data-boot="imp">Re-import / remap data</button></div>`;bootBtns($('main'))}}});
/* ---- case management ---- */
const mdl=(h,fn)=>{const w=document.createElement('div');w.className='mdl';w.innerHTML=`<div class="mbx" style="max-width:520px">${h}</div>`;document.body.append(w);fn(w);return w};
const vc=V.cases;V.cases=function(){vc.apply(this,arguments);const mm=$('main');
 if(!CASES.some(c=>c.rows.length)){mm.querySelector('.sub').insertAdjacentHTML('afterend',welcome());bootBtns(mm)}
 mm.querySelectorAll('[data-op]').forEach(b=>{const id=b.dataset.op,h=document.createElement('span');h.innerHTML=`<button class="btn g" data-ci="${id}">⇪ Import CDR</button><button class="btn g" data-ce="${id}">✎ Edit</button><button class="btn g" data-cd="${id}" style="color:#ff3b6b">🗑 Delete</button>`;b.parentElement.append(h)});
 mm.querySelectorAll('[data-ci]').forEach(b=>b.onclick=()=>{setCase(b.dataset.ci,view);$('file').click()});
 mm.querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>{const c=CASES.find(x=>x.id==b.dataset.ce);mdl(`<h3>Edit case</h3><div class="mg"><label>FIR / case number<input id="e1" value="${esc(c.fir)}"></label><label>Filed on<input id="e4" type="date" value="${esc(c.filed)}"></label><label style="grid-column:1/-1">Title<input id="e2" value="${esc(c.title)}"></label><label>Suspect number<input id="e3" value="${esc(c.suspect)}"></label></div><div class="row" style="margin-top:10px"><button class="btn" id="es">Save</button><button class="btn g" id="ec">Cancel</button></div>`,w=>{$('ec').onclick=()=>w.remove();$('es').onclick=()=>{c.fir=$('e1').value.trim()||c.fir;c.title=$('e2').value.trim()||c.title;c.suspect=$('e3').value.trim();c.filed=$('e4').value||c.filed;w.remove();try{tcPersist()}catch(e){}setCase(CUR,'cases')}})});
 mm.querySelectorAll('[data-cd]').forEach(b=>b.onclick=()=>{const c=CASES.find(x=>x.id==b.dataset.cd);if(!confirm('Delete '+c.fir+' · '+c.title+' and its '+c.rows.length+' records? This cannot be undone.'))return;CASES=CASES.filter(x=>x!==c);CASES.forEach(x=>{if(x.parent==c.id)x.parent=null});if(!CASES.length)initEmpty();else setCase(CASES.some(x=>x.id==CUR)?CUR:CASES[0].id,'cases');try{tcPersist()}catch(e){}})};
$('sample').onclick=()=>{if(CASES.some(c=>c.rows.length)&&!confirm('Demo data REPLACES all current cases. Export a backup from Case register first. Continue?'))return;initCases();try{tcPersist()}catch(e){}};
/* ---- data health + tower DB + geocoding (Records view) ---- */
const hasXY=r=>isFinite(parseFloat(r.lat))&&isFinite(parseFloat(r.lon))&&r.lat!==''&&r.lon!=='';
const health=()=>{const R=rows,cells=new Set(),nc=new Set();let mi=0,k=new Set(),dup=0;R.forEach(r=>{if(r.cell){cells.add(r.cell);if(!hasXY(r))nc.add(r.cell)}if(!r.imei)mi++;const q=[r.a,r.b,r.date,r.time,r.dur,r.cell].join('|');if(k.has(q))dup++;else k.add(q)});return{n:R.length,cells:cells.size,nc:nc.size,mi,dup}};
function applyDB(){let n=0;const cc={};rows.forEach(r=>{if(r.cell&&hasXY(r)&&!cc[r.cell])cc[r.cell]=r});rows.forEach(r=>{if(hasXY(r)||!r.cell)return;const t=TDB[r.cell],c=cc[r.cell];if(t&&t[0]){r.lat=String(t[0]);r.lon=String(t[1]);if(!r.addr&&t[2])r.addr=t[2];if(!r.state&&t[3])r.state=t[3];if(!r.country&&t[4])r.country=t[4];n++}else if(c){r.lat=c.lat;r.lon=c.lon;if(!r.addr)r.addr=c.addr;n++}});for(const k in RC)delete RC[k];return n}
const sync=()=>{if(cur())cur().rows=rows;try{tcPersist()}catch(e){}};
async function nom(u){const r=await fetch(u,{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
let geoStop=false;
async function geoEnrich(msg){geoStop=false;const need={};rows.forEach(r=>{if(!hasXY(r)&&r.addr)need[r.addr]=1});const A=Object.keys(need).slice(0,80);let done=0,got=0;const cache=LS('tcdr_geo',{});
 for(const a of A){if(geoStop)break;msg(`Geocoding ${++done}/${A.length}: ${a}`);let g=cache[a];if(!g){try{const j=await nom('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(a));if(j[0]){g=[+j[0].lat,+j[0].lon];cache[a]=g}await sleep(1100)}catch(e){msg('Geocoder unreachable: '+e.message);break}}
  if(g){rows.forEach(r=>{if(!hasXY(r)&&r.addr==a){r.lat=String(g[0]);r.lon=String(g[1]);got++}})}}
 SV('tcdr_geo',cache);const ct={};rows.forEach(r=>{if(r.cell&&hasXY(r)&&!r.state&&!r.country&&!ct[r.cell])ct[r.cell]=r});const C=Object.values(ct).slice(0,60);let d2=0;
 for(const r0 of C){if(geoStop)break;msg(`Resolving region ${++d2}/${C.length}`);try{const j=await nom(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=5&lat=${r0.lat}&lon=${r0.lon}`);const ad=j.address||{};rows.forEach(r=>{if(r.cell==r0.cell){r.state=ad.state||ad.region||'';r.country=ad.country||''}});await sleep(1100)}catch(e){break}}
 applyDB();sync();msg(`Done · ${got} rows located`)}
const hv0=V.records;V.records=function(){hv0.apply(this,arguments);const mm=$('main'),h=health(),sub=mm.querySelector('.sub');if(!sub)return;
 const tdn=Object.keys(TDB).length,imp=(cur()&&cur().imports)||[];
 sub.insertAdjacentHTML('afterend',`<details class="cs" id="dhl" ${h.nc||h.dup?'open':''}><summary><b>Data health</b> · ${h.n.toLocaleString()} records ${h.nc?`<span class="tag" style="color:#19d3a2">${h.nc}/${h.cells} towers without coordinates</span>`:'<span class="tag" style="color:#2fd9a0">all towers located</span>'}${h.dup?`<span class="tag" style="color:#19d3a2">${h.dup} duplicates</span>`:''}${h.mi?`<span class="tag">${h.mi} without IMEI</span>`:''}</summary>
 <div class="row" style="margin-top:8px"><button class="btn g" id="dh1">Fill coordinates (tower DB + file)</button><button class="btn g" id="dh2">Geocode addresses online</button><label class="btn g">Import tower DB (CSV)<input type="file" id="dh3" accept=".csv,.txt,.xlsx" hidden></label><button class="btn g" id="dh4">Remove duplicates</button><button class="btn g" id="dh5">Export tower DB</button></div>
 <div class="note" id="dhm">Tower DB: ${tdn.toLocaleString()} cells stored in this browser. CSV columns: cell id, latitude, longitude, address, state, country. Online geocoding uses OpenStreetMap Nominatim (needs internet, about 1 request per second).</div>
 ${imp.length?`<div class="note"><b>Import log</b><br>${imp.slice(-5).map(x=>`${esc(x.at.slice(0,19).replace('T',' '))} · ${esc(x.file)} · ${x.rows} rows · SHA-256 ${esc((x.sha||'n/a').slice(0,16))}…`).join('<br>')}</div>`:''}</details>`);
 const msg=t=>{const e=$('dhm');if(e)e.textContent=t},re=()=>{stats();V.records()};
 $('dh1').onclick=()=>{const n=applyDB();sync();flash(n+' rows located');re()};
 $('dh2').onclick=()=>{$('dh2').disabled=true;geoEnrich(msg).then(re).catch(e=>msg('Failed: '+e.message))};
 $('dh4').onclick=()=>{const k=new Set(),o=[];rows.forEach(r=>{const q=[r.a,r.b,r.date,r.time,r.dur,r.cell].join('|');if(!k.has(q)){k.add(q);o.push(r)}});const d=rows.length-o.length;rows=o;sync();flash(d+' duplicates removed');re()};
 $('dh5').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([['cell,lat,lon,address,state,country'].concat(Object.entries(TDB).map(([c,t])=>[c,t[0],t[1],'"'+String(t[2]||'').replace(/"/g,'""')+'"',t[3]||'',t[4]||''].join(','))).join('\n')],{type:'text/csv'}));a.download='tower-db.csv';a.click()};
 $('dh3').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{let out;if(/\.xlsx$/i.test(f.name)){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});out=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''}).map(r=>r.map(x=>String(x).trim()))}else out=rawParse(await f.text()).out;
  const T=toTable(out),m=autoMap(T.hdr);if(m.cell<0||m.lat<0||m.lon<0){alert('Need columns for cell id, latitude and longitude. Found: '+T.hdr.join(', '));return}
  let n=0;T.data.forEach(r=>{const la=coord(r[m.lat],90),lo=coord(r[m.lon],180);if(r[m.cell]&&la&&lo){TDB[String(r[m.cell]).trim()]=[+la,+lo,m.addr>=0?r[m.addr]:'',m.state>=0?r[m.state]:'',m.country>=0?r[m.country]:''];n++}});
  if(!SV('tcdr_towers',TDB))alert('Tower DB is too large for browser storage; it is kept for this session only.');const a=applyDB();sync();flash(`${n} towers loaded · ${a} records located`);re()}catch(x){alert('Tower DB import failed: '+x.message)}}};
/* ---- live source (URL polling) ---- */
const vl=V.live;V.live=function(){vl.apply(this,arguments);const mm=$('main');
 mm.insertAdjacentHTML('beforeend',`<div class="cs" style="margin-top:12px"><h3 style="margin:0 0 6px">Live source (URL)</h3><div class="row"><input id="lu" placeholder="https://your-source.example/cdr.csv or /records.json" style="flex:1;min-width:220px" value="${esc(LS('tcdr_liveurl',''))}"><select id="li"><option value="5000">every 5 s</option><option value="15000" selected>every 15 s</option><option value="60000">every 1 min</option></select><button class="btn" id="lgl">${window._lsrc?'■ Disconnect':'Connect'}</button></div><div class="note" id="lst">${window._lsrc?'Connected.':'Not connected.'} Accepts CSV (any column names, auto-mapped) or JSON (array of objects, or {rows:[…]}). The source must allow cross-origin requests (CORS). New records are merged and checked for alerts.</div></div>`);
 const poll=async u=>{try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const t=await r.text();let R;
   if(/^\s*[\[{]/.test(t)){let j=JSON.parse(t);j=Array.isArray(j)?j:(j.rows||j.data||j.records||[]);if(!j.length)return 0;const h=[...new Set(j.flatMap(o=>Object.keys(o)))],T={hdr:h,data:j.map(o=>h.map(k=>o[k]==null?'':String(o[k])))},m=autoMap(h);R=build(T,m,{dayFirst:true,indian:true,dedupe:false,defA:''}).rows}else R=parseCSV(t);
   const before=rows.length;ingest(R,'Live source');if(cur())cur().rows=rows;const n=rows.length-before;$('lst')&&($('lst').textContent=`Connected · last poll ${new Date().toLocaleTimeString()} · ${R.length} rows fetched, ${Math.max(0,n)} new`);return n}catch(e){$('lst')&&($('lst').textContent='Poll failed: '+e.message+' (check the URL and CORS)')}};
 $('lgl').onclick=()=>{if(window._lsrc){clearInterval(window._lsrc);window._lsrc=0;$('lgl').textContent='Connect';$('lst').textContent='Disconnected.';return}const u=$('lu').value.trim();if(!/^https?:\/\//i.test(u)){$('lst').textContent='Enter a full http(s) URL.';return}SV('tcdr_liveurl',u);$('lgl').textContent='■ Disconnect';poll(u);window._lsrc=setInterval(()=>poll(u),+$('li').value)}};
/* ---- storage: IndexedDB mirror for large datasets ---- */
const idb=()=>new Promise((res,rej)=>{const q=indexedDB.open('tracecdr',1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
const idbSet=async(k,v)=>{const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})};
const idbGet=async k=>{const d=await idb();return new Promise((res,rej)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})};
const lsAt=(LS(TKEY,{})||{}).at||0;
window.tcPersist=function(){const at=Date.now(),o={cases:CASES,fseq,cur:CUR,at};let ok=false,kb=0;try{const j=JSON.stringify(o);kb=j.length/1024|0;localStorage.setItem(TKEY,j);ok=true}catch(e){try{localStorage.removeItem(TKEY)}catch(x){}}
 idbSet(TKEY,o).then(()=>{window._saved={t:Date.now(),kb,err:0,idb:1}}).catch(()=>{if(!ok)window._saved={t:Date.now(),kb:0,err:1}});_sig=sgn();if(ok)window._saved={t:Date.now(),kb,err:0};return true};
window._tc={geoEnrich,applyDB,sync,loadScript,rawParse,toTable,autoMap,coord,hasXY,TDBref:()=>TDB};
idbGet(TKEY).then(o=>{if(!o||!Array.isArray(o.cases)||!o.cases.length)return;if((o.at||0)>lsAt&&sgn()==_sig){CASES=o.cases;fseq=o.fseq||CASES.length;_sig=sgn();setCase(CASES.some(c=>c.id==o.cur)?o.cur:CASES[0].id,view)}}).catch(()=>{});
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
})();
