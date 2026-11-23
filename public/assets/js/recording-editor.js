(function(){
var $=function(i){return document.getElementById(i)};
var inFrame=false;try{inFrame=window.self!==window.top}catch(e){inFrame=true}
var FS=!!window.showSaveFilePicker&&!!window.showOpenFilePicker&&!inFrame;
var handle=null,perm='none',lastSave=null,lastErr='',saving=false,tmr=0,dirty=false,ver=0,atmr=0,ADL=false;try{ADL=localStorage.getItem('tcdr_autodl')==='1'}catch(e){}
var DK='tcdr_rdel';
function sess(){try{return JSON.parse(sessionStorage.getItem('tcdr_sess')||'null')}catch(e){return null}}
function ro(){var s=sess();return !!s&&s.role==='viewer'}
function who(){var s=sess();return s?s.u:'-'}
function lg(a,c,d){try{window.TC_LOG&&window.TC_LOG(a,c,d)}catch(e){}}
function rdj(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')||d}catch(e){return d}}
function persist(){try{tcPersist()}catch(e){}}
/* ---------- tiny IndexedDB for the file handle ---------- */
function hdb(){return new Promise(function(res,rej){var q=indexedDB.open('tcdr_fs',1);q.onupgradeneeded=function(){q.result.createObjectStore('h')};q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}})}
function hput(v){return hdb().then(function(d){return new Promise(function(res,rej){var t=d.transaction('h','readwrite');if(v)t.objectStore('h').put(v,'f');else t.objectStore('h').delete('f');t.oncomplete=res;t.onerror=function(){rej(t.error)}})})}
function hget(){return hdb().then(function(d){return new Promise(function(res,rej){var q=d.transaction('h').objectStore('h').get('f');q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}})})}
/* ---------- snapshot ---------- */
function snap(){return {app:'TraceCDR',format:2,savedAt:new Date().toISOString(),savedBy:who(),cases:CASES,fseq:fseq,cur:CUR,trash:rdj('tcdr_trash',[]),deletedRecords:rdj(DK,[]),audit:rdj('tcdr_audit',[])}}
function jsonText(){return JSON.stringify(snap())}
/* ---------- file writing ---------- */
function status(){var e=$('dfb');if(!e)return;var c='',t='';
  if(!FS){c='warn';t='Backup (download)'}
  else if(!handle){c='';t='Data file: not linked'}
  else if(perm!=='granted'){c='warn';t='Data file: click to re-allow'}
  else if(lastErr){c='bad';t='Data file: save failed'}
  else{c='ok';t='Data file: '+handle.name+(lastSave?' · saved '+lastSave.toLocaleTimeString():'')}
  e.innerHTML='<span class="dfs '+c+'"></span>\uD83D\uDCBE '+t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  var d=$('dft');if(d)d.innerHTML=!FS?(inFrame?'This page is running inside a frame, where browsers block file access. ':'This browser cannot keep a file open for auto-save. ')+'Use <b>Download backup</b> after changes and <b>Open existing file</b> to load it again. (Chrome or Edge on a computer give true auto-save.)':!handle?'No file linked. Create one and every add, delete or edit is saved into it automatically.':'Linked file: <b>'+handle.name+'</b><br>'+(perm==='granted'?'Auto-save is on.'+(lastSave?' Last saved '+lastSave.toLocaleString()+'.':''):'Permission is needed again after reopening the app: press <b>Save now</b>.')+(lastErr?'<br><span style="color:#e03131">Last error: '+lastErr+'</span>':'')}
async function checkPerm(req){if(!handle)return 'none';try{var o={mode:'readwrite'};var p=await handle.queryPermission(o);if(p!=='granted'&&req)p=await handle.requestPermission(o);perm=p}catch(e){perm='denied'}return perm}
async function writeNow(req){if(!handle||saving)return false;if(await checkPerm(req)!=='granted'){status();return false}
  saving=true;var v=ver;try{var w=await handle.createWritable();await w.write(jsonText());await w.close();lastSave=new Date();lastErr='';if(v===ver)dirty=false;return true}catch(e){lastErr=e.message||String(e);return false}finally{saving=false;status();if(dirty&&!lastErr)schedule()}}
function schedule(){ver++;dirty=true;status();if(handle&&FS){clearTimeout(tmr);tmr=setTimeout(function(){writeNow(false)},900)}
  else if(ADL){clearTimeout(atmr);atmr=setTimeout(function(){if(dirty){download(true)}},120000)}}
var _tp=window.tcPersist;window.tcPersist=function(){var r=_tp.apply(this,arguments);schedule();return r};
try{tcPersist=window.tcPersist}catch(e){}
addEventListener('beforeunload',function(e){if(dirty&&(handle||ADL)){e.preventDefault();e.returnValue=''}});
function download(quiet){var u=URL.createObjectURL(new Blob([jsonText()],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='tracecdr-data-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();URL.revokeObjectURL(u)},4000);lastSave=new Date();dirty=false;status();if(!quiet)flash('Backup downloaded: '+a.download)}
function csvCase(){var c=cur();if(!c)return;var K=['a','b','date','time','dur','type','imei','imsi','cell','addr','lat','lon'];
  var t=K.join(',')+'\n'+c.rows.map(function(r){return K.map(function(k){return sanitizeCsvCell(r[k])}).join(',')}).join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+t],{type:'text/csv'}));a.download=(c.fir||'case').replace(/[^\w.-]+/g,'_')+'-records.csv';document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},3000);flash('Exported '+c.rows.length+' records')}
