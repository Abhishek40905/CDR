(function(){
var $=function(id){return document.getElementById(id)},uc=document.querySelector('#um .uc');if(!uc)return;
function rd(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var h=uc.querySelector('h3');h.textContent='Super admin console';
var pu=document.createElement('div');pu.id='sa-u';Array.prototype.slice.call(uc.children).forEach(function(c){if(c!==h)pu.appendChild(c)});
var bar=document.createElement('div');bar.className='sat';
[['u','Users'],['a','Audit log'],['c','Cases'],['s','System']].forEach(function(t){var b=document.createElement('button');b.type='button';b.dataset.t=t[0];b.textContent=t[1];b.onclick=function(){tab(t[0])};bar.appendChild(b)});
var x=document.createElement('button');x.type='button';x.className='sx';x.textContent='Close ✕';x.onclick=function(){$('uc').onclick()};bar.appendChild(x);
var pa=document.createElement('div'),pc=document.createElement('div'),ps=document.createElement('div');pa.id='sa-a';pc.id='sa-c';ps.id='sa-s';
uc.appendChild(bar);uc.appendChild(pu);uc.appendChild(pa);uc.appendChild(pc);uc.appendChild(ps);
function dl(name,txt,type){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:type}));a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},500)}
async function audit(){var body=$('sat'),q=(($('saq')||{}).value||'').toLowerCase();body.innerHTML='<tr><td colspan="4">Loading server audit log…</td></tr>';if(!window.sb){body.innerHTML='<tr><td colspan="4">Sign in to view audit logs.</td></tr>';return}
 var result=await window.sb.from('audit_logs').select('created_at,actor_email,action,target_type,target_id,details').order('created_at',{ascending:false}).limit(200);
 if(result.error){body.innerHTML='<tr><td colspan="4">'+esc(result.error.message)+'</td></tr>';return}
 var entries=(result.data||[]).filter(function(r){return !q||JSON.stringify(r).toLowerCase().includes(q)});
 body.innerHTML=entries.map(function(r){return '<tr><td>'+esc(new Date(r.created_at).toLocaleString())+'</td><td>'+esc(r.actor_email)+'</td><td>'+esc(r.action)+'</td><td>'+esc(r.target_id||r.target_type||'')+'</td></tr>'}).join('')||'<tr><td colspan="4">No entries.</td></tr>'}
function cases(){pc.innerHTML='<p class="note">Cases in your current workspace are listed in the Case Registry. Other users’ workspaces are private.</p>'}
function sys(){ps.innerHTML='<p class="note">Use the Users tab for verified accounts and the Audit log tab for server records. Your current workspace is available in the Case Registry.</p>'}
function tab(t){Array.prototype.forEach.call(bar.querySelectorAll('button[data-t]'),function(b){b.classList.toggle('on',b.dataset.t===t)});
 pu.style.display=t==='u'?'':'none';pa.style.display=t==='a'?'':'none';pc.style.display=t==='c'?'':'none';ps.style.display=t==='s'?'':'none';
 if(t==='a'){pa.innerHTML='<input class="sfi" id="saq" placeholder="Filter by user, action or case"><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Case</th></tr></thead><tbody id="sat"></tbody></table>';$('saq').oninput=audit;audit()}
 if(t==='c')cases();if(t==='s')sys()}
window.SA_TAB=tab;tab('u');
})();
