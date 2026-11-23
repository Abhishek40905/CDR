(function(){
try{localStorage.removeItem('tcdr_key')}catch(e){}
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12},p2=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>{y=+y;m=+m;d=+d;if(y<100)y+=2000;return(m<1||m>12||d<1||d>31)?'':y+'-'+p2(m)+'-'+p2(d)};
const pDate=(v,f)=>{v=String(v||'').trim();let m;if(m=v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))return iso(m[1],m[2],m[3]);
 if(m=v.match(/^(\d{1,2})[-\/. ]([A-Za-z]{3})[A-Za-z]*[-\/. ,]*(\d{2,4})/)){const mo=MON[m[2].toLowerCase()];return mo?iso(m[3],mo,m[1]):''}
 if(m=v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))return f=='mdy'?iso(m[3],m[1],m[2]):iso(m[3],m[2],m[1]);return ''};
const pTime=v=>{const m=String(v||'').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);if(!m)return '';let h=+m[1];if(m[4]){const pm=/p/i.test(m[4]);if(pm&&h<12)h+=12;if(!pm&&h==12)h=0}return h>23?'':p2(h)+':'+m[2]+':'+(m[3]||'00')};
const pDur=v=>{v=String(v||'').trim();if(!v)return 0;let m;if(m=v.match(/^(\d+):(\d{2}):(\d{2})$/))return+m[1]*3600+ +m[2]*60+ +m[3];if(m=v.match(/^(\d+):(\d{2})$/))return+m[1]*60+ +m[2];
 if((m=v.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i))&&(m[1]||m[2]||m[3]))return(+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0);const n=parseFloat(v);return isFinite(n)?Math.round(n):0};
const nType=v=>{v=String(v||'').toLowerCase();if(!v)return '';if(/sms|msg|text/.test(v))return 'SMS';if(/data|gprs|internet|4g|5g/.test(v))return 'Data';if(/voice|call|moc|mtc|incoming|outgoing/.test(v))return 'Voice';return v.replace(/^./,c=>c.toUpperCase())};
const nNum=(v,on)=>{v=String(v||'').trim();if(!on)return v;let d=v.replace(/\D/g,'');if(d.length>10&&d.startsWith('91'))d=d.slice(2);if(d.length==11&&d[0]=='0')d=d.slice(1);return d||v};
function parseTable(t){t=t.replace(/^\uFEFF/,'');const first=t.split(/\r?\n/)[0]||'',d=[',',';','\t','|'].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0],out=[];let row=[],c='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}else if(ch=='"')q=true;else if(ch==d){row.push(c);c=''}else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;row.push(c);c='';if(row.some(x=>x.trim()))out.push(row);row=[]}else c+=ch}
 row.push(c);if(row.some(x=>x.trim()))out.push(row);return{d,rows:out.map(r=>r.map(x=>x.trim()))}}