/* ---------- loading a file ---------- */
function applyFile(o,name){if(!o||!Array.isArray(o.cases)||!o.cases.length)throw new Error('Not a TraceCDR data file');
  CASES=o.cases;fseq=o.fseq||CASES.length;
  try{if(o.trash)localStorage.setItem('tcdr_trash',JSON.stringify(o.trash));if(o.deletedRecords)localStorage.setItem(DK,JSON.stringify(o.deletedRecords));if(o.audit)localStorage.setItem('tcdr_audit',JSON.stringify(o.audit))}catch(e){}
  setCase(CASES.some(function(c){return c.id==o.cur})?o.cur:CASES[0].id,'cases');persist();lg('Data file opened',null,name||'')}
function confirmReplace(){return !CASES.some(function(c){return c.rows.length})||confirm('Loading this file REPLACES the cases currently in this browser. Continue?')}
async function openExisting(){
  if(FS){try{var hs=await showOpenFilePicker({types:[{description:'TraceCDR data',accept:{'application/json':['.json']}}]});var h=hs[0],f=await h.getFile(),o=JSON.parse(await f.text());if(!confirmReplace())return;
    handle=h;await hput(h);await checkPerm(true);applyFile(o,f.name);lastSave=new Date(f.lastModified);lastErr='';status();flash('Loaded '+CASES.length+' case(s) from '+f.name)}catch(e){if(e&&e.name==='AbortError')return;if(e&&(e.name==='SecurityError'||e.name==='NotAllowedError')){FS=false;dlg(true);$('dfu').click()}else alert('Could not open file: '+(e&&e.message))}}
  else $('dfu').click()}
