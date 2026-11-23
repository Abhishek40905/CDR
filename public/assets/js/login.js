(function(){
// ===== 1. SUPABASE CLIENT & PUBLIC CONFIG INITIALIZATION =====
window.SUPABASE_URL = '';
window.SUPABASE_ANON_KEY = '';

// Vercel serves public/config.js; Supabase owns authentication and data APIs.
var configReady = Promise.resolve().then(function(){
  var cfg = window.TRACECDR_CONFIG || {};
  if(cfg.supabaseUrl) window.SUPABASE_URL = cfg.supabaseUrl;
  if(cfg.supabaseAnonKey) window.SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
  if(!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in the Vercel build settings.');
  window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.sb.auth.onAuthStateChange(function(event, current){
    var previous = sess();
    if(previous && previous.sb && current && current.user && previous.id === current.user.id){
      previous.token = current.access_token;
      sessionStorage.setItem(SK, JSON.stringify(previous));
    }
  });
  return window.sb;
});

async function verifiedIdentity(token){
  var authResult = await window.sb.auth.getUser(token);
  if(authResult.error || !authResult.data.user) throw new Error('Supabase could not verify this session.');
  var user = authResult.data.user;
  var result = await window.sb.from('profiles').select('username, role, is_active').eq('id', user.id).single();
  if(result.error || !result.data) throw new Error('Your account profile could not be verified.');
  if(result.data.is_active !== true) throw new Error('This account is deactivated.');
  return { id:user.id, email:user.email, username:result.data.username, role:result.data.role };
}

var $=function(id){return document.getElementById(id)};
var SK='tcdr_sess', LK='tcdr_lock';
function rd(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function wr(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function sess(){try{return JSON.parse(sessionStorage.getItem(SK)||'null')}catch(e){return null}}
function msg(id,t,ok){var e=$(id);if(e){e.textContent=t;e.className='msg'+(ok?' ok':'')}}
function open(){var l=$('lg');if(l)l.style.display='none';document.documentElement.style.overflow=''}
function lockLeft(){var o=rd(LK,{n:0,until:0});return Math.max(0,Math.ceil((o.until-Date.now())/1000))}
function fail(){var o=rd(LK,{n:0,until:0});o.n=(o.n||0)+1;if(o.n>=5){o.until=Date.now()+30000;o.n=0}wr(LK,o)}
function ok(){wr(LK,{n:0,until:0})}

// ===== 2. CASE & CDR CLOUD PERSISTENCE ENGINE =====
window.TCDR_SUPABASE = {
  // Syncs cases from Supabase scoped to authenticated user via RLS
  syncCases: async function(){
    var s = sess();
    if(!s || !s.sb) return;
    var result = await window.sb.from('app_states').select('state').eq('owner_id', s.id).maybeSingle();
    if(result.error) throw new Error(result.error.message || 'Cloud workspace could not be loaded');
    var state = result.data && result.data.state;
    if(state && Array.isArray(state.cases)){
      CASES = state.cases;
      fseq = state.fseq || CASES.length;
      if(CASES.length) setCase(CASES.some(function(c){return c.id === state.cur}) ? state.cur : CASES[0].id, 'cases');
      else initEmpty();
    } else if(s.role !== 'viewer'){
      await this.saveState();
    } else {
      CASES = []; initEmpty();
    }
  },

  saveState: async function(){
    var s = sess();
    if(!s || !s.sb || s.role === 'viewer') return;
    var live = await window.sb.auth.getSession();
    if(!live.data || !live.data.session) throw new Error('Session expired. Sign in again.');
    var result = await window.sb.from('app_states').upsert({
      owner_id:s.id,
      state:{ cases:CASES, fseq:fseq, cur:CUR },
      updated_at:new Date().toISOString()
    }, { onConflict:'owner_id' });
    if(result.error) throw new Error(result.error.message || 'Cloud save failed');
    window._cloudSavedAt = Date.now();
  },

  saveCase: function(){ return this.saveState(); },
  saveRecords: function(caseId, records){
    var c = CASES.find(function(item){ return item.id === caseId; });
    if(!c) return Promise.reject(new Error('Case not found'));
    c.rows = c.rows.concat(records || []);
    return this.saveState();
  },

  // Server-authoritative audit logging
  audit: function(action, caseId, details){
    var s = sess();
    if(!s || !s.sb) return;
    return window.sb.from('audit_logs').insert({
      actor_id: s.id, actor_email: s.email, actor_role: s.role,
      action: action, target_type: caseId ? 'CASE' : 'SYSTEM',
      case_id: null,
      details: Object.assign({ localCaseId: caseId || null }, details || {})
    }).then(function(result){ if(result.error) console.warn('Audit write failed:', result.error.message); });
  }
};

// ===== 3. SECURE AUTHENTICATION FLOW =====
function signIn(){
  var left=lockLeft();if(left){msg('lgm','Too many attempts. Try again in '+left+' s.');return}
  var u=$('lgu').value.trim(),p=$('lgp').value;
  if(!u||!p){msg('lgm','Enter username/email and password.');return}

  if(window.sb && window.sb.auth){
    msg('lgm','Authenticating with Supabase backend…');
    var email = u.includes('@') ? u : (u + '@tracecdr.internal');

    window.sb.auth.signInWithPassword({
      email: email,
      password: p
    }).then(async function(res){
      if(res.error){
        fail();
        msg('lgm', res.error.message || 'Incorrect credentials.');
        $('lgp').value='';
        return;
      }

      const token = res.data.session.access_token;
      ok();
      let identity;
      try {
        identity = await verifiedIdentity(token);
      } catch(err){
        await window.sb.auth.signOut();
        msg('lgm', err.message || 'Your account could not be verified.');
        return;
      }

      // Store authenticated session token reference
      var sessObj = {
        u: identity.username,
        role: identity.role,
        email: identity.email,
        id: identity.id,
        token: token,
        sb: true,
        offline: false
      };
      sessionStorage.setItem(SK, JSON.stringify(sessObj));
      try{ localStorage.setItem('tcdr_lastu', u); }catch(e){}
      try{ window.TCDR_SUPABASE.audit('User authenticated', null, { email: identity.email, role: identity.role }); }catch(e){}
      try{ sessionStorage.setItem('tcdr_intro','1'); }catch(e){}

      msg('lgm', 'Authenticated! Loading forensic suite…', true);
      setTimeout(function(){ location.reload(); }, 350);
    }).catch(function(err){
      fail();
      msg('lgm', 'Connection failure: ' + (err.message || 'Cannot reach Supabase auth service.'));
    });
    return;
  }

  msg('lgm', 'Supabase backend client is unavailable.');
}

// ===== 4. REGISTRATION =====
function register(){
  var u=$('rgu').value.trim(),p=$('rgp').value,q=$('rgq').value;
  if(!u.includes('@')){msg('rgm','Enter a valid email address.');return}
  if(p.length < 8){msg('rgm','Use at least 8 characters.');return}
  if(p!==q){msg('rgm','Passwords do not match.');return}

  if(window.sb && window.sb.auth){
    msg('rgm','Registering account with Supabase…');
    var email = u;
    window.sb.auth.signUp({
      email: email,
      password: p,
      options: {
        data: { username: u.split('@')[0] },
        emailRedirectTo: window.location.origin
      }
    }).then(function(res){
      if(res.error){ msg('rgm', res.error.message); return; }
      $('rgp').value='';
      $('rgq').value='';
      if(res.data && res.data.session){
        msg('rgm', 'Account created. Opening your workspace…', true);
        setTimeout(function(){ location.reload(); }, 500);
      } else {
        $('lgu').value = email;
        msg('rgm', 'Check your email for a confirmation link. After confirming, sign in with your email and password.', true);
      }
    }).catch(function(err){ msg('rgm', err.message); });
  }
}

async function logout(){
  try{window.TC_LOG&&window.TC_LOG('Signed out')}catch(e){}
  clearTimeout(cloudTimer);
  try{await window.TCDR_SUPABASE.saveState()}catch(e){alert('Cloud save failed: '+e.message+'. Export a backup before signing out.');return}
  if(window.sb && window.sb.auth){
    window.sb.auth.signOut().finally(function(){
      try{sessionStorage.removeItem(SK)}catch(e){}
      location.reload();
    });
    return;
  }
  try{sessionStorage.removeItem(SK)}catch(e){}
  location.reload();
}

// ===== 5. UI DECORATION & ROLE-BASED ACCESS CONTROL =====
function decorate(){
  var s=sess();if(!s)return;
  var hd=document.querySelector('header');if(!hd||hd.querySelector('.ubadge'))return;
  var rows=hd.querySelectorAll('.row'),row=rows[rows.length-1]||hd;

  // Offline banner warning
  if(s.offline){
    if(!$('off-warn')){
      var warn = document.createElement('div');
      warn.id = 'off-warn';
      warn.style.background = '#ffb400';
      warn.style.color = '#000';
      warn.style.padding = '6px 14px';
      warn.style.fontSize = '12px';
      warn.style.fontWeight = '700';
      warn.style.textAlign = 'center';
      warn.style.letterSpacing = '0.5px';
      warn.textContent = '⚠️ OFFLINE LOCAL REVIEW MODE — Unauthenticated local session. Changes will not sync to cloud or audit ledger.';
      document.body.prepend(warn);
    }
  }

  // User badge
  var b=document.createElement('span');b.className='ubadge';
  b.appendChild(document.createTextNode(s.u+' · '));
  var rb=document.createElement('b');rb.textContent=s.role;b.appendChild(rb);
  row.appendChild(b);

  // Cloud/Offline status badge
  var statusBadge=document.createElement('span');statusBadge.className='tag';
  if(s.sb && s.token){
    statusBadge.style.background='rgba(25, 211, 162, 0.12)';
    statusBadge.style.borderColor='#19d3a2';
    statusBadge.style.color='#19d3a2';
    statusBadge.style.fontWeight='600';
    statusBadge.innerHTML='☁️ Supabase Connected';
    statusBadge.title='Supabase backend: ' + window.SUPABASE_URL;
  } else {
    statusBadge.style.background='rgba(255, 180, 0, 0.12)';
    statusBadge.style.borderColor='#ffb400';
    statusBadge.style.color='#ffb400';
    statusBadge.style.fontWeight='600';
    statusBadge.innerHTML='⚠️ Offline Local Mode';
  }
  row.appendChild(statusBadge);

  if(s.role==='superadmin'){
    var ub=document.createElement('button');ub.className='btn g';ub.textContent='Super Admin';ub.onclick=openUsers;row.appendChild(ub);
  }
  var lo=document.createElement('button');lo.className='btn g';lo.textContent='Log out';lo.onclick=logout;row.appendChild(lo);

  // Viewer read-only security locks
  if(s.role==='viewer'){
    ['sample','file','qgo','rd','ca'].forEach(function(id){var e=$(id);if(e)e.classList.add('ro-lock')});
    var f=document.querySelector('label.btn input#file');if(f&&f.parentNode)f.parentNode.classList.add('ro-lock');
  }
}

// ===== 6. SUPERADMIN USER MANAGEMENT VIA SECURE BACKEND API =====
function um(t,good){var e=$('um-m');if(e){e.textContent=t||'';e.style.color=good?'#2fd9a0':''}}
async function adminRequest(action, fields){
  var result = await window.sb.functions.invoke('admin-users', { body:Object.assign({ action:action }, fields || {}) });
  if(result.error) throw new Error((result.data && result.data.error) || result.error.message || 'Admin request failed');
  return result.data || {};
}

async function drawUsers(){
  var tb=$('ut'),me=(sess()||{}).u;if(!tb)return;tb.innerHTML='<tr><td colspan="3">Loading verified users from backend…</td></tr>';
  const s = sess();
  if(!s || s.role !== 'superadmin'){ tb.innerHTML='<tr><td colspan="3">Unauthorized</td></tr>'; return; }

  try {
    const data = await adminRequest('list');
    const userList = data.users || [];
    tb.innerHTML = '';

    userList.forEach(function(r){
      var tr=document.createElement('tr'),a=document.createElement('td'),b=document.createElement('td'),c=document.createElement('td');
      a.textContent=r.email + (r.username ? ` (${r.username})` : '') + (r.is_active===false?' [DISABLED]':'') + (r.email===me||r.username===me?' (you)':'');
      b.textContent=r.role;

      if(r.email!==me && r.username!==me){
        var sel=document.createElement('select');sel.className='sr';
        ['analyst','viewer','superadmin'].forEach(function(o){
          var p=document.createElement('option');p.value=o;p.textContent=o;
          if(o===r.role)p.selected=true;
          sel.appendChild(p);
        });
        sel.onchange=async function(){
          try {
            await adminRequest('role', { userId:r.id, role:sel.value });
            um(`Role of ${r.email} updated to ${sel.value}.`, true);
          } catch(e){um('Failed to update role: '+e.message);}
        };

        var d=document.createElement('button');d.className='btn g';d.textContent='Delete';
        d.onclick=async function(){
          if(!confirm('Permanently delete user '+r.email+'?'))return;
          try {
            await adminRequest('delete', { userId:r.id });
            um('User deleted successfully.', true);
            drawUsers();
          } catch(e){um('Could not delete user: '+e.message);}
        };

        c.appendChild(sel);c.appendChild(d);
      }
      tr.appendChild(a);tr.appendChild(b);tr.appendChild(c);tb.appendChild(tr);
    });
  } catch(err){
    tb.innerHTML = `<tr><td colspan="3" class="note">Backend error: ${err.message}</td></tr>`;
  }
}

function openUsers(){
  var s=sess();if(!s||s.role!=='superadmin')return;
  drawUsers();um('');$('um').classList.add('on');
}

async function addUser(){
  var s=sess();if(!s||s.role!=='superadmin')return;
  var u=$('nu').value.trim(),p=$('np').value,r=$('nr').value;
  if(!u.includes('@')){um('Enter a real email address for the new user.');return}
  if(p.length < 8){um('Password needs at least 8 characters.');return}

  var email = u;
  um('Provisioning user on backend…');

  try {
    await adminRequest('create', { email:email, password:p, username:u.split('@')[0], role:r });
    um(`User ${email} created successfully with role '${r}'. Admin session preserved.`, true);
    $('nu').value='';$('np').value='';
    drawUsers();
  } catch(err){
    um('Backend error: ' + err.message);
  }
}

// Wire buttons
$('lgb').onclick=signIn;
$('lgp').onkeydown=function(e){if(e.key==='Enter')signIn()};$('lgu').onkeydown=function(e){if(e.key==='Enter')$('lgp').focus()};
$('lgs').onclick=function(){var p=$('lgp'),sh=p.type==='password';p.type=sh?'text':'password';this.textContent=sh?'HIDE':'SHOW'};

function showReg(on){$('lg1').style.display=on?'none':'block';$('lg3').style.display=on?'block':'none';msg('rgm','');msg('lgm','');if(on)$('rgu').focus();else $('lgu').focus()}
$('lgr').onclick=function(){showReg(true)};$('rgx').onclick=function(){showReg(false)};$('rgb').onclick=register;
$('rgq').onkeydown=function(e){if(e.key==='Enter')register()};
$('rgs').onclick=function(){var p=$('rgp'),sh=p.type==='password';p.type=sh?'text':'password';this.textContent=sh?'HIDE':'SHOW'};
var ua_btn=$('ua');if(ua_btn)ua_btn.onclick=addUser;
var uc_btn=$('uc');if(uc_btn)uc_btn.onclick=function(){$('um').classList.remove('on')};

try{if(sess()&&sessionStorage.getItem('tcdr_intro')==='1'){sessionStorage.removeItem('tcdr_intro')}else{window._chk=null;var _k=$('iskip');if(_k)_k.click()}}catch(e){}
var lu=rd('tcdr_lastu','');if(lu&&$('lgu'))$('lgu').value=lu;

// A browser-stored role is display state only. Verify the live token on every page load.
configReady.then(function(){ return window.sb.auth.getSession(); }).then(async function(res){
    if(res.data && res.data.session && res.data.session.user){
      var token = res.data.session.access_token;
      let identity;
      try {
        identity = await verifiedIdentity(token);
      } catch(e){
        await window.sb.auth.signOut();
        try{sessionStorage.removeItem(SK)}catch(x){}
        document.documentElement.style.overflow='hidden';
        msg('lgm','Saved session could not be verified by Supabase. Sign in again.');
        return;
      }

      var sessObj = { u: identity.username, role: identity.role, email: identity.email, id: identity.id, token: token, sb: true, offline: false };
      sessionStorage.setItem(SK, JSON.stringify(sessObj));
      await window.TCDR_SUPABASE.syncCases();
      open();decorate();
    } else {
      document.documentElement.style.overflow='hidden';
      setTimeout(function(){($('lgu').value?$('lgp'):$('lgu')).focus()},50);
    }
  }).catch(function(e){
    try{sessionStorage.removeItem(SK)}catch(e){}
    document.documentElement.style.overflow='hidden';
    msg('lgm', e.message || 'Could not load the cloud workspace.');
    setTimeout(function(){($('lgu').value?$('lgp'):$('lgu')).focus()},50);
  });

// Every edit path calls tcPersist, including the import wizard and Data Studio.
// Save the complete workspace after local persistence, and surface cloud errors.
var localPersist = tcPersist, cloudTimer = null;
tcPersist = function(){
  var result = localPersist.apply(this, arguments), s = sess();
  if(s && s.sb && s.role !== 'viewer'){
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function(){
      window.TCDR_SUPABASE.saveState().catch(function(e){
        window._cloudSaveError = e.message;
        console.error('Cloud save failed:', e);
        alert('Cloud save failed: ' + e.message + '. Export a local backup before closing this tab.');
      });
    }, 700);
  }
  return result;
};

window.TCDR_AUTH={logout:logout};
})();