const FM=[['a','A-Party (caller) *',/a.?party|calling|caller|msisdn|from|originat|source|^a$|a.?number/],['b','B-Party (called) *',/b.?party|called|callee|receiver|\bto\b|destination|dialled|^b$|b.?number/],['date','Date *',/date|^dt$/],['time','Time',/^time|start.?time|call.?time/],['dur','Duration',/dur|length|talk|secs|seconds/],['type','Call type',/call.?type|^type|service|direction|category/],['imei','IMEI',/imei/],['imsi','IMSI',/imsi/],['cell','Cell / tower ID',/cell|cgi|lac|tower|site.?id/],['addr','Tower address',/addr|location|site.?name|place/],['lat','Latitude',/^lat/],['lon','Longitude',/^lon|^lng|^long/]];
const W={raw:null,hdr:true,map:{},norm:true,dfmt:'auto',dedupe:true,enrich:true,target:'new',title:'',fir:'',suspect:'',name:''};let tab=0,B=null;
const ov=document.createElement('div');ov.id='dsv';ov.innerHTML='<div id="dsp"></div>';document.body.append(ov);const P=$('dsp');
const open=t=>{if(t!=null)tab=t;ov.classList.add('on');draw()},close=()=>ov.classList.remove('on');ov.addEventListener('pointerdown',e=>{if(e.target===ov)close()});
const hdrs=()=>W.hdr?W.raw.rows[0]:W.raw.rows[0].map((_,i)=>'Column '+(i+1));
function guess(){const H=hdrs(),used=new Set();FM.forEach(f=>{const i=H.findIndex((h,j)=>!used.has(j)&&f[2].test(String(h).toLowerCase()));W.map[f[0]]=i;if(i>=0)used.add(i)})}
function setRaw(t,name){const x=parseTable(t);if(x.rows.length<2){alert('No data rows found in that file.');return}W.raw=x;W.name=name;guess();tab=0;open(0)}
const readFile=f=>{if(!f)return;const r=new FileReader();r.onload=()=>setRaw(String(r.result),f.name);r.readAsText(f)};
function build(){const D=W.raw.rows.slice(W.hdr?1:0),m=W.map,g=(c,k)=>m[k]>=0?(c[m[k]]||''):'';let fmt=W.dfmt;
 if(fmt=='auto'){fmt='dmy';for(const c of D.slice(0,800)){const x=g(c,'date').match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.]\d{2,4}/);if(x){if(+x[1]>12){fmt='dmy';break}if(+x[2]>12){fmt='mdy';break}}}}
 const out=[],sk={nonum:0,date:0,dup:0},seen=new Set();
 D.forEach(c=>{const r={a:nNum(g(c,'a'),W.norm),b:nNum(g(c,'b'),W.norm),date:'',time:'',dur:0,type:'',imei:g(c,'imei'),imsi:g(c,'imsi'),cell:g(c,'cell'),addr:g(c,'addr'),lat:'',lon:''};
  if(!r.a&&!r.b){sk.nonum++;return}const dv=g(c,'date');r.date=pDate(dv,fmt);if(!r.date){sk.date++;return}r.time=pTime(g(c,'time')||dv)||'00:00:00';r.dur=pDur(g(c,'dur'));r.type=nType(g(c,'type'))||'Voice';
  const la=parseFloat(g(c,'lat')),lo=parseFloat(g(c,'lon'));if(isFinite(la)&&isFinite(lo)&&Math.abs(la)<=90&&Math.abs(lo)<=180){r.lat=la;r.lon=lo}
  const k=[r.a,r.b,r.date,r.time,r.dur].join('|');if(W.dedupe&&seen.has(k)){sk.dup++;return}seen.add(k);out.push(r)});
 let filled=0;if(W.enrich){const T={},src=out.concat(W.target=='append'&&cur()?cur().rows:[]);src.forEach(r=>{if(r.cell&&r.lat!==''&&isFinite(parseFloat(r.lat))&&!T[r.cell])T[r.cell]=r});out.forEach(r=>{if(r.lat===''&&r.cell&&T[r.cell]){r.lat=+T[r.cell].lat;r.lon=+T[r.cell].lon;if(!r.addr)r.addr=T[r.cell].addr||'';filled++}})}
 const cnt={};out.forEach(r=>cnt[r.a]=(cnt[r.a]||0)+1);const top=Object.entries(cnt).sort((x,y)=>y[1]-x[1]).slice(0,12).map(x=>x[0]);
 return{out,sk,filled,fmt,total:D.length,nolat:out.filter(r=>r.lat==='').length,top}}
const TT=['Import data','Manual entry','Cases & storage','Rules & scoring','AI settings'];
function draw(){P.innerHTML=`<div class="dsh"><h3>Data Studio</h3><button class="btn g" id="dsx2">Close ✕</button></div><div class="stabs" style="margin:0 0 16px">${TT.map((t,i)=>`<button data-tb="${i}" class="${i==tab?'on':''}">${t}</button>`).join('')}</div><div id="dsb2"></div>`;
 $('dsx2').onclick=close;P.querySelectorAll('[data-tb]').forEach(b=>b.onclick=()=>{tab=+b.dataset.tb;draw()});[tabImport,tabManual,tabCases,tabRules,tabAI][tab]()}
