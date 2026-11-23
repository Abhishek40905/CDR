(function(){
var AK='tcdr_audit',TK='tcdr_trash',R=document.documentElement;
function rd(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return[]}}
function wr(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function sess(){try{return JSON.parse(sessionStorage.getItem('tcdr_sess')||'null')}catch(e){return null}}
function who(){var s=sess();return s?s.u:'-'}
function ro(){var s=sess();return !!s&&s.role==='viewer'}
function log(a,c,d){var l=rd(AK);l.unshift({t:new Date().toISOString(),u:who(),a:a,f:c?c.fir:'',n:c?c.title:'',d:d||''});if(l.length>500)l.length=500;wr(AK,l);if(window.TCDR_SUPABASE&&window.TCDR_SUPABASE.audit)window.TCDR_SUPABASE.audit(a,c?c.id:null,{fir:c?c.fir:'',title:c?c.title:'',info:d||''})}
window.TC_LOG=log;
function lab(){var l=R.dataset.theme==='light';document.querySelectorAll('.thb').forEach(function(b){b.textContent=l?'\u263e Dark mode':'\u2600 Light mode'})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.thb');if(!b)return;var t=R.dataset.theme==='light'?'dark':'light';R.dataset.theme=t;try{localStorage.setItem('tcdr_theme',t)}catch(x){}lab()});
lab();
var STS=['Open','Under investigation','Charge-sheeted','Closed'],edId=null;
function fmt(t){var d=new Date(t);return d.toLocaleDateString()+' '+d.toLocaleTimeString()}
function rowsHTML(q){q=(q||'').toLowerCase();return rd(AK).filter(function(x){return !q||(x.a+' '+x.f+' '+x.n+' '+x.u+' '+x.d).toLowerCase().indexOf(q)>-1}).slice(0,100).map(function(x){return '<tr><td>'+esc(fmt(x.t))+'</td><td>'+esc(x.u)+'</td><td>'+esc(x.a)+'</td><td>'+esc(x.f)+' '+esc(x.n)+'</td><td>'+esc(x.d)+'</td></tr>'}).join('')||'<tr><td colspan="5" class="note">No entries yet.</td></tr>'}
var prev=V.cases;
V.cases=function(){
  prev.apply(this,arguments);var mm=$('main'),ff=mm.querySelector('#ff'),r=ro();
  if(!r&&ff)ff.insertAdjacentHTML('afterend','<div class="cs on" id="qa"><h3>Add a case</h3><div class="row"><input id="qt" placeholder="Case title / offence" style="flex:2;min-width:180px"><input id="qs" placeholder="Suspect number" style="flex:1;min-width:120px"><select id="qst">'+STS.map(function(x){return '<option>'+x+'</option>'}).join('')+'</select><button class="btn" id="qgo">Add case</button></div><div class="note" id="qm">Each case gets the next FIR number. Attach its CDR with Import CDR on the case card.</div></div>');
  var tr=rd(TK);
  mm.insertAdjacentHTML('beforeend','<div id="rec2"><h3>Case record</h3><p class="note">Every sign-in, case added, edited, status change and deletion is logged with time and user.</p><div class="row"><input id="rq" placeholder="Filter record" style="flex:1;min-width:160px"><button class="btn g" id="rx">Export record (CSV)</button></div><div class="tw"><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Case</th><th>Details</th></tr></thead><tbody id="rb">'+rowsHTML()+'</tbody></table></div><h3 style="margin-top:14px">Deleted cases</h3>'+(tr.length?'<div class="tw"><table><thead><tr><th>Case</th><th>Deleted</th><th>By</th><th>Records</th><th></th></tr></thead><tbody>'+tr.map(function(x,i){return '<tr><td>'+esc(x.c.fir)+' '+esc(x.c.title)+'</td><td>'+esc(fmt(x.at))+'</td><td>'+esc(x.by)+'</td><td>'+x.c.rows.length+'</td><td>'+(r?'':'<button class="btn g" data-rs="'+i+'">Restore</button>')+'</td></tr>'}).join('')+'</tbody></table></div>':'<p class="note">Nothing deleted. Deleted cases are kept here (latest 10) so they can be restored.</p>')+'</div>');
  var q=$('qgo');if(q)q.onclick=function(){var t=$('qt').value.trim();if(!t){$('qm').textContent='Enter a case title first.';return}var c=newCase({title:t,suspect:$('qs').value.trim(),status:$('qst').value});log('Case added',c,c.suspect?'Suspect '+c.suspect:'');try{tcPersist()}catch(e){}setCase(c.id,'cases')};
  $('rq').oninput=function(){$('rb').innerHTML=rowsHTML(this.value)};
  $('rx').onclick=function(){var l=rd(AK),c='Time,User,Action,Case,Details\n'+l.map(function(x){return [sanitizeCsvCell(x.t),sanitizeCsvCell(x.u),sanitizeCsvCell(x.a),sanitizeCsvCell(x.f+' '+x.n),sanitizeCsvCell(x.d)].join(',')}).join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:'text/csv'}));a.download='tracecdr-case-record.csv';a.click()};
  mm.querySelectorAll('[data-rs]').forEach(function(b){b.onclick=function(){var t=rd(TK),x=t.splice(+b.dataset.rs,1)[0];if(!x)return;var c=x.c;if(CASES.some(function(y){return y.id==c.id}))c.id='c'+(++fseq);CASES.push(c);wr(TK,t);log('Case restored',c,c.rows.length+' records');try{tcPersist()}catch(e){}setCase(c.id,'cases')}})
};
document.addEventListener('click',function(e){var t=e.target.closest&&e.target;if(!t)return;
  var d=t.closest('[data-cd]');
  if(d){e.stopImmediatePropagation();e.preventDefault();if(ro()){alert('Viewers cannot delete cases.');return}
    var c=CASES.find(function(x){return x.id==d.dataset.cd});if(!c)return;
    if(!confirm('Delete '+c.fir+' \u00b7 '+c.title+'?\nIt moves to Deleted cases in the case record and can be restored.'))return;
    var a=rd(TK);a.unshift({at:new Date().toISOString(),by:who(),c:JSON.parse(JSON.stringify(c))});if(a.length>10)a.length=10;
    if(!wr(TK,a)){a.forEach(function(x){x.c.rows=[]});wr(TK,a)}
    log('Case deleted',c,c.rows.length+' records archived');
    CASES=CASES.filter(function(x){return x!==c});CASES.forEach(function(x){if(x.parent==c.id)x.parent=null});
    if(!CASES.length)initEmpty();else setCase(CASES.some(function(x){return x.id==CUR})?CUR:CASES[0].id,'cases');
    try{tcPersist()}catch(x){}return}
  var ce=t.closest('[data-ce]');if(ce)edId=ce.dataset.ce;
  if(t.closest('#es')){var id=edId;setTimeout(function(){log('Case edited',CASES.find(function(x){return x.id==id}))},60)}
},true);
document.addEventListener('change',function(e){var s=e.target;if(s&&s.dataset&&s.dataset.st){var c=CASES.find(function(x){return x.id==s.dataset.st});if(c){log('Status changed',c,s.value);try{tcPersist()}catch(x){}}}});
})();