$('dfu').onchange=function(e){var f=e.target.files[0];e.target.value='';if(!f)return;var r=new FileReader();r.onload=function(){try{var o=JSON.parse(r.result);if(!confirmReplace())return;applyFile(o,f.name);flash('Loaded '+f.name)}catch(x){alert('Could not open file: '+x.message)}};r.readAsText(f)};
async function linkNew(){try{var h=await showSaveFilePicker({suggestedName:'tracecdr-data.json',types:[{description:'TraceCDR data',accept:{'application/json':['.json']}}]});handle=h;await hput(h);perm='granted';await writeNow(true);flash('Linked '+h.name+' · changes now save automatically');lg('Data file linked',null,h.name)}catch(e){if(e&&e.name==='AbortError')return;if(e&&(e.name==='SecurityError'||e.name==='NotAllowedError'||e.name==='TypeError')){FS=false;dlg(true);alert('This browser or page does not allow saving to a chosen file here ('+e.name+').\nA backup file will be downloaded instead. For automatic saving open this page directly in Chrome or Edge on a computer.');download()}else alert('Could not create file: '+(e&&e.message))}}
/* ---------- dialog + header button ---------- */
var hb=document.createElement('button');hb.className='btn g';hb.id='dfb';hb.type='button';
var hr=$('exp')&&$('exp').parentNode;if(hr)hr.insertBefore(hb,$('exp'));
function dlg(on){$('dfm').classList.toggle('on',on);if(on){$('dfi').textContent=FS?'Keep all case records in a file on your computer.':'Keep a backup file of all case records.';$('df1').style.display=FS?'':'none';$('df3').textContent=FS?'Save now':'Download backup';$('df4').style.display=FS?'':'none';$('df5').style.display=FS?'':'none';$('dfal').style.display=FS&&handle?'none':'';status()}}
hb.onclick=function(){dlg(true)};$('dfx').onclick=function(){dlg(false)};
$('dfm').addEventListener('click',function(e){if(e.target===$('dfm'))dlg(false)});
$('df1').onclick=linkNew;$('df2').onclick=openExisting;
$('df3').onclick=async function(){if(FS&&handle){var ok=await writeNow(true);flash(ok?'Saved to '+handle.name:'Save failed')}else if(FS){linkNew()}else download()};
$('df4').onclick=function(){download()};$('df6').onclick=csvCase;
$('dfa').checked=ADL;$('dfa').onchange=function(){ADL=this.checked;try{localStorage.setItem('tcdr_autodl',ADL?'1':'0')}catch(e){}flash(ADL?'Auto-backup on':'Auto-backup off')};
$('df5').onclick=async function(){handle=null;perm='none';lastErr='';await hput(null);status();flash('File unlinked')};
if(FS)hget().then(function(h){if(h){handle=h;checkPerm(false).then(status)}}).catch(function(){});
status();
/* ---------- record add / delete ---------- */
var SEL=new Set(),selCase=null,addOpen=false,FV={},UNDO=[];
function pushBin(items,c){var b=rdj(DK,[]);var at=new Date().toISOString(),by=who();items.forEach(function(x){b.unshift({at:at,by:by,fir:c.fir,r:x.r})});if(b.length>500)b.length=500;try{localStorage.setItem(DK,JSON.stringify(b))}catch(e){try{b.length=100;localStorage.setItem(DK,JSON.stringify(b))}catch(x){}}}
function after(){var c=cur();if(c&&c.rows!==rows)c.rows=rows;persist();try{stats()}catch(e){}V.records()}
function del(list,label){if(ro()){alert('Viewers cannot delete records.');return}var c=cur();if(!c||!list.length)return;
  if(!confirm('Delete '+list.length.toLocaleString()+' record(s) from '+c.fir+'?'+(label?'\n'+label:'')+'\nYou can undo this right away, and deleted records are kept in the data file.'))return;
  var S=new Set(list),items=[],keep=[];rows.forEach(function(r,i){if(S.has(r))items.push({r:r,i:i});else keep.push(r)});
  rows.length=0;for(var i=0;i<keep.length;i++)rows.push(keep[i]);
  UNDO.push({id:c.id,items:items});if(UNDO.length>20)UNDO.shift();pushBin(items,c);
  list.forEach(function(r){SEL.delete(r)});lg('Records deleted',c,items.length+' record(s)');after();flash(items.length+' record(s) deleted')}