function tabImport(){const el=$('dsb2');
 if(!W.raw){el.innerHTML=`<p class="note">Load a call-detail-record file exported from a telecom provider (CSV, TSV, or semicolon/pipe separated). Check the column mapping before importing. A signed-in workspace is saved to Supabase.</p><div class="dz" id="dz">Drop a file here or <label class="btn">Choose file<input type="file" id="dsf" accept=".csv,.tsv,.txt,text/csv" hidden></label></div><textarea id="dst" rows="6" placeholder="…or paste rows here (first line = column names)"></textarea><div class="row"><button class="btn" id="dsl">Use pasted text</button></div>`;
  $('dsf').onchange=e=>readFile(e.target.files[0]);$('dsl').onclick=()=>{const t=$('dst').value;if(t.trim())setRaw(t,'pasted data')};return}
 const H=hdrs(),ex=W.raw.rows[W.hdr?1:0]||[];
 el.innerHTML=`<p class="note"><b>${esc(W.name)}</b> · ${W.raw.rows.length-(W.hdr?1:0)} rows · separator “${W.raw.d=='\t'?'tab':W.raw.d}” · columns were matched automatically; correct any that look wrong.</p>
 <div class="mg">${FM.map(f=>`<label>${f[1]}<select data-m="${f[0]}"><option value="-1">— not in file —</option>${H.map((h,i)=>`<option value="${i}" ${W.map[f[0]]==i?'selected':''}>${esc(h)}${ex[i]?'  ·  '+esc(String(ex[i]).slice(0,18)):''}</option>`).join('')}</select></label>`).join('')}</div>
 <div class="dsr row"><label><input type="checkbox" id="oh" ${W.hdr?'checked':''}>First row is a header</label><label><input type="checkbox" id="on" ${W.norm?'checked':''}>Normalise numbers (digits only, drop +91 / 0)</label><label><input type="checkbox" id="od" ${W.dedupe?'checked':''}>Drop duplicates</label><label><input type="checkbox" id="oe" ${W.enrich?'checked':''}>Fill missing coordinates from same tower ID</label><label>Dates <select id="of" style="width:auto"><option value="auto" ${W.dfmt=='auto'?'selected':''}>auto-detect</option><option value="dmy" ${W.dfmt=='dmy'?'selected':''}>DD/MM/YYYY</option><option value="mdy" ${W.dfmt=='mdy'?'selected':''}>MM/DD/YYYY</option></select></label></div><div id="dspv"></div>`;
 el.querySelectorAll('[data-m]').forEach(s=>s.onchange=()=>{W.map[s.dataset.m]=+s.value;pv()});
 [['oh','hdr'],['on','norm'],['od','dedupe'],['oe','enrich']].forEach(([i,k])=>$(i).onchange=e=>{W[k]=e.target.checked;if(k=='hdr')guess();tabImport()});$('of').onchange=e=>{W.dfmt=e.target.value;pv()};pv()}
function pv(){B=build();const c=cur(),n=B.out.length,bad=(W.map.a<0&&W.map.b<0)||W.map.date<0;
 $('dspv').innerHTML=`<div class="dsm ${bad||!n?'bad':''}">${bad?'Map at least a caller or called number, and a date.':`<b>${n}</b> of ${B.total} rows are ready · skipped: ${B.sk.nonum} without numbers, ${B.sk.date} with unreadable dates, ${B.sk.dup} duplicates · ${B.nolat} without coordinates${B.filled?` (${B.filled} filled from tower IDs)`:''} · dates read as ${B.fmt=='mdy'?'MM/DD/YYYY':'DD/MM/YYYY'}`}</div>
 <div class="tw"><table><thead><tr>${COLS.map(k=>`<th>${LBL[k]}</th>`).join('')}</tr></thead><tbody>${B.out.slice(0,6).map(r=>`<tr>${COLS.map(k=>`<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
 <div class="dsr row" style="margin-top:12px"><label><input type="radio" name="tg" value="new" ${W.target=='new'?'checked':''}>Create a new case</label><label><input type="radio" name="tg" value="append" ${W.target=='append'?'checked':''}>Add to current case${c?' ('+esc(c.fir)+')':''}</label><label><input type="radio" name="tg" value="replace" ${W.target=='replace'?'checked':''}>Replace current case records</label></div>
 ${W.target=='new'?`<div class="mg"><label>Case title<input type="text" id="wt" value="${esc(W.title)}" placeholder="Imported – ${esc(W.name)}"></label><label>FIR number<input type="text" id="wf" value="${esc(W.fir)}" placeholder="auto"></label><label>Primary subject number<input type="text" id="ws2" list="wsl" value="${esc(W.suspect)}" placeholder="${esc(B.top[0]||'')}"><datalist id="wsl">${B.top.map(t=>`<option value="${esc(t)}">`).join('')}</datalist></label></div>`:''}
 <div class="row"><button class="btn" id="dsi" ${bad||!n?'disabled':''}>Import ${n} records</button><button class="btn g" id="dsr2">Choose another file</button></div>`;
 document.querySelectorAll('input[name=tg]').forEach(r=>r.onchange=()=>{W.target=r.value;pv()});if($('wt')){$('wt').oninput=e=>W.title=e.target.value;$('wf').oninput=e=>W.fir=e.target.value;$('ws2').oninput=e=>W.suspect=e.target.value}
 $('dsr2').onclick=()=>{W.raw=null;tabImport()};$('dsi').onclick=doImport}
function doImport(){const out=B.out.slice().sort((x,y)=>ts(x)-ts(y));let c;
 if(W.target=='new'){c=newCase({title:W.title||'Imported – '+W.name,suspect:(W.suspect||B.top[0]||'').trim(),rows:out});if(W.fir.trim())c.fir=W.fir.trim()}
 else{c=cur();if(!c){c=newCase({title:'Imported – '+W.name,rows:[]})}c.rows=(W.target=='append'?c.rows.concat(out):out).sort((x,y)=>ts(x)-ts(y));if(!c.suspect)c.suspect=B.top[0]||''}
 setCase(c.id,'records');tcPersist();W.raw=null;W.title=W.fir=W.suspect='';close()}
function tabManual(){const c=cur(),el=$('dsb2');if(!c){el.innerHTML='<p class="note">Create or import a case first.</p>';return}
 const nums=[...new Set(c.rows.flatMap(r=>[r.a,r.b]))].slice(0,200),cells=[...new Set(c.rows.map(r=>r.cell).filter(Boolean))];
 el.innerHTML=`<p class="note">Add a single call record to <b>${esc(c.fir)}</b>. Picking a known tower ID fills in its address and coordinates.</p><datalist id="mn">${nums.map(n=>`<option value="${esc(n)}">`).join('')}</datalist><datalist id="mc">${cells.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
 <div class="mg"><label>A-Party (caller) *<input type="text" id="m_a" list="mn"></label><label>B-Party (called) *<input type="text" id="m_b" list="mn"></label><label>Date *<input type="date" id="m_date"></label><label>Time<input type="time" step="1" id="m_time"></label><label>Duration (seconds)<input type="number" id="m_dur" min="0" value="0"></label><label>Type<select id="m_type"><option>Voice</option><option>SMS</option><option>Data</option></select></label><label>IMEI<input type="text" id="m_imei"></label><label>IMSI<input type="text" id="m_imsi"></label><label>Cell / tower ID<input type="text" id="m_cell" list="mc"></label><label>Tower address<input type="text" id="m_addr"></label><label>Latitude<input type="text" id="m_lat"></label><label>Longitude<input type="text" id="m_lon"></label></div>
 <div class="row"><button class="btn" id="m_add">Add record</button><span class="note" id="m_msg"></span></div>`;
 $('m_cell').onchange=e=>{const r=c.rows.find(x=>x.cell==e.target.value);if(r){$('m_addr').value=r.addr||'';$('m_lat').value=r.lat;$('m_lon').value=r.lon}};
 $('m_add').onclick=()=>{const g=k=>$('m_'+k).value.trim(),a=nNum(g('a'),true),b=nNum(g('b'),true);if(!(a||b)||!g('date')){$('m_msg').textContent='Enter at least one number and a date.';return}
  const la=parseFloat(g('lat')),lo=parseFloat(g('lon'));c.rows.push({a,b,date:g('date'),time:pTime(g('time'))||'00:00:00',dur:+g('dur')||0,type:g('type'),imei:g('imei'),imsi:g('imsi'),cell:g('cell'),addr:g('addr'),lat:isFinite(la)?la:'',lon:isFinite(lo)?lo:''});
  c.rows.sort((x,y)=>ts(x)-ts(y));setCase(c.id);tcPersist();tabManual();$('m_msg').textContent='Added. This case now has '+c.rows.length+' records.'}}
function blank(){const c=newCase({title:'New matter',rows:[]});setCase(c.id,'cases');return c}
function tabCases(){const el=$('dsb2'),sv=window._saved;
 el.innerHTML=`<div class="dsm ${sv&&sv.err?'bad':''}">${sv?(sv.err?'Auto-save failed – browser storage is full. Export a backup below.':'Auto-saved '+new Date(sv.t).toLocaleTimeString()+' · '+sv.kb+' KB in this browser'):'Auto-save runs every few seconds.'}</div>
 <div class="tw"><table><thead><tr><th>FIR</th><th>Title</th><th>Records</th><th>Subject</th><th></th></tr></thead><tbody>${CASES.map(c=>`<tr><td>${esc(c.fir)}</td><td>${esc(c.title)}</td><td>${c.rows.length}</td><td>${esc(c.suspect||'–')}</td><td><button class="btn g" data-del="${c.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>
 <div class="row" style="margin-top:14px"><button class="btn" id="bk">Export backup (JSON)</button><label class="btn g">Restore backup<input type="file" id="br" accept=".json" hidden></label><button class="btn g" id="rd">Reset to demo data</button><button class="btn g" id="ca">Clear everything</button></div>`;
 el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const c=CASES.find(x=>x.id==b.dataset.del);if(!confirm('Delete '+c.fir+' and its '+c.rows.length+' records?'))return;CASES=CASES.filter(x=>x!=c);if(!CASES.length)blank();else setCase(CASES.some(x=>x.id==CUR)?CUR:CASES[0].id,'cases');tcPersist();tabCases()});
 $('bk').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({cases:CASES,fseq})],{type:'application/json'}));a.download='tracecdr-backup.json';a.click()};
 $('br').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!Array.isArray(o.cases)||!o.cases.length)throw 0;CASES=o.cases;fseq=o.fseq||CASES.length;setCase(CASES[0].id,'cases');tcPersist();tabCases()}catch(x){alert('That is not a TraceCDR backup file.')}};r.readAsText(f)};
 $('rd').onclick=()=>{if(confirm('Replace everything with the built-in demo cases?')){initCases();tcPersist();tabCases()}};
 $('ca').onclick=()=>{if(confirm('Delete ALL cases and records from this browser?')){CASES=[];fseq=0;blank();tcPersist();W.raw=null;tab=0;draw()}}}
function tabRules(){const el=$('dsb2'),R=RULES,WL=[['hs','More than one handset'],['sim','More than one SIM'],['st','Interstate hops'],['co','Cross-border hops'],['night','Night-time activity'],['ct','Many distinct contacts'],['fan','Mule-like fan-in (many short inbound callers)'],['pass','Pass-through (outbound right after inbound)'],['sus','Named subject of case']];
 el.innerHTML=`<p class="note">These settings drive the risk score and several detectors. Final score = Rule Risk (min(100, triggered pattern weights + min(10, calls ÷ 3))) + Vector Match bonus + Convergence Synergy, using the fusion mode below. Changes apply immediately and are saved in this browser.</p>
 <h4 class="gh">Pattern weights (points)</h4><div class="mg">${WL.map(w=>`<label>${w[1]}<input type="number" min="0" max="100" data-w="${w[0]}" value="${R.w[w[0]]}"></label>`).join('')}</div>
 <h4 class="gh">Thresholds</h4><div class="mg"><label>Night starts (hour, 0–23)<input type="number" min="0" max="23" data-r="nightFrom" value="${R.nightFrom}"></label><label>Night ends (hour)<input type="number" min="0" max="23" data-r="nightTo" value="${R.nightTo}"></label><label>Night share that triggers (% of calls)<input type="number" min="1" max="100" data-r="nightShare" value="${R.nightShare}"></label><label>Contacts above which "many" triggers<input type="number" min="1" data-r="ctMin" value="${R.ctMin}"></label><label>Impossible-speed limit (km/h)<input type="number" min="20" data-r="speed" value="${R.speed}"></label><label>Co-location window (± minutes)<input type="number" min="1" data-r="coloc" value="${R.coloc}"></label><label>HIGH risk from score<input type="number" min="1" max="100" data-r="high" value="${R.high}"></label><label>ELEVATED risk from score<input type="number" min="1" max="100" data-r="mid" value="${R.mid}"></label><label>Vector similarity cutoff (%)<input type="number" min="0" max="99" data-r="simCut" value="${R.simCut}"></label><label>Maximum vector bonus<input type="number" min="0" max="50" data-r="simMax" value="${R.simMax}"></label><label>Fusion mode<select data-rs="fusion"><option value="synergy" ${R.fusion!='linear'?'selected':''}>Synergy</option><option value="linear" ${R.fusion=='linear'?'selected':''}>Weighted Linear Blend</option></select></label><label>Maximum synergy bonus (Synergy mode)<input type="number" min="0" max="30" data-r="synMax" value="${R.synMax}"></label><label>Vector weight % (Blend mode)<input type="number" min="0" max="100" data-r="blendW" value="${R.blendW}"></label></div>
 <h4 class="gh">Custom places (used to detect state / country changes)</h4><p class="note">One per line: <b>keyword | state | country | latitude | longitude</b>. The keyword is matched against the tower address (separate several keywords with commas). Example: <i>dubai, deira | Dubai | UAE | 25.20 | 55.27</i></p>
 <textarea id="rcp" rows="4" style="width:100%">${esc(R.custom.map(c=>[c.k.replace(/\|/g,', '),c.st,c.co,c.lat,c.lon].join(' | ')).join('\n'))}</textarea>
 <div class="row" style="margin-top:12px"><button class="btn" id="rsv">Save rules</button><button class="btn g" id="rrs">Restore defaults</button><span class="note" id="rms"></span></div>`;
 $('rsv').onclick=()=>{const o={w:{},custom:[]};el.querySelectorAll('[data-w]').forEach(i=>o.w[i.dataset.w]=Math.max(0,+i.value||0));el.querySelectorAll('[data-r]').forEach(i=>o[i.dataset.r]=+i.value);el.querySelectorAll('[data-rs]').forEach(i=>o[i.dataset.rs]=i.value);
  $('rcp').value.split('\n').forEach(l=>{const p=l.split('|').map(x=>x.trim());if(p.length>=5&&p[0]&&isFinite(+p[3])&&isFinite(+p[4]))o.custom.push({k:p[0].split(',').map(x=>x.trim()).filter(Boolean).join('|'),st:p[1],co:p[2],lat:+p[3],lon:+p[4]})});
  try{localStorage.setItem('tcdr_rules',JSON.stringify(o))}catch(e){}Object.assign(RULES,o,{w:Object.assign({},RULES_DEF.w,o.w)});applyPlaces();setCase(CUR);$('rms').textContent='Saved. Scores and detectors now use these rules ('+o.custom.length+' custom place(s)).'};
 $('rrs').onclick=()=>{try{localStorage.removeItem('tcdr_rules')}catch(e){}Object.assign(RULES,JSON.parse(JSON.stringify(RULES_DEF)));applyPlaces();setCase(CUR);tabRules()}}
function tabAI(){const el=$('dsb2');
 const s=sess();
 el.innerHTML=`<p class="note">AI requests use an authenticated Supabase Edge Function with a Supabase-held API key. The key is never sent to the browser.</p>
 <div class="mg"><label>Backend AI Proxy<input type="text" value="Supabase Edge Function: ai-proxy" disabled></label><label>Model Selection<select id="amd"><option value="gemini-3.5-flash">Gemini 3.5 Flash</option><option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Fast)</option></select></label></div>
 <div class="row"><span class="tag" style="background:rgba(25,211,162,0.12);color:#19d3a2;border-color:#19d3a2">Server-Managed Key</span><span class="note" id="akm">Authenticated as ${s?esc(s.u):'Local'} (${s?esc(s.role):'unauthenticated'})</span></div>
 <h4 class="gh">AI Testing</h4>
 <div class="row"><button class="btn" id="at1">1 · Test Proxy Connection</button><button class="btn" id="at2">2 · Test AI Brief on Data</button><button class="btn" id="at3">3 · Run Engine Self-Test</button></div>
 <div id="atr" class="note" style="margin-top:10px;line-height:1.55">Run the tests in order. Engine self-test operates 100% offline.</div>`;
 const out=h=>{$('atr').innerHTML=h},ok=t=>'<span style="color:#51cf66">\u2714</span> '+t,bad=t=>'<span style="color:#ff3b6b">\u2718</span> '+t;
 $('at1').onclick=async()=>{out('Contacting Supabase AI function\u2026');const t0=performance.now();
  try{
    if(!window.sb) throw new Error('Sign in first.');
    const r=await window.sb.functions.invoke('ai-proxy',{body:{prompt:'Reply with the single word OK.',model:$('amd').value}});
    const ms=Math.round(performance.now()-t0);
    if(!r.error){const j=r.data||{};out(ok('<b>Connected to AI Proxy</b> in '+ms+' ms. Supabase responded: \u201c'+esc((j.content||[]).map(x=>x.text||'').join('').trim().slice(0,40))+'\u201d.'))}
    else{out(bad('<b>AI proxy error</b> ('+ms+' ms): '+esc((r.data&&r.data.error)||r.error.message||'Request failed')))}
  }catch(e){out(bad('<b>Could not reach Supabase AI function</b>: '+esc(e.message)))}};
 $('at2').onclick=async()=>{if(!rows.length)return out(bad('No records loaded. Import a CDR or load demo data first.'));const n=defSel(),p=prof(n);out('Requesting AI brief for '+esc(n)+'\u2026');const t0=performance.now();
  let a=null;try{a=await aiBrief(p)}catch(e){}const ms=Math.round(performance.now()-t0);
  out(a?ok('<b>AI brief generated</b> in '+ms+' ms for <b>'+esc(n)+'</b> (score '+p.score+').')+'<div style="margin:8px 0;padding:8px;border-left:3px solid #ff8a3d">'+esc(a)+'</div><small>Check every claim against the flags: '+esc(p.f.join('; ')||'none')+'</small>'
   :bad('<b>AI brief unavailable</b> ('+ms+' ms), so the offline summary is used instead.')+'<div style="margin:8px 0;padding:8px;border-left:3px solid #38b6ff">'+esc(localBrief(p))+'</div>')};
 $('at3').onclick=()=>{const saved=rows,R=[],T=(a,b,d,h,m,dur,im,is,cell,la,lo,st,ty)=>R.push({a,b,date:d,time:String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00',dur,type:ty||'Voice',imei:im,imsi:is,cell,addr:cell,lat:String(la),lon:String(lo),state:st||'',country:''});
  const S='9000000001',M='9000000002',C='9000000003',I1='350000000000001',IA='404000000000001',IB='404000000000002',DL=['DL1',28.63,77.21],MB=['MB1',19.11,72.87],RX=['RX1',26.98,84.85],NP=['NP1',27.01,84.88];
  for(let d=19;d<=23;d++){const day='2026-10-'+d,sim=d<22?IA:IB;[10,15].forEach((h,i)=>T(S,'90001000'+i+(d%3),day,h,5,60,I1,sim,DL[0],DL[1],DL[2],'Delhi'));T(S,'900010009'+(d%4),day,1,30,90,I1,sim,DL[0],DL[1],DL[2],'Delhi')}
  T(S,'9000100000','2026-10-20',16,0,50,I1,IA,DL[0],DL[1],DL[2],'Delhi');T('9000100001',S,'2026-10-20',16,22,40,'350000000000009',IA,MB[0],MB[1],MB[2],'Maharashtra');
  T(S,'9000100002','2026-10-24',10,0,60,I1,IB,RX[0],RX[1],RX[2],'Bihar');T(S,'9000100003','2026-10-24',10,25,60,I1,IB,NP[0],NP[1],NP[2],'Nepal (Intl Roaming)');
  for(let i=0;i<20;i++){const h=9+(i%10),m=(i*7)%50;T('90002'+String(10000+i).slice(1),M,'2026-10-2'+(i%5),h,m,20,'350000000000050','404000000000050','DL2',28.6,77.2,'Delhi');if(i%3==0)T(M,S,'2026-10-2'+(i%5),h,m+3,0,'350000000000050','404000000000050','DL2',28.6,77.2,'Delhi','SMS')}
  for(let i=0;i<12;i++)T(C,'90003'+(i%3)+'0000',  '2026-10-2'+(i%4),11+(i%5),10*(i%5),120,'350000000000070','404000000000070','DL3',28.55,77.25,'Delhi');
  const res=[];const chk=(n,f)=>{try{const r=f();res.push([n,!!r[0],r[1]])}catch(e){res.push([n,false,'error: '+e.message])}};
  try{rows=R.sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time));const pS=prof(S),pM=prof(M),pC=prof(C);
   chk('SIM swap (one handset, two SIMs)',()=>{const m={};rows.forEach(r=>{(m[r.imei]=m[r.imei]||new Set()).add(r.imsi)});const x=Object.entries(m).filter(e=>e[1].size>1&&e[0]==I1);return[x.length==1,x.length?'handset '+I1+' used '+x[0][1].size+' SIMs':'not found']});
   chk('IMSI clone (impossible speed)',()=>{const L=rows.filter(r=>r.imsi==IA&&r.lat).sort((x,y)=>ts(x)-ts(y));let best=0;for(let i=1;i<L.length;i++)if(L[i].imei!=L[i-1].imei){const km=hav({lat:+L[i-1].lat,lon:+L[i-1].lon},{lat:+L[i].lat,lon:+L[i].lon}),h=Math.max((ts(L[i])-ts(L[i-1]))/36e5,1/360);best=Math.max(best,km/h)}return[best>RULES.speed,Math.round(best)+' km/h (limit '+RULES.speed+')']});
   chk('Interstate movement',()=>[pS.st>=1,pS.st+' hop(s)']);
   chk('Cross-border movement',()=>[pS.co>=1,pS.co+' hop(s)']);
   chk('Night-time activity',()=>[pS.f.some(f=>/night/.test(f)),pS.night+' night call(s)']);
   chk('Mule-like fan-in',()=>[pM.f.some(f=>/mule-like/.test(f)),pM.f.find(f=>/mule-like/.test(f))||'not flagged']);
   chk('No false alarm on a normal subscriber',()=>[pC.score<RULES.mid&&!pC.f.some(f=>/hops|handsets|SIMs|night|mule|named/.test(f)),'score '+pC.score+' (LOW), no rule flags'+(pC.f.length?' beyond pattern similarity':'')]);
   chk('Risk ranking (suspect above normal)',()=>[pS.score>pC.score,pS.score+' vs '+pC.score]);
   chk('Importer: odd headers and dd/mm/yyyy dates',()=>{const r=window.parseCSV('Calling,Called,Call Date,Call Time,Duration\n9811111111,9822222222,25/11/2026,14:30:00,60\n');return[r.length==1&&r[0].date=='2026-11-25'&&r[0].dur==60,r.length?r[0].date+' '+r[0].time+' dur '+r[0].dur:'0 rows']})}
  finally{rows=saved}
  const pass=res.filter(x=>x[1]).length;
  out('<b>Engine self-test: '+pass+' / '+res.length+' passed</b> <small>(runs on a built-in planted dataset; your data is untouched)</small><br>'+res.map(x=>(x[1]?ok:bad)(esc(x[0])+' <small style="opacity:.7">\u2014 '+esc(x[2])+'</small>')).join('<br>')+(pass==res.length?'':'<br><small>A failing check means a rule or threshold was changed in Rules &amp; scoring.</small>'))};
}
const bt=document.createElement('button');bt.className='btn';bt.id='dsb';bt.textContent='Data Studio';$('exp').after(bt);bt.onclick=()=>open(0);
$('file').onchange=e=>{readFile(e.target.files[0]);e.target.value=''};
addEventListener('dragover',e=>e.preventDefault());addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer&&e.dataTransfer.files[0];if(f&&!$('intro'))readFile(f)});
window.dsOpen=open;
})();