function undo(){var u=UNDO.pop();if(!u)return;var c=CASES.find(function(x){return x.id==u.id});if(!c)return;if(c.id!==CUR){UNDO.push(u);alert('Switch back to '+c.fir+' to undo.');return}
  u.items.sort(function(a,b){return a.i-b.i}).forEach(function(x){rows.splice(Math.min(x.i,rows.length),0,x.r)});
  var b=rdj(DK,[]),S=new Set(u.items.map(function(x){return x.r}));b=b.filter(function(x){return !S.has(x.r)&&!u.items.some(function(y){return JSON.stringify(y.r)===JSON.stringify(x.r)})});try{localStorage.setItem(DK,JSON.stringify(b))}catch(e){}
  lg('Records restored',c,u.items.length+' record(s)');after();flash(u.items.length+' record(s) restored')}
function addRec(){var g=function(k){return ($('rx_'+k).value||'').trim()},c=cur(),m=$('rx_msg');if(!c)return;
  var a=nNum(g('a'),true),b=nNum(g('b'),true);if(!(a||b)||!g('date')){m.textContent='Enter at least one number and a date.';return}
  var la=parseFloat(g('lat')),lo=parseFloat(g('lon'));
  var r={a:a,b:b,date:g('date'),time:pTime(g('time'))||'00:00:00',dur:+g('dur')||0,type:g('type')||'Voice',imei:g('imei'),imsi:g('imsi'),cell:g('cell'),addr:g('addr'),lat:isFinite(la)?la:'',lon:isFinite(lo)?lo:''};
  if(r.cell&&(!isFinite(la)||!isFinite(lo))){var k=rows.find(function(x){return x.cell==r.cell&&x.lat!==''&&x.lat!=null});if(k){r.lat=k.lat;r.lon=k.lon;if(!r.addr)r.addr=k.addr||''}}
  rows.push(r);rows.sort(function(x,y){return ts(x)-ts(y)});FV={};lg('Record added',c,r.a+' \u2192 '+r.b+' '+r.date);after();flash('Record added · '+rows.length.toLocaleString()+' in this case')}
var vr=V.records;
V.records=function(){vr.apply(this,arguments);var mm=$('main'),c=cur();if(!c)return;
  if(selCase!==c.id){SEL=new Set();selCase=c.id;UNDO=UNDO.filter(function(u){return u.id===c.id})}
  var tb=mm.querySelector('table'),R=ro(),vis=tb?(typeof shown!=='undefined'?shown:rows).slice(0,300):[];if(!tb&&!R&&!rows.length)addOpen=true;
  /* checkbox column */
  if(!R&&tb){var hrw=tb.querySelectorAll('thead tr');hrw[0].insertAdjacentHTML('afterbegin','<th class="rxc"><input type="checkbox" id="rx_all" title="Select all shown"></th>');if(hrw[1])hrw[1].insertAdjacentHTML('afterbegin','<th class="rxc"></th>');
    tb.querySelectorAll('tbody tr').forEach(function(tr,i){var r=vis[i];if(!r)return;tr.insertAdjacentHTML('afterbegin','<td class="rxc"><input type="checkbox" data-rx="'+i+'"'+(SEL.has(r)?' checked':'')+'> <button class="rx-x" data-rd="'+i+'" title="Delete this record">\u2715</button></td>');if(SEL.has(r))tr.classList.add('hl')});
    var all=$('rx_all');all.checked=vis.length>0&&vis.every(function(r){return SEL.has(r)});
    all.onchange=function(){vis.forEach(function(r){all.checked?SEL.add(r):SEL.delete(r)});V.records()};
    tb.querySelectorAll('[data-rx]').forEach(function(x){x.onchange=function(){var r=vis[+x.dataset.rx];x.checked?SEL.add(r):SEL.delete(r);upd();x.closest('tr').classList.toggle('hl',x.checked)}});
    tb.querySelectorAll('[data-rd]').forEach(function(x){x.onclick=function(){var r=vis[+x.dataset.rd];del([r],r.a+' \u2192 '+r.b+' · '+r.date+' '+r.time)}})}
  /* toolbar */
  var flt=typeof shown!=='undefined'?shown:rows,nums=[],cells=[];
  var h='<div class="rx"><div class="row">'+(R?'':'<button class="btn" id="rx_new">'+(addOpen?'Hide add form':'+ Add record')+'</button><button class="btn d" id="rx_ds">Delete selected (<span id="rx_n">'+SEL.size+'</span>)</button><button class="btn g" id="rx_dall">Delete all '+flt.length.toLocaleString()+' shown by filter</button><button class="btn g" id="rx_un">Undo delete</button>')+'<button class="btn g" id="rx_file">\uD83D\uDCBE Data file</button><span class="note" id="rx_info"></span></div>';
  if(!R&&addOpen){var ns=[],cs=[],S1={},S2={};rows.forEach(function(r){[r.a,r.b].forEach(function(n){if(n&&!S1[n]&&ns.length<200){S1[n]=1;ns.push(n)}});if(r.cell&&!S2[r.cell]){S2[r.cell]=1;cs.push(r.cell)}});
    var f=function(k,l,t,x){return '<label>'+l+'<input id="rx_'+k+'" type="'+(t||'text')+'" '+(x||'')+' value="'+esc(FV[k]||'')+'"></label>'};
    h+='<div class="rx-form"><datalist id="rx_dn">'+ns.map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist><datalist id="rx_dc">'+cs.map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist><div class="g">'+f('a','A-Party (caller) *','text','list="rx_dn"')+f('b','B-Party (called) *','text','list="rx_dn"')+f('date','Date *','date')+f('time','Time','time','step="1"')+f('dur','Duration (s)','number','min="0"')+'<label>Type<select id="rx_type">'+['Voice','SMS','Data'].map(function(t){return '<option'+(FV.type==t?' selected':'')+'>'+t+'</option>'}).join('')+'</select></label>'+f('imei','IMEI')+f('imsi','IMSI')+f('cell','Cell / tower ID','text','list="rx_dc"')+f('addr','Tower address')+f('lat','Latitude')+f('lon','Longitude')+'</div><div class="row" style="margin-top:8px"><button class="btn" id="rx_add">Add record</button><span class="note" id="rx_msg">Saved into <b>'+esc(c.fir)+'</b> and the data file automatically.</span></div></div>'}
  h+='</div>';var sb=mm.querySelector('.sub');if(sb)sb.insertAdjacentHTML('afterend',h);else{var h2=mm.querySelector('h2');if(h2)h2.insertAdjacentHTML('afterend',h);else mm.insertAdjacentHTML('afterbegin',h)}
  var q=function(i){return $(i)};
  if(q('rx_new'))q('rx_new').onclick=function(){addOpen=!addOpen;V.records()};
  if(q('rx_ds'))q('rx_ds').onclick=function(){if(!SEL.size){flash('Tick the records to delete first');return}del(Array.from(SEL))};
  if(q('rx_dall'))q('rx_dall').onclick=function(){var fl=typeof shown!=='undefined'?shown:rows;if(fl.length===rows.length&&!confirm('No filter is applied: this deletes EVERY record in the case.'))return;del(fl.slice())};
  if(q('rx_un'))q('rx_un').onclick=undo;
  if(q('rx_file'))q('rx_file').onclick=function(){dlg(true)};
  if(q('rx_add')){q('rx_add').onclick=addRec;['a','b','date','time','dur','imei','imsi','cell','addr','lat','lon','type'].forEach(function(k){var e=q('rx_'+k);if(e)e.oninput=e.onchange=function(){FV[k]=e.value}});
    q('rx_cell').addEventListener('change',function(){var r=rows.find(function(x){return x.cell==q('rx_cell').value});if(r){q('rx_addr').value=r.addr||'';q('rx_lat').value=r.lat;q('rx_lon').value=r.lon;FV.addr=q('rx_addr').value;FV.lat=q('rx_lat').value;FV.lon=q('rx_lon').value}})}
  upd()};
function upd(){var n=$('rx_n');if(n)n.textContent=SEL.size;var i=$('rx_info');if(i)i.textContent=rows.length.toLocaleString()+' records in this case'+(UNDO.length?' · '+UNDO.length+' undo step(s)':'')}
})();
