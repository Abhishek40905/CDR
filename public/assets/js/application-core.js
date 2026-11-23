const COLS=['a','b','date','time','dur','type','imei','imsi','cell','addr','lat','lon'];
const LBL={a:'A-Party',b:'B-Party',date:'Date',time:'Time',dur:'Dur (s)',type:'Type',imei:'IMEI',imsi:'IMSI',cell:'Cell ID',addr:'Tower address',lat:'Lat',lon:'Long'};
const VIEWS=[['I · Acquisition', 'cases', 'Case Registry', 'Consolidated registry of matters, subjects of interest and evidentiary datasets.'], ['I · Acquisition', 'records', 'Record Ledger', 'Chronological call-detail ledger with column-level predicates and sortable evidence fields.'], ['I · Acquisition', 'search', 'Query Console', 'Compose compound predicates across subscriber, device, temporal and spatial dimensions.'], ['I · Acquisition', 'live', 'Live Ingestion Stream', 'Continuous record intake with automated adjudication of device, tower and velocity anomalies.'], ['I · Acquisition', 'rec', 'Call-Recording Analysis', 'Analyse an audio file offline, match it to a CDR call and scan a transcript for risk terms.'], ['II · Correlation', 'common', 'Common-Subscriber Convergence', 'Isolate subscribers that converge across two or more targets within the dataset.'], ['II · Correlation', 'conf', 'Conference Detection', 'Detect temporally overlapping sessions indicative of multi-party conferencing.'], ['II · Correlation', 'follow', 'Follow-on Sequencing', 'Sequence outbound activity that follows a trigger call within a defined latency window.'], ['II · Correlation', 'similar', 'Similarity & Pattern Recognition', 'Rank records by behavioural likeness to a reference, surface recurring patterns, and expose look-alike numbers and handsets.'], ['II · Correlation', 'exact', 'Exact-Call Reconciliation', 'Reconcile a specific call event against subscriber, instant and duration.'], ['II · Correlation', 'sim', 'IMEI–SIM Association', 'Correlate handsets with the SIM identities observed on them, and the reverse.'], ['II · Correlation', 'imsi', 'IMSI Spoof & Clone Check', 'Flag IMSIs on several handsets at impossible speed, and IMSIs shared across numbers.'], ['II · Correlation', 'group', 'Segmented Partitioning', 'Partition the corpus by subscriber, tower or period into discrete working sets.'], ['III · Visualisation', 'tower', 'Tower Dump & RTT', 'List every number seen on chosen towers in a time window, intersect dumps, and size an RTT / timing-advance ring.'], ['III · Visualisation', 'map', 'Geospatial Tower Tracking', 'Reconstruct subject movement and tower dwell across a geospatial timeline.'], ['III · Visualisation', 'cell', 'Cell-Site Profiling', 'Profile cell-site utilisation by volume, dwell and hour of activity.'], ['III · Visualisation', 'graph', 'Relationship Topology', 'Render the ego-network of a target with first-order contacts and inter-contact linkage.']];
let rows=[],view='records',shown=[],sortK=null,sortD=1,colF={},esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sanitizeCsvCell=v=>{if(v===null||v===undefined)return'""';let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return'"'+s.replace(/"/g,'""')+'"'};
const $=id=>document.getElementById(id);
const ts=r=>Date.parse(r.date+'T'+(r.time||'00:00:00'));
const CITY=[['delhi|dwarka|connaught|karol bagh|lajpat','Delhi','India',28.61,77.21],['gurugram|gurgaon','Haryana','India',28.46,77.03],['faridabad','Haryana','India',28.41,77.31],['chandigarh','Chandigarh','India',30.73,76.78],['noida|ghaziabad','Uttar Pradesh','India',28.54,77.39],['lucknow','Uttar Pradesh','India',26.85,80.95],['kanpur','Uttar Pradesh','India',26.45,80.33],['jaipur','Rajasthan','India',26.91,75.79],['ahmedabad','Gujarat','India',23.02,72.57],['surat','Gujarat','India',21.17,72.83],['mumbai|thane|andheri|bkc','Maharashtra','India',19.08,72.88],['pune','Maharashtra','India',18.52,73.86],['bengaluru|bangalore','Karnataka','India',12.97,77.59],['hyderabad','Telangana','India',17.39,78.49],['chennai','Tamil Nadu','India',13.08,80.27],['kolkata','West Bengal','India',22.57,88.36],['patna','Bihar','India',25.59,85.14],['bhopal','Madhya Pradesh','India',23.26,77.41],['indore','Madhya Pradesh','India',22.72,75.86],['dubai','Dubai','UAE',25.2,55.27],['abu dhabi','Abu Dhabi','UAE',24.45,54.38],['kathmandu','Bagmati','Nepal',27.72,85.32],['birgunj|birganj|janakpur|biratnagar|bhairahawa','Madhesh','Nepal',27.01,84.88],['dhaka','Dhaka','Bangladesh',23.81,90.41],['singapore','Singapore','Singapore',1.35,103.82],['bangkok','Bangkok','Thailand',13.76,100.5],['london','England','UK',51.51,-0.13],['karachi','Sindh','Pakistan',24.86,67.0],['colombo','Western','Sri Lanka',6.93,79.86]];
const RC={};
const RULES_DEF={w:{hs:18,sim:14,st:12,co:20,night:10,ct:12,sus:30,fan:25,pass:20},fanMin:15,fanDur:60,nightFrom:23,nightTo:5,ctMin:8,nightShare:20,high:60,mid:30,simCut:50,simMax:25,fusion:'synergy',synMax:10,blendW:30,speed:120,coloc:30,custom:[]};
const RULES=(()=>{let o={};try{o=JSON.parse(localStorage.getItem('tcdr_rules')||'{}')}catch(e){}return Object.assign({},RULES_DEF,o,{w:Object.assign({},RULES_DEF.w,o.w||{}),custom:Array.isArray(o.custom)?o.custom:[]})})();
const isNight=h=>RULES.nightFrom>RULES.nightTo?(h>=RULES.nightFrom||h<RULES.nightTo):(h>=RULES.nightFrom&&h<RULES.nightTo);
const applyPlaces=()=>{for(let i=CITY.length-1;i>=0;i--)if(CITY[i].custom)CITY.splice(i,1);RULES.custom.slice().reverse().forEach(c=>{const x=[c.k,c.st,c.co,+c.lat,+c.lon];x.custom=1;CITY.unshift(x)});Object.keys(RC).forEach(k=>delete RC[k])};applyPlaces();
function reg(p){const k=p.cell+'|'+p.lat+'|'+p.lon;if(RC[k])return RC[k];
  if(p.state||p.country){let co=p.country;if(!co){const t=((p.state||'')+' '+(p.addr||'')).toLowerCase(),m=t.match(/nepal|bangladesh|pakistan|bhutan|sri lanka|myanmar|china|uae|dubai|thailand|singapore/);co=m?m[0].replace(/\b\w/g,x=>x.toUpperCase()):'India'}return RC[k]={st:p.state||'?',co}}
  const a=String(p.addr||'').toLowerCase();let c=CITY.find(x=>new RegExp(x[0]).test(a));
  if(!c){let d=150;CITY.forEach(x=>{const m=hav({lat:+p.lat,lon:+p.lon},{lat:x[3],lon:x[4]});if(m<d){d=m;c=x}})}
  return RC[k]=c?{st:c[1],co:c[2]}:{st:'?',co:(+p.lat>6&&+p.lat<37&&+p.lon>68&&+p.lon<98)?'India':'Abroad'}}
const seg=(a,b)=>{const x=reg(a),y=reg(b);return x.co!=y.co?2:(x.st!='?'&&y.st!='?'&&x.st!=y.st?1:0)};
const regName=x=>x.st=='?'?x.co:x.st+(x.co!='India'?' ('+x.co+')':'');
function trk(c){const L=c.rows.filter(r=>r.a==c.suspect&&isFinite(parseFloat(r.lat))&&isFinite(parseFloat(r.lon))).map(r=>({...r,lat:+r.lat,lon:+r.lon,t:ts(r)})).sort((x,y)=>x.t-y.t).filter((p,i,A)=>i==0||p.cell!=A[i-1].cell);
  let st=0,co=0;const ch=[];L.forEach((p,i)=>{const g=i?seg(L[i-1],p):0;if(g==1)st++;if(g==2)co++;const n=regName(reg(p));if(ch[ch.length-1]!=n)ch.push(n)});return{L,st,co,ch}}
let CASES=[],CUR=null,fseq=0;
const cur=()=>CASES.find(c=>c.id==CUR);
const CHG=['BNS 318(4) – Cheating','BNS 319 – Cheating by personation','BNS 61 – Criminal conspiracy','BNS 308 – Extortion','BNS 351 – Criminal intimidation','BNS 111 – Organised crime','IT Act 66C – Identity theft','IT Act 66D – Cheating by personation (computer resource)','PMLA 3 – Money laundering','NDPS Act – Narcotics'];
function newCase(o){
  const uuid = (o && o.id && (o.id.includes('-') || o.id.length > 10)) ? o.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'case-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));
  const c = {
    id: uuid,
    fir: (o && o.fir) ? o.fir : ('FIR/2026/' + String(++fseq).padStart(3, '0')),
    title: (o && o.title) || 'Untitled Matter',
    suspect: (o && o.suspect) || '',
    status: (o && o.status) || 'Open',
    charges: (o && o.charges) || [],
    parent: (o && o.parent) || null,
    rows: (o && o.rows) || [],
    filed: (o && o.filed) || new Date().toISOString().slice(0, 10)
  };
  CASES.push(c);
  return c;
}
function setCase(id,v){const c=CASES.find(x=>x.id==id);if(!c)return;CUR=id;rows=c.rows;colF={};sortK=null;$('cs').innerHTML=CASES.map(x=>`<option value="${x.id}" ${x.id==id?'selected':''}>${esc(x.fir)} · ${esc(x.title.slice(0,26))}</option>`).join('');$('src').textContent=c.fir+' · '+c.title;stats();go(v||view)}
const TW={cp:['40-10-2231-5501','Connaught Pl, New Delhi',28.6315,77.2167],kb:['40-10-2231-5502','Karol Bagh, New Delhi',28.6519,77.1909],jp:['40-141-7710-2201','MI Road, Jaipur',26.9124,75.7873],ah:['40-441-3320-8802','CG Road, Ahmedabad',23.03,72.56],mb:['40-22-9910-3305','Andheri East, Mumbai',19.1136,72.8697],bk:['40-22-9910-3318','BKC, Mumbai',19.0653,72.8672],db:['424-02-5521-9004','Deira, Dubai',25.2711,55.3075],dm:['424-02-5521-9021','Dubai Marina, Dubai',25.0805,55.1403]};
function route(sus,imei,imsi,pool,stops,seed){let s=seed;const R=()=>(s=(s*16807)%2147483647)/2147483647,out=[],p2=x=>String(x).padStart(2,'0');
  stops.forEach(([tw,d,hm])=>{const [h,m]=hm.split(':').map(Number);for(let k=0;k<3;k++){const mm=m+k*6;out.push({a:sus,b:pool[Math.floor(R()*pool.length)],date:d,time:p2(h+Math.floor(mm/60))+':'+p2(mm%60)+':'+p2(Math.floor(R()*60)),dur:Math.floor(30+R()*400),type:R()<.8?'Voice':'SMS',imei,imsi,cell:tw[0],addr:tw[1],lat:tw[2],lon:tw[3]})}});
  const f=stops[0];pool.forEach((n,i)=>out.push({a:n,b:sus,date:f[1],time:'1'+(i%10)+':30:00',dur:60+i*20,type:'Voice',imei:'35'+(seed*1000+i),imsi:'4041'+(seed*100+i),cell:f[0][0],addr:f[0][1],lat:f[0][2],lon:f[0][3]}));
  return out.sort((x,y)=>ts(x)-ts(y))}
function initCases(){CASES=[];fseq=0;const S2='9899000002',pl=(p,n)=>Array.from({length:n},(_,i)=>p+String(10+i));
  const c1=newCase({title:'Impersonation fraud ring – NCR',suspect:'9810000001',status:'Under investigation',charges:['BNS 319 – Cheating by personation','IT Act 66D – Cheating by personation (computer resource)'],rows:sample(),filed:'2026-11-02'});
  const c2=newCase({title:'Loan-app extortion – interstate',suspect:S2,status:'Under investigation',charges:['BNS 308 – Extortion','BNS 351 – Criminal intimidation','IT Act 66D – Cheating by personation (computer resource)'],filed:'2026-11-06',
    rows:route(S2,'356120094417285','404100000000222',pl('9877000',8),[[TW.cp,'2026-11-05','09:10'],[TW.kb,'2026-11-05','11:30'],[TW.jp,'2026-11-05','18:40'],[TW.ah,'2026-11-06','08:15'],[TW.mb,'2026-11-06','16:00'],[TW.bk,'2026-11-06','21:20']],11)});
  newCase({title:'Hawala layering – cross-border (additional charges, linked to '+c2.fir+')',suspect:S2,status:'Open',charges:['BNS 111 – Organised crime','PMLA 3 – Money laundering'],parent:c2.id,filed:'2026-11-11',
    rows:route(S2,'356120094417285','404100000000222',pl('9866000',8),[[TW.mb,'2026-11-09','06:30'],[TW.bk,'2026-11-09','09:00'],[TW.db,'2026-11-09','14:20'],[TW.dm,'2026-11-09','19:05'],[TW.db,'2026-11-10','10:30'],[TW.cp,'2026-11-11','08:40]'.slice(0,5)]],23)});
  $('cs').onchange=()=>setCase($('cs').value);setCase(c1.id,'cases')}

function sample(){
  let s=7;const R=()=>(s=(s*16807)%2147483647)/2147483647,pick=a=>a[Math.floor(R()*a.length)];
  const T1='9810000001',T2='9810000099',pool=Array.from({length:14},(_,i)=>'98100001'+String(10+i).padStart(2,'0'));
  const tw=[['40-10-2231-5501','Connaught Pl, New Delhi',28.6315,77.2167],['40-10-2231-5502','Karol Bagh, New Delhi',28.6519,77.1909],['40-10-2231-5503','Lajpat Nagar, New Delhi',28.5677,77.2433],['40-10-2231-5504','Noida Sec 18',28.5706,77.3219],['40-10-2231-5505','Gurugram Cyber Hub',28.4950,77.0890],['40-10-2231-5506','Dwarka Sec 10',28.5823,77.0500]];
  const dev={[T1]:['356938035643809','404100000000011'],[T2]:['352099001761481','404100000000022']};
  const out=[];const add=(a,b,d,h,m,du,t,w)=>{const dv=dev[a]||['35'+Math.floor(R()*1e13),'4041'+Math.floor(R()*1e11)];const k=tw[w];out.push({a,b,date:'2026-11-0'+d,time:[h,m,Math.floor(R()*60)].map(x=>String(x).padStart(2,'0')).join(':'),dur:du,type:t,imei:dv[0],imsi:dv[1],cell:k[0],addr:k[1],lat:k[2],lon:k[3]})};
  for(let i=0;i<300;i++){const a=R()<.6?T1:R()<.6?T2:pick(pool);let b=a==T1||a==T2?(R()<.25&&a==T2?pick(pool.slice(0,4)):pick(pool)):(R()<.5?T1:T2);const h=Math.floor(R()*24);add(a,b,1+Math.floor(R()*5),h,Math.floor(R()*60),Math.floor(R()*600),R()<.8?'Voice':'SMS',Math.floor(R()*6)*(h>8&&h<20?1:0)%6)}
  for(let k=0;k<3;k++)add(T1,pool[k],3,14,5,120,'Voice',1);
  add(T1,pool[5],4,22,10,20,'Voice',3);add(T1,pool[5],4,22,16,200,'Voice',3);add(T1,pool[5],4,22,21,45,'Voice',3);
  out.push({...out[0],imei:'356938035643809',imsi:'404100000000099'});
  return out.sort((x,y)=>ts(x)-ts(y));
}
function parseCSV(t){
  const L=t.split(/\r?\n/).filter(x=>x.trim()),sp=l=>{const o=[];let c='',q=0;for(const ch of l){if(ch=='"')q=!q;else if(ch==','&&!q){o.push(c);c=''}else c+=ch}o.push(c);return o.map(x=>x.trim())};
  const h=sp(L[0]).map(x=>x.toLowerCase()),rx={a:/a.?party|calling|msisdn|^a$/,b:/b.?party|called|^b$/,date:/date/,time:/time/,dur:/dur/,type:/type/,imei:/imei/,imsi:/imsi/,cell:/cell/,addr:/addr|location/,lat:/lat/,lon:/lon/,state:/state|circle/,country:/country/};
  const ix={};for(const k in rx){ix[k]=h.findIndex((x,i)=>rx[k].test(x)&&!Object.values(ix).includes(i))}
  return L.slice(1).map(l=>{const c=sp(l),r={};for(const k of COLS.concat(['state','country']))r[k]=ix[k]>=0?c[ix[k]]:'';return r}).filter(r=>r.a||r.b);
}
function stats(){
  const nums=new Set(),im=new Set(),tw=new Set(),d=rows.map(r=>r.date).filter(Boolean).sort();
  rows.forEach(r=>{nums.add(r.a);nums.add(r.b);im.add(r.imei);tw.add(r.cell)});
  const cnt={};rows.forEach(r=>cnt[r.a]=(cnt[r.a]||0)+1);const tp=Object.entries(cnt).sort((x,y)=>y[1]-x[1])[0]||['–',0];const c=[[rows.length,'Records','▤'],[nums.size,'Unique numbers','☎'],[im.size,'IMEIs','▣'],[tw.size,'Towers','⌖'],[tp[0],'Most active · '+tp[1]+' calls','◎'],[alerts.length,'Live alerts','⚠'],[d.length?d[0]+' → '+d[d.length-1]:'–','Date range']];
  const first=!window._cd;window._cd=1;
  $('cards').innerHTML=c.map(x=>{const nm=typeof x[0]=='number';return `<div class="card"><i>${x[2]||'◷'}</i><div><b ${nm?'data-n="'+x[0]+'"':''}>${first&&nm?0:esc(x[0])}</b><span>${x[1]}</span></div></div>`}).join('');
  if(first)document.querySelectorAll('#cards b[data-n]').forEach(e=>{const n=+e.dataset.n,t0=performance.now();(function f(t){const p=Math.min(1,(t-t0)/700);e.textContent=Math.round(n*p);if(p<1)requestAnimationFrame(f)})(t0)});
}
function table(data,hl,withFilter){
  shown=data;
  const head='<tr>'+COLS.map(k=>`<th data-k="${k}">${LBL[k]}${sortK==k?(sortD>0?' ▲':' ▼'):''}</th>`).join('')+'</tr>';
  const fl=withFilter?'<tr class="f">'+COLS.map(k=>`<th><input data-f="${k}" value="${esc(colF[k]||'')}" placeholder="filter"></th>`).join('')+'</tr>':'';
  const body=data.slice(0,300).map((r,i)=>`<tr class="${hl&&hl.has(r)?'hl':''}">`+COLS.map(k=>`<td>${esc(r[k])}</td>`).join('')+'</tr>').join('');
  return `<div class="tw"><table><thead>${head}${fl}</thead><tbody>${body}</tbody></table></div><p class="note">${data.length} record(s)${data.length>300?' – showing first 300 (export for all)':''}</p>`;
}
function bindTable(redraw){
  document.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{const k=th.dataset.k;sortD=sortK==k?-sortD:1;sortK=k;rows.sort((x,y)=>String(x[k]).localeCompare(String(y[k]),undefined,{numeric:true})*sortD);redraw()});
  document.querySelectorAll('input[data-f]').forEach(i=>i.oninput=()=>{colF[i.dataset.f]=i.value;const pos=i.dataset.f;redraw();const n=document.querySelector(`input[data-f="${pos}"]`);if(n){n.focus();n.setSelectionRange(99,99)}});
}
const uniq=a=>[...new Set(a)];
const numOpts=()=>uniq(rows.flatMap(r=>[r.a,r.b])).sort().map(n=>`<option>${n}</option>`).join('');
const head=(t,s)=>`<h2>${t}</h2><p class="sub">${s}</p>`;

const V={

rec(){
  $('main').innerHTML=head('Call-recording analysis','Multi-factor match: measures audio duration, compares against target subscriber number, and evaluates timestamp proximity. Scans transcripts for risk terms.')+
  `<div class="row" style="flex-wrap:wrap;gap:8px">
    <label class="btn" style="cursor:pointer">Select Audio File<input type="file" id="af" accept="audio/*" hidden></label>
    <input type="text" id="atgt" placeholder="Target Number (optional)" style="width:160px">
    <input type="text" id="adate" placeholder="Approx Date (YYYY-MM-DD)" style="width:160px">
  </div>
  <div id="ar"></div>
  <p class="note" style="margin-top:14px">Paste transcript (optional)</p>
  <textarea id="tx" rows="4" style="width:100%"></textarea>
  <div class="row"><button class="btn" id="tg2">Scan transcript</button></div>
  <div id="tr"></div>`;

  const TERMS={Money:/\b(cash|hawala|transfer|account|upi|payment|lakh|crore)\b/i,Threat:/\b(kill|threat|hurt|police|expose|leak)\b/i,Credential:/\b(otp|pin|password|cvv|aadhaar)\b/i,Evasion:/\b(new sim|change number|delete|burner|don't call)\b/i};

  $('af').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    $('ar').innerHTML='<p class="note">Decoding audio file in browser\u2026</p>';
    try{
      const ac=new (window.AudioContext||window.webkitAudioContext)(),b=await ac.decodeAudioData(await f.arrayBuffer()),d=b.getChannelData(0);
      let sq=0,pk=0,sil=0;for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);sq+=v*v;if(v>pk)pk=v;if(v<.01)sil++}
      const dur=Math.round(b.duration),rms=Math.sqrt(sq/d.length);
      const tgtNum=($('atgt').value||'').trim().replace(/[^\d]/g,'');
      const approxDate=($('adate').value||'').trim();

      const candidates=[];
      rows.forEach(r=>{
        const cdur=+r.dur||0;
        const durDiff=Math.abs(cdur-dur);
        if(durDiff>10) return;
        let score=0;
        const reasons=[];
        const durScore=Math.max(0,40-durDiff*4);
        score+=durScore;
        reasons.push('Duration delta: '+durDiff.toFixed(1)+'s (+'+Math.round(durScore)+' pts)');
        if(tgtNum){
          const ca=String(r.a||'').replace(/[^\d]/g,''),cb=String(r.b||'').replace(/[^\d]/g,'');
          if(ca.includes(tgtNum)||cb.includes(tgtNum)){
            score+=35;
            reasons.push('Target subscriber matched (+35 pts)');
          }
        }
        if(approxDate && r.date===approxDate){
          score+=25;
          reasons.push('Date matched (+25 pts)');
        }
        candidates.push({r,durDiff,score:Math.min(100,Math.round(score)),reasons});
      });
      candidates.sort((x,y)=>y.score-x.score);

      let html=`<div class="tw"><table><tbody>
        <tr><td>File</td><td>${esc(f.name)}</td></tr>
        <tr><td>Decoded Duration</td><td>${dur} s</td></tr>
        <tr><td>Silence Ratio</td><td>${Math.round(sil/d.length*100)}%</td></tr>
        <tr><td>Peak / RMS Level</td><td>${pk.toFixed(2)} / ${rms.toFixed(3)}</td></tr>
      </tbody></table></div>`;

      if(candidates.length){
        html+=`<h3 style="margin-top:14px">Multi-Factor CDR Matches (${candidates.length})</h3>
        <p class="note">Filtered to CDR events within \u00b110s duration, scored by duration precision, target subscriber, and date proximity.</p>
        <div class="tw"><table><thead><tr><th>Score</th><th>A-Party</th><th>B-Party</th><th>Date / Time</th><th>Duration</th><th>Evidence Scoring Factors</th></tr></thead><tbody>
        ${candidates.slice(0,20).map(c=>`<tr>
          <td><span class="tag" style="background:${c.score>=70?'rgba(25,211,162,0.15)':'rgba(255,180,0,0.15)'};color:${c.score>=70?'#19d3a2':'#ffb400'}">${c.score}%</span></td>
          <td>${esc(c.r.a)}</td><td>${esc(c.r.b)}</td><td>${esc(c.r.date)} ${esc(c.r.time)}</td><td>${esc(c.r.dur)}s</td>
          <td style="font-size:11px">${esc(c.reasons.join(' \u00b7 '))}</td>
        </tr>`).join('')}</tbody></table></div>`;
      } else {
        html+=`<p class="note" style="margin-top:10px">No CDR records found matching audio duration within \u00b110 seconds.</p>`;
      }
      $('ar').innerHTML=html;
    }catch(x){$('ar').innerHTML='<p class="note">Could not decode this audio file: '+esc(x.message)+'</p>'}
  };

  $('tg2').onclick=()=>{
    const t=$('tx').value,h=Object.entries(TERMS).map(([k,r])=>[k,(t.match(new RegExp(r.source,'gi'))||[])]).filter(x=>x[1].length);
    $('tr').innerHTML=h.length?h.map(([k,v])=>`<span class="tag">${k}: ${esc([...new Set(v.map(z=>z.toLowerCase()))].join(', '))}</span>`).join(' '):'<p class="note">No risk terms found.</p>';
  };
},
imsi(){
  const by={};rows.forEach(r=>{if(r.imsi)(by[r.imsi]=by[r.imsi]||[]).push(r)});
  const out=[];
  const TOWER_UNCERTAINTY_KM=2.0;
  Object.entries(by).forEach(([k,L])=>{
    L=L.filter(r=>isFinite(parseFloat(r.lat))&&isFinite(parseFloat(r.lon))).sort((x,y)=>ts(x)-ts(y));
    for(let i=1;i<L.length;i++){
      const p=L[i-1],q=L[i];
      if(p.imei&&q.imei&&p.imei!=q.imei){
        const rawKm=hav({lat:+p.lat,lon:+p.lon},{lat:+q.lat,lon:+q.lon});
        const effKm=Math.max(0,rawKm-(TOWER_UNCERTAINTY_KM*2));
        const deltaMs=Math.abs(ts(q)-ts(p));
        const deltaHours=deltaMs/36e5;
        if(effKm>5.0){
          const effSpeed=deltaHours>0?(effKm/deltaHours):Infinity;
          if(effSpeed>RULES.speed||deltaHours<(1/120)){
            out.push({
              k,p,q,
              rawKm:Math.round(rawKm*10)/10,
              effKm:Math.round(effKm*10)/10,
              v:isFinite(effSpeed)?Math.round(effSpeed):'>20,000',
              conf:effKm>50?'HIGH (CLONE SUSPECT)':'MEDIUM (RAPID HANDOVER / PROXIMATE)',
              gapSec:Math.round(deltaMs/1000)
            });
          }
        }
      }
    }
  });
  const nums={},ow=owners('imsi',.4);Object.entries(ow).forEach(([k,v])=>{nums[k]=new Set(v)});const sh=Object.entries(nums).filter(x=>x[1].size>1);
  $('main').innerHTML=head('IMSI Spoof & Clone Verification','Accounts for cell-tower coverage uncertainty (\u00b12 km). Flags same IMSI active across different handsets with physically impossible effective travel velocity (>'+RULES.speed+' km/h).')+
  (out.length?`<div class="tw"><table><thead><tr><th>IMSI</th><th>Handset 1 (IMEI)</th><th>Handset 2 (IMEI)</th><th>Raw / Eff Distance</th><th>Time Gap</th><th>Implied Speed</th><th>Confidence</th></tr></thead><tbody>${out.map(o=>`<tr><td>${esc(o.k)}</td><td>${esc(o.p.imei)}</td><td>${esc(o.q.imei)}</td><td>${o.rawKm} / ${o.effKm} km</td><td>${o.gapSec}s</td><td>${o.v} km/h</td><td><span class="tag" style="${o.conf.includes('HIGH')?'color:#ff3b6b;border-color:#ff3b6b':''}">${esc(o.conf)}</span></td></tr>`).join('')}</tbody></table></div><p class="note" style="color:var(--mut);margin-top:6px">\u26a0\ufe0f <b>INVESTIGATIVE LEAD ONLY</b>: Discrepancies may indicate SIM cloning, multi-device credential rotation, or network timestamp anomalies. Base-station cell site records reflect antenna coverage, not GPS coordinates.</p>`:'<p class="note">No impossible-speed IMSI/IMEI switches detected (accounting for tower uncertainty).</p>')+
  `<p class="note">IMSIs observed under multiple subscriber numbers: ${sh.map(x=>`<span class="tag">${esc(x[0])} (${x[1].size})</span>`).join(' ')||'none'}</p>`;
},
tower(){
  const cells=uniq(rows.map(r=>r.cell)),d0=rows.map(r=>r.date).sort()[0]||'';
  const opt=cells.map(c=>`<option>${esc(c)}</option>`).join('');
  $('main').innerHTML=head('Tower dump & RTT','Numbers seen on a tower in a window; add dump B to find numbers present at both.')+
  `<div class="row"><select id="c1">${opt}</select><select id="c2"><option value="">(no dump B)</option>${opt}</select><input id="d" type="date" value="${d0}"><input id="t1" value="00:00"><input id="t2" value="23:59"><button class="btn" id="go">Run dump</button></div><div id="sr"></div>
  <h3>RTT / timing-advance ring</h3><div class="row"><input id="ta" type="number" value="4" min="0"> <span class="note">TA units × 78 m ≈</span> <b id="rg">0.31 km</b></div>`;
  const q=(c)=>{const a=+$('t1').value.replace(':','')||0,z=+$('t2').value.replace(':','')||2359;return rows.filter(r=>r.cell==c&&r.date==$('d').value&&(+r.time.replace(/:/g,'').slice(0,4))>=a&&(+r.time.replace(/:/g,'').slice(0,4))<=z)};
  $('go').onclick=()=>{const A=q($('c1').value),sa=uniq(A.map(r=>r.a)),c2=$('c2').value;let h=`<p class="note">Dump A: ${A.length} records, ${sa.length} numbers.</p>`;
   if(c2){const B=q(c2),sb=uniq(B.map(r=>r.a)),both=sa.filter(n=>sb.includes(n));h+=`<p class="note">Dump B: ${sb.length} numbers. In both: ${both.map(n=>`<span class="tag">${esc(n)}</span>`).join(' ')||'none'}</p>`}
   $('sr').innerHTML=h+(A.length?table(A):'')};
  $('ta').oninput=()=>{$('rg').textContent=((+$('ta').value||0)*0.07812).toFixed(2)+' km'};
},
similar(){
 const mm=$('main'),S=window._sm=window._sm||{tab:0,ref:0,n:15,thr:82,w:{tod:3,dur:2,type:1,cell:2,party:3,imei:2,day:1}};
 const W={tod:'Time of day',dur:'Duration',type:'Call type',cell:'Cell tower',party:'Subscriber pair',imei:'Handset (IMEI)',day:'Date proximity'};
 if(S.ref>=rows.length)S.ref=0;
 const H=r=>{const t=String(r.time||'0:0').split(':');return(+t[0]||0)+(+t[1]||0)/60},DD=r=>Date.parse(r.date)/864e5||0;
 const sim=(r,q,w=S.w)=>{const f={},dh=Math.abs(H(r)-H(q));f.tod=1-Math.min(dh,24-dh)/12;f.dur=1-Math.min(1,Math.abs(Math.log1p(+r.dur||0)-Math.log1p(+q.dur||0))/Math.log(3601));f.type=r.type==q.type?1:0;f.cell=r.cell==q.cell?1:0;
  f.party=r.a==q.a&&r.b==q.b?1:r.a==q.b&&r.b==q.a?.8:(r.a==q.a||r.b==q.b||r.a==q.b||r.b==q.a)?.5:0;f.imei=r.imei==q.imei?1:0;f.day=1-Math.min(7,Math.abs(DD(r)-DD(q)))/7;
  let n=0,d=0;for(const k in w){n+=w[k]*f[k];d+=w[k]}return{s:d?n/d:0,f}};
 const med=a=>{const x=a.map(v=>+v||0).sort((p,q)=>p-q);return x[x.length>>1]||0},top=a=>{const c={};a.forEach(v=>c[v]=(c[v]||0)+1);return Object.entries(c).sort((p,q)=>q[1]-p[1])[0]||['–',0]};
 const hrs=m=>{let a=0,b=0;m.forEach(r=>{const h=H(r)/24*6.2832;a+=Math.sin(h);b+=Math.cos(h)});const h=Math.atan2(a,b)/6.2832*24;return(h+24)%24},hh=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)%60).padStart(2,'0');
 const mini=m=>`<div class="tw"><table><thead><tr><th>From</th><th>To</th><th>Date</th><th>Time</th><th>Dur</th><th>Type</th><th>Tower</th></tr></thead><tbody>${m.slice(0,10).map(r=>`<tr><td>${esc(r.a)}</td><td>${esc(r.b)}</td><td>${esc(r.date)}</td><td>${esc(r.time)}</td><td>${esc(r.dur)}</td><td>${esc(r.type)}</td><td>${esc(r.cell)}</td></tr>`).join('')}</tbody></table></div>`;
 const TABS=['Query by record','Behaviour patterns','Look-alike identifiers','Vector search'];
 mm.innerHTML=head('Similarity & Pattern Recognition','')+`<div class="row">${TABS.map((t,i)=>`<button class="btn ${S.tab==i?'':'g'}" data-t="${i}">${t}</button>`).join('')}</div><div id="sm"></div>`;
 mm.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{S.tab=+b.dataset.t;V.similar()});
 const box=$('sm');box.onclick=e=>{const a=e.target.closest('[data-susp]');if(!a)return;e.preventDefault();SEL=a.dataset.susp;go('card');scrollTo({top:0,behavior:'smooth'})};if(!rows.length){box.innerHTML='<p class="note">Load or select a case with call records to begin.</p>';return}
 const P=[()=>{
  const opts=rows.slice(0,400).map((r,i)=>`<option value="${i}" ${i==S.ref?'selected':''}>#${i+1} · ${esc(r.a)} → ${esc(r.b)} · ${esc(r.date)} ${esc(r.time)} · ${esc(r.dur)}s</option>`).join('')+(S.ref>=400?`<option value="${S.ref}" selected>#${S.ref+1} · selected</option>`:'');
  box.innerHTML=`<div class="row"><label class="note">Reference record&nbsp;<select id="sref">${opts}</select></label><label class="note">Show&nbsp;<select id="sn">${[10,15,30,60].map(n=>`<option ${n==S.n?'selected':''}>${n}</option>`).join('')}</select></label></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:4px 22px;margin:10px 0">${Object.keys(W).map(k=>`<label class="note" style="display:flex;gap:8px;align-items:center">${W[k]}<input type="range" min="0" max="5" value="${S.w[k]}" data-w="${k}" style="flex:1"><b>${S.w[k]}</b></label>`).join('')}</div><div id="sres"></div>`;
  const res=()=>{const q=rows[S.ref],R=rows.map((r,i)=>({r,i,...sim(r,q)})).filter(x=>x.i!=S.ref).sort((x,y)=>y.s-x.s),hi=R.filter(x=>x.s>=.8).length;
   $('sres').innerHTML=`<p class="note"><b>${hi}</b> of ${R.length} other records are ≥ 80% similar to the reference. Weights above control which behaviours count; set one to 0 to ignore it.</p><div class="tw"><table><thead><tr><th>#</th><th>Similarity</th><th>From → To</th><th>When</th><th>Dur</th><th>Type</th><th>Tower</th><th>Matching traits</th></tr></thead><tbody>${R.slice(0,S.n).map((x,k)=>`<tr><td>${k+1}</td><td><span class="sbar"><i style="width:${x.s*100}%"></i></span>${(x.s*100).toFixed(0)}%</td><td><a href="#" class="sl" data-susp="${esc(x.r.a)}" title="Open suspect card">${esc(x.r.a)}</a> → ${esc(x.r.b)}</td><td>${esc(x.r.date)} ${esc(x.r.time)}</td><td>${esc(x.r.dur)}s</td><td>${esc(x.r.type)}</td><td>${esc(x.r.cell)}</td><td>${Object.keys(W).filter(f=>x.f[f]>=.8&&S.w[f]>0).map(f=>`<span class="b">${W[f]}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>`};
  $('sref').onchange=e=>{S.ref=+e.target.value;res()};$('sn').onchange=e=>{S.n=+e.target.value;res()};
  box.querySelectorAll('[data-w]').forEach(i=>i.oninput=()=>{S.w[i.dataset.w]=+i.value;i.nextElementSibling.textContent=i.value;res()});res()},
 ()=>{
  const w={...S.w,day:0},thr=S.thr/100,Cs=[];
  rows.slice(0,3000).forEach(r=>{let b=null,bs=0;for(const c of Cs){const v=sim(r,c.l,w).s;if(v>bs){bs=v;b=c}}if(b&&bs>=thr){b.m.push(r);b.ss+=bs}else Cs.push({l:r,m:[r],ss:1})});
  const G=Cs.filter(c=>c.m.length>=3).sort((x,y)=>y.m.length-x.m.length).slice(0,12);
  const lab=c=>{const m=c.m,h=hrs(m),d=med(m.map(r=>r.dur)),L=[],u=f=>uniq(m.map(f)).length;if(h>=22||h<5)L.push('Nocturnal');if(d<30)L.push('Short-burst pings');if(d>=300)L.push('Extended sessions');if(u(r=>r.a+'>'+r.b)==1)L.push('Fixed-dyad recurrence');if(u(r=>r.date)>=3)L.push('Multi-day habit');if(u(r=>r.cell)==1)L.push('Stationary origin');if(u(r=>r.a)>=4&&u(r=>r.b)==1)L.push('Fan-in to one number');if(u(r=>r.b)>=4&&u(r=>r.a)==1)L.push('Fan-out from one number');return L.length?L:['Behavioural cluster']};
  box.innerHTML=`<div class="row"><label class="note" style="display:flex;gap:8px;align-items:center">Cluster tightness <input type="range" min="60" max="97" value="${S.thr}" id="sthr"><b id="sthv">${S.thr}%</b></label></div><p class="note">Records are grouped by the same similarity measure (date ignored) so that recurring behaviour surfaces as a pattern. ${Cs.length} groups found; showing ${G.length} with 3+ records.</p>`+
  (G.map((c,k)=>{const t=top(c.m.map(r=>r.a+' → '+r.b));return `<details class="pt"><summary>Pattern ${k+1} · ${c.m.length} records · ${esc(t[0])} · around ${hh(hrs(c.m))} · median ${med(c.m.map(r=>r.dur))}s · cohesion ${(c.ss/c.m.length*100).toFixed(0)}%<br>${lab(c).map(x=>`<span class="b o">${x}</span>`).join(' ')}</summary>${mini(c.m)}<div class="row" style="margin-top:8px"><button class="btn g" data-ref="${rows.indexOf(c.l)}">Find similar to this pattern</button><button class="btn" data-susp="${esc(top(c.m.map(r=>r.a))[0])}">Open suspect card · ${esc(top(c.m.map(r=>r.a))[0])}</button></div></details>`}).join('')||'<p class="note">No recurring patterns at this tightness; try lowering it.</p>');
  $('sthr').oninput=e=>{$('sthv').textContent=e.target.value+'%'};$('sthr').onchange=e=>{S.thr=+e.target.value;V.similar()};
  box.querySelectorAll('[data-ref]').forEach(b=>b.onclick=()=>{S.ref=+b.dataset.ref;S.tab=0;V.similar()})},
 ()=>{
  const lev=(a,b)=>{if(a==b)return 0;if(Math.abs(a.length-b.length)>2)return 9;let p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]==b[j-1]?0:1));p=c}return p[b.length]};
  const I={};rows.forEach(r=>[[r.a,r.imei,r.cell],[r.b,null,null]].forEach(([n,im,ce])=>{if(!n)return;const o=I[n]=I[n]||{c:0,im:new Set(),ce:new Set()};o.c++;if(im)o.im.add(im);if(ce)o.ce.add(ce)}));
  const N=Object.keys(I).slice(0,700),Pr=[],sh=(x,y)=>[...x].filter(v=>y.has(v));
  for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const d=lev(N[i],N[j]);if(d>=1&&d<=2){const a=I[N[i]],b=I[N[j]],si=sh(a.im,b.im),st=sh(a.ce,b.ce);Pr.push({x:N[i],y:N[j],d,si,st,sc:(3-d)*2+si.length*3+st.length})}}
  Pr.sort((p,q)=>q.sc-p.sc);
  const M=uniq(rows.map(r=>r.imei).filter(Boolean)).slice(0,400),Mp=[];
  for(let i=0;i<M.length;i++)for(let j=i+1;j<M.length;j++){const a=M[i],b=M[j],d=lev(a,b);if(d<=2)Mp.push([a,b,'Near-identical IMEI – possible tampering or typo',d]);else if(a.slice(0,8)==b.slice(0,8))Mp.push([a,b,'Same handset model (TAC)',d])}
  box.innerHTML=`<p class="note">Numbers that differ by one or two digits are a classic trace of spoofing, SIM rotation or deliberate look-alikes.</p><div class="tw"><table><thead><tr><th>Number A</th><th>Number B</th><th>Digits apart</th><th>Shared handset</th><th>Shared tower</th><th>Assessment</th></tr></thead><tbody>${Pr.slice(0,25).map(p=>`<tr><td>${esc(p.x)} <span class="note">(${I[p.x].c})</span></td><td>${esc(p.y)} <span class="note">(${I[p.y].c})</span></td><td>${p.d}</td><td>${p.si.length?esc(p.si[0]):'–'}</td><td>${p.st.length?esc(p.st[0]):'–'}</td><td><span class="b ${p.d==1&&p.si.length?'r':'o'}">${p.d==1&&p.si.length?'Probable spoof / SIM rotation':p.st.length?'Look-alike · co-located':'Look-alike'}</span></td></tr>`).join('')||'<tr><td colspan="6">No look-alike numbers found.</td></tr>'}</tbody></table></div><p class="note">${Pr.length} look-alike pair(s) among ${N.length} numbers.</p>
  <h3>Handset similarity</h3><div class="tw"><table><thead><tr><th>IMEI A</th><th>IMEI B</th><th>Finding</th></tr></thead><tbody>${Mp.slice(0,15).map(p=>`<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td><td>${p[2]}</td></tr>`).join('')||'<tr><td colspan="3">No related handsets found.</td></tr>'}</tbody></table></div>`},()=>{
 const N=Math.min(rows.length,3000),types=uniq(rows.map(r=>r.type)).slice(0,6),SZ={t:6,c:64,p:128,i:32},D=6+SZ.t+SZ.c+SZ.p+SZ.i;
 const hash=z=>{let h=2166136261;for(let i=0;i<z.length;i++){h^=z.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
 const key=[rows.length,CUR,JSON.stringify(S.w)].join('|');let X=window._vx;
 if(!X||X.key!=key){const t0=performance.now(),M=new Float32Array(N*D),w=S.w;
  for(let n=0;n<N;n++){const r=rows[n],v=M.subarray(n*D,n*D+D);let o=0;const circ=(x,k)=>{v[o]=w[k]*Math.cos(x);v[o+1]=w[k]*Math.sin(x);o+=2};
   circ(H(r)/24*6.2832,'tod');circ((new Date(DD(r)*864e5).getUTCDay()||0)/7*6.2832,'day');circ(Math.min(1,Math.log1p(+r.dur||0)/Math.log(3601))*1.5708,'dur');
   const ti=types.indexOf(r.type);if(ti>=0)v[o+ti]=w.type;o+=SZ.t;const sg=(tok,off,len,wt)=>{const h=hash(tok);v[off+h%len]+=wt*((h>>>16&1)?1:-1)};
   sg('c'+r.cell,o,SZ.c,w.cell);o+=SZ.c;sg('n'+r.a,o,SZ.p,w.party*.7071);sg('n'+r.b,o,SZ.p,w.party*.7071);o+=SZ.p;sg('i'+r.imei,o,SZ.i,w.imei);
   let nm=0;for(let j=0;j<D;j++)nm+=v[j]*v[j];nm=Math.sqrt(nm)||1;for(let j=0;j<D;j++)v[j]/=nm}
  X={key,M,ms:performance.now()-t0};window._vx=X}
 const M=X.M,K=Math.min(S.K||6,N);
 const search=(qi,k)=>{const t0=performance.now(),sc=new Float32Array(N),qo=qi*D;for(let i=0;i<N;i++){let a=0;const b=i*D;for(let j=0;j<D;j++)a+=M[b+j]*M[qo+j];sc[i]=a}
  return{ix:[...sc.keys()].filter(i=>i!=qi).sort((a,b)=>sc[b]-sc[a]).slice(0,k),sc,ms:performance.now()-t0}};
 if(!X.km||X.km.K!=K){const C=[Float32Array.from(M.subarray(0,D))],mx=new Float32Array(N).fill(-2),asg=new Int16Array(N);
  while(C.length<K){const c=C[C.length-1];let best=0,bv=2;for(let i=0;i<N;i++){let a=0;for(let k=0;k<D;k++)a+=M[i*D+k]*c[k];if(a>mx[i])mx[i]=a;if(mx[i]<bv){bv=mx[i];best=i}}C.push(Float32Array.from(M.subarray(best*D,best*D+D)))}
  for(let it=0;it<12;it++){for(let i=0;i<N;i++){let b=0,bs=-2;for(let c=0;c<K;c++){let a=0;for(let k=0;k<D;k++)a+=M[i*D+k]*C[c][k];if(a>bs){bs=a;b=c}}asg[i]=b}
   const A=C.map(()=>new Float32Array(D));for(let i=0;i<N;i++){const a=A[asg[i]];for(let k=0;k<D;k++)a[k]+=M[i*D+k]}
   A.forEach((a,c)=>{let n=0;for(let k=0;k<D;k++)n+=a[k]*a[k];n=Math.sqrt(n);if(n)for(let k=0;k<D;k++)C[c][k]=a[k]/n})}
  X.km={asg,C,K}}
 if(!X.xy){const mu=new Float32Array(D);for(let i=0;i<N;i++)for(let k=0;k<D;k++)mu[k]+=M[i*D+k]/N;const comps=[];
  for(let c=0;c<2;c++){let v=Float32Array.from({length:D},(_,k)=>Math.sin(k*12.9898+c*78.233));
   for(let it=0;it<20;it++){const u=new Float32Array(N);for(let i=0;i<N;i++){let a=0;for(let k=0;k<D;k++)a+=(M[i*D+k]-mu[k])*v[k];u[i]=a}
    const nv=new Float32Array(D);for(let i=0;i<N;i++)for(let k=0;k<D;k++)nv[k]+=(M[i*D+k]-mu[k])*u[i];
    comps.forEach(q=>{let d=0;for(let k=0;k<D;k++)d+=nv[k]*q[k];for(let k=0;k<D;k++)nv[k]-=d*q[k]});
    let n=0;for(let k=0;k<D;k++)n+=nv[k]*nv[k];n=Math.sqrt(n)||1;for(let k=0;k<D;k++)v[k]=nv[k]/n}comps.push(v)}
  const xy=[];for(let i=0;i<N;i++)xy.push(comps.map(v=>{let a=0;for(let k=0;k<D;k++)a+=(M[i*D+k]-mu[k])*v[k];return a}));
  const e=j=>{const a=xy.map(p=>p[j]);return[Math.min(...a),(Math.max(...a)-Math.min(...a))||1]},ex=e(0),ey=e(1);X.xy=xy.map(p=>[(p[0]-ex[0])/ex[1],(p[1]-ey[0])/ey[1]])}
 const COL=['#19d3a2','#38b6ff','#7dffb2','#ff3b6b','#b388ff','#ffd479','#2fd9a0','#ff6b6b','#63e6be','#74c0fc'];
 const LAB=m=>{const h=hrs(m),d=med(m.map(r=>r.dur)),L=[],u=f=>uniq(m.map(f)).length;if(h>=22||h<5)L.push('Nocturnal');if(d<30)L.push('Short-burst pings');if(d>=300)L.push('Extended sessions');if(u(r=>r.a+'>'+r.b)==1&&m.length>=3)L.push('Fixed-dyad recurrence');if(u(r=>r.date)>=3)L.push('Multi-day habit');if(u(r=>r.cell)==1)L.push('Stationary origin');if(u(r=>r.a)>=4&&u(r=>r.b)==1)L.push('Fan-in to one number');if(u(r=>r.b)>=4&&u(r=>r.a)==1)L.push('Fan-out from one number');return L.length?L:['Behavioural cluster']};
 if(S.ref>=N)S.ref=0;
 const opts=rows.slice(0,Math.min(N,400)).map((r,i)=>`<option value="${i}">#${i+1} · ${esc(r.a)} → ${esc(r.b)} · ${esc(r.date)} ${esc(r.time)}</option>`).join('');
 box.innerHTML=`<p class="note">Every call becomes a ${D}-dimensional embedding vector (time and day as angles, duration, call type, and hashed tower, number and handset tokens). Search is brute-force cosine similarity over all vectors; patterns are found with spherical k-means. Trait weights come from the Query tab.</p>
 <div class="row"><label class="note">Query vector&nbsp;<select id="vq">${opts}</select></label><label class="note">Neighbours&nbsp;<select id="vk">${[8,12,20,40].map(n=>`<option ${n==(S.nn||12)?'selected':''}>${n}</option>`).join('')}</select></label><label class="note">Pattern clusters (k)&nbsp;<select id="vK">${[3,4,5,6,8,10].map(n=>`<option ${n==K?'selected':''}>${n}</option>`).join('')}</select></label></div><div id="vres"></div>`;
 $('vq').value=S.ref;
 const draw=()=>{const k=S.nn||12,q=S.ref,R=search(q,k),nb=new Set(R.ix),as=X.km.asg;
  const dots=X.xy.map((p,i)=>`<circle data-i="${i}" cx="${(20+p[0]*560).toFixed(1)}" cy="${(20+(1-p[1])*300).toFixed(1)}" r="${nb.has(i)?5:2.6}" fill="${COL[as[i]%10]}" opacity="${nb.has(i)?1:.7}" ${nb.has(i)?'stroke="#fff" stroke-width="1.5"':''}><title>#${i+1} ${esc(rows[i].a)} → ${esc(rows[i].b)} ${esc(rows[i].time)}</title></circle>`).join('');
  const qp=X.xy[q],qx=20+qp[0]*560,qy=20+(1-qp[1])*300;
  const G=Array.from({length:K},()=>[]);for(let i=0;i<N;i++)G[as[i]].push(i);
  const grp=G.map((ix,c)=>{if(!ix.length)return null;const m=ix.map(i=>rows[i]);let coh=0;ix.forEach(i=>{let a=0;for(let j=0;j<D;j++)a+=M[i*D+j]*X.km.C[c][j];coh+=a});return{c,m,n:m.length,coh:coh/m.length,t:top(m.map(r=>r.a+' → '+r.b))[0],h:hrs(m),d:med(m.map(r=>r.dur)),L:LAB(m)}}).filter(Boolean).sort((a,b)=>b.n-a.n);
  $('vres').innerHTML=`<p class="note">${N} vectors × ${D} dimensions · index built in ${X.ms.toFixed(0)} ms · cosine search over all vectors in ${R.ms.toFixed(1)} ms. Click any point to use it as the query; white-ringed points are its nearest neighbours.</p>
  <svg viewBox="0 0 600 340" style="width:100%;max-height:420px;background:#050a1480;border:1px solid var(--line)">${dots}<polygon points="${[0,1,2,3,4,5,6,7,8,9].map(j=>{const a=j*Math.PI/5-Math.PI/2,r=j%2?5:12;return(qx+Math.cos(a)*r).toFixed(1)+','+(qy+Math.sin(a)*r).toFixed(1)}).join(' ')}" fill="#fff" stroke="#19d3a2" stroke-width="1.5" pointer-events="none"/></svg>
  <h3>Nearest neighbours</h3><div class="tw"><table><thead><tr><th>#</th><th>Cosine</th><th>From → To</th><th>When</th><th>Dur</th><th>Tower</th><th>Pattern</th></tr></thead><tbody>${R.ix.map((i,n)=>`<tr><td>${n+1}</td><td><span class="sbar"><i style="width:${Math.max(0,R.sc[i])*100}%"></i></span>${(R.sc[i]*100).toFixed(1)}%</td><td>${esc(rows[i].a)} → ${esc(rows[i].b)}</td><td>${esc(rows[i].date)} ${esc(rows[i].time)}</td><td>${esc(rows[i].dur)}s</td><td>${esc(rows[i].cell)}</td><td><span style="color:${COL[as[i]%10]}">●</span> P${as[i]+1}</td></tr>`).join('')}</tbody></table></div>
  <h3>Recognised patterns (k-means on vectors)</h3><div class="tw"><table><thead><tr><th>Pattern</th><th>Records</th><th>Cohesion</th><th>Typical pair</th><th>Around</th><th>Median dur</th><th>Signature</th></tr></thead><tbody>${grp.map(g=>`<tr><td><span style="color:${COL[g.c%10]}">●</span> P${g.c+1}</td><td>${g.n}</td><td>${(g.coh*100).toFixed(0)}%</td><td>${esc(g.t)}</td><td>${hh(g.h)}</td><td>${g.d}s</td><td>${g.L.map(x=>`<span class="b o">${x}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('#vres circle[data-i]').forEach(c=>c.onclick=()=>{S.ref=+c.dataset.i;$('vq').value=S.ref;draw()})};
 $('vq').onchange=e=>{S.ref=+e.target.value;draw()};$('vk').onchange=e=>{S.nn=+e.target.value;draw()};$('vK').onchange=e=>{S.K=+e.target.value;V.similar()};draw()}];
 P[S.tab]()},
cases(){
  const fir=id=>(CASES.find(c=>c.id==id)||{}).fir||'?',sts=['Open','Under investigation','Charge-sheeted','Closed'],mm=$('main');
  const card=c=>{const t=trk(c),oth=CASES.filter(o=>o.id!=c.id&&c.suspect&&o.rows.some(r=>r.a==c.suspect||r.b==c.suspect));
    return `<div class="cs ${c.id==CUR?'on':''}"><div class="row" style="margin:0 0 4px;justify-content:space-between"><b>${esc(c.fir)}</b><select data-st="${c.id}">${sts.map(s=>`<option ${s==c.status?'selected':''}>${s}</option>`).join('')}</select></div>
    <div>${esc(c.title)}</div><div class="note">Suspect <b>${esc(c.suspect||'–')}</b> · ${c.rows.length} records · filed ${c.filed}${c.parent?' · linked to '+esc(fir(c.parent)):''}</div>
    <div class="note">Track: ${t.ch.length?t.ch.map(esc).join(' → '):'no located records'}${t.st?`<span class="b o">☄ ${t.st} interstate</span>`:''}${t.co?`<span class="b r">☄ ${t.co} international</span>`:''}</div>
    <div>${c.charges.map((x,i)=>`<span class="ch">${esc(x)}<a href="#" data-rm="${c.id}|${i}">×</a></span>`).join('')||'<span class="note">No charges recorded</span>'}</div>
    <div class="row" style="margin:6px 0"><input data-ch="${c.id}" placeholder="Add charge / section" style="flex:1"><button class="btn g" data-add="${c.id}">Add</button></div>
    ${oth.length?`<div class="note">⚠ Suspect also appears in ${oth.map(o=>esc(o.fir)).join(', ')}</div>`:''}
    <div class="row" style="margin:6px 0 0"><button class="btn" data-trk="${c.id}">☄ Track movement</button><button class="btn g" data-op="${c.id}">Open case data</button><button class="btn g" data-fl="${c.id}">File additional case…</button></div></div>`};
  const sus=uniq(CASES.map(c=>c.suspect).filter(Boolean)).map(n=>{const cs=CASES.filter(c=>c.suspect==n);return `<tr class="${cs.length>1?'hl':''}"><td>${esc(n)}</td><td>${cs.map(c=>esc(c.fir)).join(', ')}</td><td>${uniq(cs.flatMap(c=>c.charges)).map(esc).join('; ')}</td><td>${cs.length}</td></tr>`}).join('');
  mm.innerHTML=head('Case register & suspects','Each case keeps its own CDR and its own movement track. A suspect accused under further charges gets an additional case linked to the original.')+
  `<div class="row"><button class="btn" data-fl="new">＋ New case</button><button class="btn g" id="cx">Export register (JSON)</button><label class="btn g">Import register<input id="ci" type="file" accept=".json" hidden></label></div><div id="ff"></div>${CASES.map(card).join('')}<h3 style="margin:14px 0 4px">Suspect register</h3><div class="tw"><table><thead><tr><th>Suspect</th><th>Cases</th><th>Charges</th><th>#</th></tr></thead><tbody>${sus}</tbody></table></div><p class="note">Highlighted: suspect accused in more than one case. Registers hold sensitive CDR data – export files are not encrypted.</p>`;
  const form=pid=>{const p=CASES.find(c=>c.id==pid);return `<div class="cs on"><h3 style="margin:0 0 6px">${p?'File additional case against '+esc(p.suspect)+' (from '+esc(p.fir)+')':'New case'}</h3><div class="row"><input id="ft" placeholder="Offence summary / case title" style="flex:2;min-width:200px"><input id="fs" value="${p?esc(p.suspect):''}" placeholder="Suspect number" style="flex:1;min-width:130px"></div><div>${CHG.map((x,i)=>`<label class="ch"><input type="checkbox" data-cg="${i}"> ${esc(x)}</label>`).join('')}</div><div class="row" style="margin-top:6px"><input id="fo" placeholder="Other charges (comma separated)" style="flex:1"></div>${p?`<label class="note"><input type="checkbox" id="fc" checked> Carry over this suspect’s CDR records from ${esc(p.fir)}</label>`:''}<div class="row" style="margin-top:6px"><button class="btn" id="fgo">File case</button></div><p class="note">Sections are suggestions – confirm with the prosecutor before filing. For a new case, use “Load CDR (CSV)” afterwards to attach its records.</p></div>`};
  mm.querySelectorAll('[data-st]').forEach(s=>s.onchange=()=>{CASES.find(c=>c.id==s.dataset.st).status=s.value});
  mm.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const c=CASES.find(x=>x.id==b.dataset.add),i=mm.querySelector(`[data-ch="${c.id}"]`);if(i.value.trim()){c.charges.push(i.value.trim());V.cases()}});
  mm.querySelectorAll('[data-rm]').forEach(a=>a.onclick=e=>{e.preventDefault();const[id,i]=a.dataset.rm.split('|');CASES.find(c=>c.id==id).charges.splice(+i,1);V.cases()});
  mm.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>setCase(b.dataset.op,'records'));
  mm.querySelectorAll('[data-trk]').forEach(b=>b.onclick=()=>{window._pick=CASES.find(c=>c.id==b.dataset.trk).suspect;setCase(b.dataset.trk,'map')});
  mm.querySelectorAll('[data-fl]').forEach(b=>b.onclick=()=>{const pid=b.dataset.fl;$('ff').innerHTML=form(pid);$('ff').scrollIntoView({behavior:'smooth'});
    $('fgo').onclick=()=>{const p=CASES.find(c=>c.id==pid),s=$('fs').value.trim(),ch=[...document.querySelectorAll('[data-cg]:checked')].map(x=>CHG[+x.dataset.cg]).concat($('fo').value.split(',').map(x=>x.trim()).filter(Boolean)),
      rw=p&&$('fc')&&$('fc').checked?p.rows.filter(r=>r.a==s||r.b==s).map(r=>({...r})):[];
      setCase(newCase({title:$('ft').value.trim()||'Additional charges – '+s,suspect:s,charges:ch,parent:p&&p.id,rows:rw}).id,'cases')}});
  $('cx').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({cases:CASES,fseq})],{type:'application/json'}));a.download='tracecdr-cases.json';a.click()};
  $('ci').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!Array.isArray(o.cases)||!o.cases.length)throw 0;CASES=o.cases;fseq=o.fseq||CASES.length;setCase(CASES[0].id,'cases')}catch(x){alert('Not a TraceCDR case register.')}};r.readAsText(f)};
},
records(){
  const f=rows.filter(r=>COLS.every(k=>!colF[k]||String(r[k]).toLowerCase().includes(colF[k].toLowerCase())));
  $('main').innerHTML=head('Records & basic filtering','Excel-like filtering: type in any column box, click a header to sort.')+table(f,null,true);bindTable(V.records);
},
search(){
  const m=$('main');
  if(!m.querySelector('#sq')){
    m.innerHTML=head('Advanced search','Paste multiple phone / IMEI numbers, then add an include or exclude keyword rule.')+
    `<textarea id="sq" placeholder="One number or IMEI per line, or comma separated"></textarea>
     <div class="row" style="margin-top:8px"><select id="sc">${COLS.map(k=>`<option value="${k}">${LBL[k]}</option>`).join('')}</select>
     <select id="so"><option>Contains</option><option>Does Not Contain</option><option>Equals</option><option>Starts With</option><option>Ends With</option></select>
     <input id="sv" placeholder="keyword"><button class="btn" id="go">Search</button></div><div id="sr"></div>`;
    $('go').onclick=()=>{
      const ids=new Set($('sq').value.split(/[\s,;]+/).filter(Boolean)),c=$('sc').value,o=$('so').value,v=$('sv').value.toLowerCase();
      const res=rows.filter(r=>(!ids.size||[r.a,r.b,r.imei].some(x=>ids.has(x)))&&(!v||({Contains:x=>x.includes(v),'Does Not Contain':x=>!x.includes(v),Equals:x=>x==v,'Starts With':x=>x.startsWith(v),'Ends With':x=>x.endsWith(v)}[o])(String(r[c]).toLowerCase())));
      $('sr').innerHTML=table(res);bindTable(()=>$('go').onclick());};
  }
},
common(){
  $('main').innerHTML=head('Find common numbers','Numbers contacted by both Party A and Party B (intersection).')+
  `<div class="row"><select id="pa">${numOpts()}</select><select id="pb">${numOpts()}</select><button class="btn" id="go">Compare</button></div><div id="sr"></div>`;
  $('pb').selectedIndex=Math.min(1,$('pb').options.length-1);
  const cp=n=>{const m={};rows.forEach(r=>{if(r.a==n)m[r.b]=(m[r.b]||0)+1;if(r.b==n)m[r.a]=(m[r.a]||0)+1});return m};
  $('go').onclick=()=>{const A=$('pa').value,B=$('pb').value,x=cp(A),y=cp(B),c=Object.keys(x).filter(k=>y[k]&&k!=A&&k!=B);
    $('sr').innerHTML=c.length?`<div class="tw"><table><thead><tr><th>Common number</th><th>Calls with ${A}</th><th>Calls with ${B}</th></tr></thead><tbody>${c.map(k=>`<tr><td>${k}</td><td>${x[k]}</td><td>${y[k]}</td></tr>`).join('')}</tbody></table></div>`:'<p class="note">No common numbers.</p>'};
  $('go').onclick();
},
conf(){
  const byCaller={};
  rows.forEach(r=>{
    if(!r.a) return;
    const dur=Math.max(0,+r.dur||0);
    if(dur<=0) return;
    const startMs=ts(r);
    if(!startMs||isNaN(startMs)) return;
    (byCaller[r.a]=byCaller[r.a]||[]).push({r,start:startMs,end:startMs+dur*1000,dur});
  });
  const confSet=new Set();
  const pairs=[];
  Object.entries(byCaller).forEach(([caller,calls])=>{
    if(calls.length<2) return;
    calls.sort((x,y)=>x.start-y.start);
    for(let i=0;i<calls.length;i++){
      for(let j=i+1;j<calls.length;j++){
        if(calls[j].start>=calls[i].end) break;
        if(calls[i].r.b!==calls[j].r.b){
          const overlapSec=Math.round((Math.min(calls[i].end,calls[j].end)-Math.max(calls[i].start,calls[j].start))/1000);
          if(overlapSec>=2){
            confSet.add(calls[i].r);
            confSet.add(calls[j].r);
            pairs.push({caller,b1:calls[i].r.b,b2:calls[j].r.b,overlap:overlapSec,c1:calls[i].r,c2:calls[j].r});
          }
        }
      }
    }
  });
  const f=[...confSet];
  $('main').innerHTML=head('Conference & Multi-Party Detection','Identified overlapping call intervals [start, start + duration] with \u22652s temporal overlap between different B-parties.')+
    (pairs.length?`<div class="note" style="margin-bottom:10px">Found <b>${pairs.length}</b> overlapping call interval(s) across <b>${confSet.size}</b> CDR records.</div>`:'<p class="note">No overlapping conference call intervals found.</p>')+
    table(f,confSet);
},
follow(){
  $('main').innerHTML=head('Follow-up calls','Repeat calls between the same pair within a chosen window.')+
  `<div class="row">Window (min): <input id="w" type="number" value="10" min="1" style="width:70px"><button class="btn" id="go">Find</button></div><div id="sr"></div>`;
  $('go').onclick=()=>{const w=$('w').value*6e4,last={},set=new Set();
    rows.forEach(r=>{const k=r.a+'>'+r.b,t=ts(r);if(last[k]&&t-last[k].t<=w){set.add(last[k].r);set.add(r)}last[k]={t,r}});
    $('sr').innerHTML=table([...set],set)};$('go').onclick();
},
exact(){
  $('main').innerHTML=head('Exact call','Find a call when the exact time is uncertain – pick a tolerance window.')+
  `<div class="row"><input id="d" type="date" value="2026-11-03"><input id="t" type="time" step="1" value="14:05:00">
  <select id="i"><option value="1">±1 min</option><option value="2">±2 min</option><option value="5" selected>±5 min</option><option value="10">±10 min</option><option value="30">±30 min</option></select>
  <button class="btn" id="go">Find</button></div><div id="sr"></div>`;
  $('go').onclick=()=>{const c=Date.parse($('d').value+'T'+($('t').value.length==5?$('t').value+':00':$('t').value)),w=$('i').value*6e4;
    $('sr').innerHTML=table(rows.filter(r=>Math.abs(ts(r)-c)<=w))};$('go').onclick();
},
sim(){
  const m={};rows.forEach(r=>{(m[r.imei]=m[r.imei]||new Set()).add(r.imsi)});
  const ims=Object.keys(m).filter(k=>m[k].size>1);
  $('main').innerHTML=head('Multiple SIM – IMEI','Handsets (IMEI) seen with more than one SIM (IMSI).')+
  (ims.length?`<div class="tw"><table><thead><tr><th>IMEI</th><th>SIMs</th><th>IMSIs</th></tr></thead><tbody>${ims.map(k=>`<tr><td>${k}</td><td>${m[k].size}</td><td>${[...m[k]].join(', ')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="note">No multi-SIM handsets.</p>')+
  `<p class="note">Also see: numbers using more than one IMEI → ${(()=>{const ow=owners('imei',.5),c={};Object.values(ow).forEach(v=>v.forEach(n=>c[n]=(c[n]||0)+1));return Object.keys(c).filter(n=>c[n]>1)})().map(n=>`<span class="tag">${n}</span>`).join('')||'none'}</p>`;
},
group(){
  const m={};rows.forEach(r=>{(m[r.a]=m[r.a]||{n:0,d:0,b:new Set()}).n++;m[r.a].d+=+r.dur||0;m[r.a].b.add(r.b)});
  const L=Object.entries(m).sort((x,y)=>y[1].n-x[1].n);
  $('main').innerHTML=head('Split / group CDR','Unique A-parties with call counts, total duration and unique contacts.')+
  `<div class="tw"><table><thead><tr><th>Number</th><th>Calls</th><th>Total dur (s)</th><th>Unique B-parties</th></tr></thead><tbody>${L.map(([k,v])=>`<tr><td>${k}</td><td>${v.n}</td><td>${v.d}</td><td>${v.b.size}</td></tr>`).join('')}</tbody></table></div>`;
},
cell(){
  const m={};rows.forEach(r=>{const k=r.cell+' · '+r.addr;m[k]=(m[k]||0)+1});const L=Object.entries(m).sort((a,b)=>b[1]-a[1]),mx=L[0]?L[0][1]:1;
  $('main').innerHTML=head('Cell chart','Calls per tower. Click a bar to list its records. (Map tiles are not loaded in this offline build.)')+
  L.map(([k,v])=>`<div class="bar" data-c="${esc(k.split(' · ')[0])}"><span>${esc(k)}</span><i style="width:${v/mx*55}%"></i><b>${v}</b></div>`).join('')+'<div id="sr"></div>';
  document.querySelectorAll('.bar').forEach(b=>b.onclick=()=>{$('sr').innerHTML=table(rows.filter(r=>r.cell==b.dataset.c))});
},
live(){
  $('main').innerHTML=head('Live ingestion','Append new CDR records as they arrive. Alerts fire on a new IMEI, a first-time tower, or an impossible speed.')+
  `<div class='row'><label class='btn'>Append CSV batch<input id='lf' type='file' accept='.csv,.txt' multiple hidden></label><button class='btn g' id='fd'></button><span class='note'>The demo simulation adds one synthetic record every 2 seconds. For real data use a live source URL below.</span></div><textarea id='lp' placeholder='Paste new rows (header optional): A,B,date,time,dur,type,imei,imsi,cell,addr,lat,lon'></textarea><div class='row' style='margin-top:8px'><button class='btn' id='lb'>Ingest pasted rows</button></div><div id='lv'></div>`;
  const lab=()=>$('fd').textContent=window._feed?'■ Stop demo simulation':'● Start demo simulation';lab();
  $('lf').onchange=e=>[...e.target.files].forEach(f=>{const r=new FileReader();r.onload=()=>ingest(parseCSV(r.result),f.name);r.readAsText(f)});
  $('lb').onclick=()=>{const L=$('lp').value.split(/\r?\n/).filter(x=>x.trim());if(!L.length)return;const h=/party|imei|date/i.test(L[0]);ingest(parseCSV((h?L:[COLS.join(',')].concat(L)).join('\n')),'Pasted');$('lp').value=''};
  $('fd').onclick=()=>{if(window._feed){clearInterval(window._feed);window._feed=0}else window._feed=setInterval(()=>ingest([simRec()],'Demo simulation'),2000);lab()};
  liveBody();
},
map(){
  $('main').innerHTML=head('Tower map & tracking','Plots real tower latitude/longitude, traces a target’s movement tower to tower, and flags impossible speeds.')+
  `<div class="row"><select id="tg">${numOpts()}</select><button class="btn" id="go">Track</button><input id="sl" type="range" min="1" max="1" value="1" style="flex:1;min-width:120px"><button class="btn g" id="pl">▶ Play</button><select id="sp"><option value="1200">Slow</option><option value="600" selected>Normal</option><option value="250">Fast</option></select><span id="sn" class="note"></span></div><div class="mp"><span class="mt">Google Maps · live caller tracking</span><div id="gmap"></div><div id="stc"></div></div><div class="note"><label><input type="checkbox" id="fol" checked> Follow caller</label> · <span id="dinfo">Click the map to drop a pointer. Numbers below open that step in OpenStreetMap.</span></div><div class="note"><span id="cmlg">Blue line: same state · <span style="color:#19d3a2">☄ orange comet: interstate</span> · <span style="color:#ff6b6b">☄ red comet: international</span></span></div><div id="olk"></div><div id="sr"></div>`;
  const hv=(a,b)=>{const r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dn=r(b.lon-a.lon),h=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dn/2)**2;return 12742*Math.asin(Math.sqrt(h))};
  const ok=rows.filter(r=>isFinite(parseFloat(r.lat))&&isFinite(parseFloat(r.lon)));
  const tw={};ok.forEach(r=>{(tw[r.cell]=tw[r.cell]||{cell:r.cell,addr:r.addr,lat:+r.lat,lon:+r.lon,n:0}).n++});
  const T_=Object.values(tw);
  if(!T_.length){$('sr').innerHTML='<p class="note">No latitude/longitude columns found in this CDR.</p>';return}
  const W=680,H=440,pad=50,mla=T_.reduce((s,t)=>s+t.lat,0)/T_.length,k=Math.cos(mla*Math.PI/180);
  const la=T_.map(t=>t.lat),lo=T_.map(t=>t.lon),minLa=Math.min(...la),maxLa=Math.max(...la),minLo=Math.min(...lo),maxLo=Math.max(...lo);
  const sc=Math.min((W-2*pad)/(((maxLo-minLo)*k)||1e-3),(H-2*pad)/((maxLa-minLa)||1e-3));
  const X=lon=>pad+(lon-minLo)*k*sc+((W-2*pad)-((maxLo-minLo)*k*sc))/2,Y=lat=>H-pad-(lat-minLa)*sc-((H-2*pad)-((maxLa-minLa)*sc))/2;
  let steps=[];
  const hasL=typeof L!=='undefined';let gm_,gL,gP,cL,rd=null,rpos=null,anim=0,zf=false;
  const osm=(la,lo)=>`https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=17/${la}/${lo}`;
  const bear=(a,b)=>{const r=x=>x*Math.PI/180,dl=r(b[1]-a[1]),y=Math.sin(dl)*Math.cos(r(b[0])),x=Math.cos(r(a[0]))*Math.sin(r(b[0]))-Math.sin(r(a[0]))*Math.cos(r(b[0]))*Math.cos(dl);return (Math.atan2(y,x)*180/Math.PI+360)%360};
  const bz=(a,b,g)=>{const dx=b[1]-a[1],dy=b[0]-a[0],k=g==2?.3:g==1?.2:0,cl=(a[0]+b[0])/2+dx*k,co=(a[1]+b[1])/2-dy*k;return u=>[(1-u)*(1-u)*a[0]+2*(1-u)*u*cl+u*u*b[0],(1-u)*(1-u)*a[1]+2*(1-u)*u*co+u*u*b[1]]};
  const SC=['#E23744','#19d3a2','#e03131'],arcPts=P=>{const n=P.n||20;return[...Array(n+1)].map((_,i)=>P(i/n))};
  const RD=window._rd=window._rd||{},rk=(a,b)=>a.join()+'>'+b.join();
  const road=(A,to,g)=>{const R=!g&&RD[rk(A,to)];if(!(R&&R.length>1))return null;const cum=[0];for(let i=1;i<R.length;i++)cum.push(cum[i-1]+Math.hypot(R[i][0]-R[i-1][0],R[i][1]-R[i-1][1]));const T=cum[cum.length-1]||1;const f=u=>{const d=u*T;let i=1;while(i<cum.length-1&&cum[i]<d)i++;const t=(d-cum[i-1])/((cum[i]-cum[i-1])||1);return[R[i-1][0]+(R[i][0]-R[i-1][0])*t,R[i-1][1]+(R[i][1]-R[i-1][1])*t]};f.n=Math.min(150,R.length);return f};
  const PP=(a,b,g)=>road(a,b,g)||bz(a,b,g);
  const prefetch=async()=>{
    if (!sessionStorage.getItem('tcdr_consent_maps')) {
      const ok = confirm("Privacy Notice: Fetching map routes contacts external servers. Proceed?");
      if (ok) { sessionStorage.setItem('tcdr_consent_maps', '1'); }
      else { return; }
    }
    const ps=[];for(let i=1;i<steps.length&&ps.length<40;i++){const a=[steps[i-1].lat,steps[i-1].lon],b=[steps[i].lat,steps[i].lon];if(seg(steps[i-1],steps[i])||RD[rk(a,b)]!==undefined)continue;RD[rk(a,b)]=0;ps.push([a,b])}
    for(const [a,b] of ps){try{const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+a[1]+','+a[0]+';'+b[1]+','+b[0]+'?overview=full&geometries=geojson'),j=await r.json();RD[rk(a,b)]=j.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])}catch(e){RD[rk(a,b)]=null}
      if(!window._tm&&gm_&&document.body.contains(gm_.getContainer()))draw()}};
  const locate=(lat,lon)=>{if(!hasL)return;gP.clearLayers();
    L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="ptr"></div>',iconSize:[14,14]})}).addTo(gP);
    $('fol').checked=false;gm_.flyTo([lat,lon],Math.max(gm_.getZoom(),14),{duration:.8});
    let n=null,d=1e9;T_.forEach(t=>{const x=hv({lat,lon},t);if(x<d){d=x;n=t}});
    $('dinfo').innerHTML=`Pointer ${lat.toFixed(5)}, ${lon.toFixed(5)} · nearest tower <b>${esc(n.cell)}</b> · ${d<1?(d*1000).toFixed(0)+' m':d.toFixed(2)+' km'} · <a target="_blank" rel="noopener" href="${osm(lat.toFixed(5),lon.toFixed(5))}">OSM</a>`};
  if(hasL){
    gm_=L.map('gmap',{layers:[(window._street=L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{subdomains:'0123',maxZoom:20,attribution:'© Google',className:'dk'}))]});
    {let er=0,fb=0;window._street.on('tileerror',()=>{if(++er>=8&&!fb){fb=1;L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{subdomains:'abcd',maxZoom:19,attribution:'© OpenStreetMap © CARTO'}).addTo(gm_).bringToBack();$('dinfo').textContent='Google tiles are blocked on this network; showing a backup base map.'}})}
    gL=L.layerGroup().addTo(gm_);gP=L.layerGroup().addTo(gm_);cL=L.layerGroup().addTo(gm_);
    gm_.fitBounds(L.latLngBounds(T_.map(t=>[t.lat,t.lon])),{maxZoom:15,padding:[30,30]});
    setTimeout(()=>gm_.invalidateSize(),250);gm_.on('click',e=>locate(e.latlng.lat,e.latlng.lng));
  }else $('gmap').innerHTML='<p class="note" style="padding:12px">Google map could not load (internet needed).</p>';
  const mapDraw=(S,cur)=>{if(!hasL)return;gL.clearLayers();
    const C=p=>[p.lat,p.lon],full=steps.map(C),q=S[S.length-2],gx=q?seg(q,cur):0,A=q?C(q):C(cur),to=C(cur),P=PP(A,to,gx),cm=gx>0,fol=$('fol');
    T_.forEach(t=>L.circleMarker(C(t),{radius:4,color:'#888',weight:1,fillOpacity:.5,bubblingMouseEvents:false}).bindTooltip(esc(t.addr||t.cell)+' · '+t.n+' records').on('click',()=>locate(t.lat,t.lon)).addTo(gL));
    for(let i=1;i<steps.length;i++){const g=seg(steps[i-1],steps[i]);L.polyline(arcPts(PP(full[i-1],full[i],g)),{color:'#b9bcc2',weight:4,opacity:.7,interactive:false,dashArray:g?'2 8':null}).addTo(gL)}
    L.marker(full[0],{icon:L.divIcon({className:'',html:'<div class="zpin g">START</div>',iconSize:[0,0]}),interactive:false}).addTo(gL);if(full.length>1)L.marker(full[full.length-1],{icon:L.divIcon({className:'',html:'<div class="zpin">LAST SEEN</div>',iconSize:[0,0]}),interactive:false}).addTo(gL);
    for(let i=1;i<S.length-1;i++){const g=seg(S[i-1],S[i]);{const pp=arcPts(PP(C(S[i-1]),C(S[i]),g));if(!g)L.polyline(pp,{color:'#fff',weight:9,opacity:.95,interactive:false}).addTo(gL);L.polyline(pp,{color:SC[g],weight:g?4:5,opacity:.95,interactive:false,dashArray:g?'8 6':null}).addTo(gL)}}
    const lp=L.polyline([],{color:SC[gx],weight:gx?4:5,opacity:.95,interactive:false,dashArray:gx?'8 6':null}).addTo(gL);
    S.forEach((p,i)=>L.marker(C(p),{icon:L.divIcon({className:'',html:`<div class="pn${p===cur?' cur':''}">${i+1}</div>`,iconSize:[20,20]})}).bindPopup(`<b>${i+1}.</b> ${p.date} ${p.time}<br>${esc(p.cell)}<br>${esc(regName(reg(p)))}<br><a target="_blank" rel="noopener" href="${osm(p.lat,p.lon)}">Open in OSM</a>`).addTo(gL));
    $('olk').innerHTML='<span class="note">OSM by step:</span>'+S.map((p,i)=>`<a target="_blank" rel="noopener" title="${esc(p.date+' '+p.time+' · '+p.cell)}" class="${p===cur?'on':''}" href="${osm(p.lat,p.lon)}">${i+1}${i&&seg(S[i-1],p)?' ☄':''}</a>`).join('');
    const km=q?hv(q,cur):0,hr=q?(cur.t-q.t)/36e5:0,sp=q&&hr>0?km/hr:0,nx=steps[S.length],tot=S.reduce((s,p,i)=>s+(i?hv(S[i-1],p):0),0),rg=reg(cur),rq=q?reg(q):rg,lab=(gx==2?'✈ ':'')+regName(rq)+' → '+regName(rg);
    const fm=m=>m<60?Math.round(m)+' min':(m/60).toFixed(1)+' h',gc=g=>g==2?'#ff6b6b':'#19d3a2';
    {const mv=q&&km>.05,eta=nx?Math.max(1,Math.round((nx.t-cur.t)/6e4)):0;
    $('stc').innerHTML=`<div class="zt"><b>${mv?(gx?'Crossing '+(gx==2?'border':'state line'):'On the move · '+sp.toFixed(0)+' km/h'+(sp>120?' ⚠':'')):'Stationary'}</b><span class="zp2">${nx?'Next in '+fm(eta):'Last seen'}</span></div><div class="zs">${esc($('tg').value)} · at <b>${esc(cur.addr||cur.cell)}</b> · ${esc(regName(rg))}</div><div class="zs">${nx?'Next tower: '+esc(nx.addr||nx.cell)+' · '+hv(cur,nx).toFixed(2)+' km':'End of trail'} · covered ${tot.toFixed(2)} km · ${cur.date} ${cur.time}</div><div class="bar"><i style="width:${S.length/steps.length*100}%"></i></div>`}
    if(!rd)rd=L.marker(to,{icon:L.divIcon({className:'',html:'<div class="zr"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-label="Subject"><circle cx="12" cy="4.5" r="2.2" fill="#fff"/><path d="M12 8v6M12 9.5 8.5 12M12 9.5l3.5 2.5M12 14l-3 7M12 14l3 7"/></svg></div>',iconSize:[38,38]}),zIndexOffset:1000,interactive:false}).addTo(gm_);
    else if(!gm_.hasLayer(rd))rd.addTo(gm_);
    if(!zf&&fol.checked){gm_.setView(to,Math.max(gm_.getZoom(),15),{animate:false});zf=true}
    const el=rd.getElement(),ar=el&&el.querySelector('.ra');if(ar&&q)ar.style.transform=`rotate(${bear(A,to)}deg)`;
    cancelAnimationFrame(anim);cL.clearLayers();window._busy=false;if(el)el.style.opacity='';
    if(!q){rd.setLatLng(to);rpos=to;return}
    const dur=cm?Math.max(1500,Math.min(2800,+$('sp').value*2)):Math.max(200,Math.min(1800,+$('sp').value*.95));let hd,tr=[];
    if(cm){window._busy=true;if(el)el.style.opacity=0;
      tr=[...Array(16)].map((_,i)=>L.circleMarker(A,{radius:7-i*.35,stroke:false,fillColor:SC[gx],fillOpacity:.75*(1-i/16),interactive:false}).addTo(cL));
      hd=L.marker(A,{icon:L.divIcon({className:'',html:`<div class="cmt ${gx==2?'r':''}"></div>`,iconSize:[16,16]}),interactive:false}).addTo(cL).bindTooltip(lab,{permanent:true,direction:'right',offset:[12,0]});
      if(fol.checked)gm_.fitBounds(L.latLngBounds([A,to]),{padding:[70,70],maxZoom:12})}
    const t0=performance.now()+(cm&&fol.checked?700:0);
    const done=()=>{cL.clearLayers();const e2=rd.getElement();if(e2)e2.style.opacity='';rd.setLatLng(to);
      if(cm){const rp=L.marker(to,{icon:L.divIcon({className:'',html:`<div class="rp ${gx==2?'r':''}"></div>`,iconSize:[12,12]}),interactive:false}).addTo(cL);setTimeout(()=>cL.removeLayer(rp),1700);
        if(fol.checked)gm_.flyTo(to,15,{duration:1.2});setTimeout(()=>{window._busy=false},fol.checked?1300:300)}};
    const f=now=>{const fl=$('fol');if(!fl)return;const r=Math.min(1,Math.max(0,(now-t0)/dur)),u=cm?r*r*(3-2*r):r,p=P(u);
      rpos=p;if(cm){hd.setLatLng(p);tr.forEach((m,i)=>m.setLatLng(P(Math.max(0,u-i*.03))))}else rd.setLatLng(p);
      {const n=P.n||20;lp.setLatLngs([...Array(n+1)].map((_,i)=>P(u*i/n)))};
      if(!cm&&fl.checked)gm_.panTo(p,{animate:false});
      if(r<1)anim=requestAnimationFrame(f);else done()};
    anim=requestAnimationFrame(f)};
  const draw=()=>{
    const N=+$('sl').value,S=steps.slice(0,N),cur=S[S.length-1];
    let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:460px;background:var(--bg);border:1px solid var(--line);border-radius:6px"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="var(--acc)"/></marker></defs>`;
    for(let i=0;i<=4;i++){const la_=minLa+(maxLa-minLa)*i/4,lo_=minLo+(maxLo-minLo)*i/4;s+=`<line x1="${pad/2}" x2="${W-pad/2}" y1="${Y(la_)}" y2="${Y(la_)}" stroke="var(--line)"/><text x="4" y="${Y(la_)-2}">${la_.toFixed(3)}°N</text><line y1="${pad/2}" y2="${H-pad/2}" x1="${X(lo_)}" x2="${X(lo_)}" stroke="var(--line)"/><text x="${X(lo_)+2}" y="${H-4}">${lo_.toFixed(3)}°E</text>`}
    T_.forEach(t=>{s+=`<circle cx="${X(t.lon)}" cy="${Y(t.lat)}" r="${28}" fill="var(--acc)" opacity=".08" stroke="var(--acc)" stroke-dasharray="2 3"/><circle cx="${X(t.lon)}" cy="${Y(t.lat)}" r="4" fill="var(--mut)"/><text x="${X(t.lon)+6}" y="${Y(t.lat)+14}" style="font-size:10px">${esc(t.addr||t.cell)}</text>`});
    for(let i=1;i<S.length;i++)s+=`<line x1="${X(S[i-1].lon)}" y1="${Y(S[i-1].lat)}" x2="${X(S[i].lon)}" y2="${Y(S[i].lat)}" stroke="var(--acc)" stroke-width="2" marker-end="url(#ah)"/>`;
    S.forEach((p,i)=>{s+=`<circle cx="${X(p.lon)}" cy="${Y(p.lat)}" r="9" fill="var(--brand)" stroke="${p===cur?'var(--acc)':'var(--mut)'}" stroke-width="2"/><text x="${X(p.lon)}" y="${Y(p.lat)+4}" text-anchor="middle" style="fill:#fff;font-size:10px">${i+1}</text>`});
    s+='</svg>';
    $('sn').textContent=cur?`Step ${S.length}/${steps.length} · ${cur.date} ${cur.time}`:'';mapDraw(S,cur);
    let tb='<div class="tw" style="margin-top:10px"><table><thead><tr><th>#</th><th>Date / time</th><th>Tower</th><th>Address</th><th>Km from prev</th><th>Km/h</th><th>Map</th></tr></thead><tbody>';
    S.forEach((p,i)=>{const q=S[i-1],km=q?hv(q,p):0,hr=q?(p.t-q.t)/36e5:0,sp=q&&hr>0?km/hr:0;
      tb+=`<tr class="${sp>120?'hl':''}"><td>${i+1}</td><td>${p.date} ${p.time}</td><td>${esc(p.cell)}</td><td>${esc(p.addr)}</td><td>${q?km.toFixed(2):'–'}</td><td>${q?sp.toFixed(0)+(sp>120?' ⚠':''):'–'}</td><td><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=16/${p.lat}/${p.lon}">OSM</a> · <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${p.lat},${p.lon}">Google</a></td></tr>`});
    tb+='</tbody></table></div><p class="note">Highlighted rows: implied speed above 120 km/h (check for cloned SIM, mis-timed record, or two devices).</p>';
    const kml='<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.earth.google.com/kml/2.2"><Document>'+S.map((p,i)=>`<Placemark><name>${i+1}. ${esc(p.addr||p.cell)}</name><description>${p.date} ${p.time}</description><Point><coordinates>${p.lon},${p.lat},0</coordinates></Point></Placemark>`).join('')+`<Placemark><name>Path</name><LineString><coordinates>${S.map(p=>p.lon+','+p.lat+',0').join(' ')}</coordinates></LineString></Placemark></Document></kml>`;
    const gm='https://www.google.com/maps/dir/'+S.slice(-10).map(p=>p.lat+','+p.lon).join('/'),gb=`<p style="margin:8px 0"><a class="btn" style="text-decoration:none;display:inline-block" target="_blank" rel="noopener" href="${gm}">Open path in Google Maps${S.length>10?' (last 10 steps)':''}</a></p>`;
    $('sr').innerHTML=s+gb+tb+`<details style="margin-top:8px"><summary>KML for Google Earth (copy into a .kml file)</summary><textarea readonly style="min-height:110px">${esc(kml)}</textarea></details>`;
  };
  $('go').onclick=()=>{const T=$('tg').value,L=ok.filter(r=>r.a==T).map(r=>({...r,lat:+r.lat,lon:+r.lon,t:ts(r)})).sort((x,y)=>x.t-y.t);
    steps=L.filter((p,i)=>i==0||p.cell!=L[i-1].cell);const sl=$('sl');sl.max=Math.max(steps.length,1);sl.value=steps.length;
    if(!steps.length){$('sr').innerHTML='<p class="note">No located records for this number as A-party.</p>';return}draw();prefetch()};
  $('sl').oninput=()=>steps.length&&draw();
  $('pl').onclick=()=>{const sl=$('sl');if(window._tm){clearInterval(window._tm);window._tm=0;$('pl').textContent='▶ Play';return}
    if(!steps.length)return;if(+sl.value>=steps.length)sl.value=1;draw();$('pl').textContent='⏸ Pause';
    window._tm=setInterval(()=>{if(window._busy)return;if(+sl.value>=steps.length){clearInterval(window._tm);window._tm=0;$('pl').textContent='▶ Play';return}sl.value=+sl.value+1;draw()},+$('sp').value)};
  {const pk=window._pick||(cur()||{}).suspect;window._pick=0;if(pk&&[...$('tg').options].some(o=>o.value==pk))$('tg').value=pk}
  $('go').onclick();
  try{(function(){if(!hasL)return;
   const gp=document.createElement('div');gp.id='gxp';
   gp.innerHTML=`<h3 class="gh">Geospatial intelligence</h3><div class="row"><button class="btn g on" data-lay="heat">Tower heat</button><button class="btn g" data-lay="cov">Coverage</button><button class="btn g on" data-lay="anc">Anchors</button><button class="btn g on" data-lay="pre">Prediction</button><button class="btn g" id="gfe">◎ Place geofence</button><label class="note">Radius <input type="range" id="gfr" min="1" max="50" value="5" style="width:110px"> <b id="gfv">5 km</b></label><button class="btn g" id="gej">Export GeoJSON</button></div><div id="gkp" class="row"></div><div id="gfo"></div><div class="gtb"><div id="gdw"></div><div id="gco"></div></div>`;
   $('main').append(gp);
   const LY={heat:L.layerGroup().addTo(gm_),cov:L.layerGroup(),anc:L.layerGroup().addTo(gm_),pre:L.layerGroup().addTo(gm_),fen:L.layerGroup().addTo(gm_)};
   T_.forEach(t=>{L.circle([t.lat,t.lon],{radius:250+Math.sqrt(t.n)*260,stroke:false,fillColor:'#ff3b6b',fillOpacity:.22,interactive:false}).addTo(LY.heat);L.circle([t.lat,t.lon],{radius:1500,color:'#38b6ff',weight:1,dashArray:'4 6',fillOpacity:.04,interactive:false}).addTo(LY.cov)});
   const BL={'Dark ops (street)':window._street,'Satellite hybrid':L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{subdomains:'0123',maxZoom:20,attribution:'© Google'}),'OSM dark (CARTO)':L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{subdomains:'abcd',maxZoom:19,attribution:'© OpenStreetMap © CARTO'})};
   L.control.layers(BL,{'Tower heat':LY.heat,'Coverage (indicative 1.5 km)':LY.cov,'Anchors':LY.anc,'Predicted move':LY.pre,'Geofence':LY.fen},{collapsed:true}).addTo(gm_);L.control.scale({imperial:false}).addTo(gm_);
   gp.querySelectorAll('[data-lay]').forEach(b=>b.onclick=()=>{const g=LY[b.dataset.lay];if(gm_.hasLayer(g))gm_.removeLayer(g);else g.addTo(gm_);b.classList.toggle('on',gm_.hasLayer(g))});
   const tinfo={};T_.forEach(t=>tinfo[t.cell]=t);const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
   const ana=()=>{LY.anc.clearLayers();LY.pre.clearLayers();const T=$('tg').value;
    const R=ok.filter(r=>r.a==T).map(r=>({...r,lat:+r.lat,lon:+r.lon,t:ts(r)})).sort((x,y)=>x.t-y.t);
    if(!R.length){$('gkp').innerHTML='';$('gdw').innerHTML='';$('gco').innerHTML='';return}
    const dw={},cnt={};R.forEach((r,i)=>{const nx=R[i+1],d=nx?Math.min(nx.t-r.t,6*36e5):0;dw[r.cell]=(dw[r.cell]||0)+d;cnt[r.cell]=(cnt[r.cell]||0)+1});
    const hr=r=>+String(r.time).slice(0,2),nc={},dc={};R.forEach(r=>{const h=hr(r);if(h>=22||h<6)nc[r.cell]=(nc[r.cell]||0)+1;else if(h>=9&&h<18)dc[r.cell]=(dc[r.cell]||0)+1});
    const mk=(cell,label,col)=>{const t=tinfo[cell];if(!t)return;L.marker([t.lat,t.lon],{icon:L.divIcon({className:'',html:`<div class="anc" style="border-color:${col};color:${col}">${label}</div>`,iconSize:[110,22],iconAnchor:[55,-6]}),interactive:false}).addTo(LY.anc);L.circle([t.lat,t.lon],{radius:700,color:col,weight:2,fillOpacity:.08,interactive:false}).addTo(LY.anc)};
    const na=top(nc)[0],da=top(dc)[0];if(na)mk(na[0],'NIGHT ANCHOR','#a78bfa');if(da)mk(da[0],'DAY ANCHOR','#19d3a2');
    const seq=R.filter((r,i)=>i==0||r.cell!=R[i-1].cell),tr={};for(let i=1;i<seq.length;i++){const a=seq[i-1].cell,b=seq[i].cell;(tr[a]=tr[a]||{})[b]=(tr[a][b]||0)+1}
    const last=seq[seq.length-1],nxt=tr[last.cell]?top(tr[last.cell]):[];let pre='insufficient movement history';
    if(nxt.length){const tot=nxt.reduce((s,x)=>s+x[1],0),t=tinfo[nxt[0][0]];if(t){const pr=Math.round(nxt[0][1]/tot*100);pre=`${esc(t.addr||t.cell)} (${pr}% · ${nxt[0][1]}/${tot} past moves)`;L.polyline([[last.lat,last.lon],[t.lat,t.lon]],{color:'#19d3a2',weight:3,dashArray:'3 9',interactive:false}).addTo(LY.pre);L.circle([t.lat,t.lon],{radius:900,color:'#19d3a2',weight:2,dashArray:'6 6',fillOpacity:.1}).bindTooltip('Predicted next · '+pr+'%',{permanent:true,direction:'top'}).addTo(LY.pre)}}
    let km=0,an=0;for(let i=1;i<seq.length;i++){const d=hv(seq[i-1],seq[i]),h=(seq[i].t-seq[i-1].t)/36e5;km+=d;if(h>0&&d/h>RULES.speed)an++}
    const regs=uniq(seq.map(r=>regName(reg(r))));
    $('gkp').innerHTML=`<span class="tag">Tower Vector: ${km.toFixed(1)} km (Cell Site, Not GPS Track)</span><span class="tag">${Object.keys(cnt).length} towers</span><span class="tag">${regs.length} region(s)</span><span class="tag" style="${an?'color:#ff3b6b':''}">${an} impossible-travel</span><span class="tag">Night anchor: ${na?esc((tinfo[na[0]]||{}).addr||na[0]):'–'}</span><span class="tag">Day anchor: ${da?esc((tinfo[da[0]]||{}).addr||da[0]):'–'}</span><span class="tag" style="color:#19d3a2">Predicted next: ${pre}</span>`;
    const tot=Object.values(dw).reduce((a,b)=>a+b,0)||1;
    $('gdw').innerHTML=`<b>Dwell analysis</b><div class="tw"><table><thead><tr><th>Tower</th><th>Rec</th><th>Dwell</th><th>Share</th></tr></thead><tbody>${top(dw).slice(0,6).map(([c,v])=>`<tr data-fly="${esc(c)}" style="cursor:pointer"><td>${esc((tinfo[c]||{}).addr||c)}</td><td>${cnt[c]}</td><td>${(v/36e5).toFixed(1)} h</td><td>${Math.round(v/tot*100)}%</td></tr>`).join('')}</tbody></table></div>`;
    $('gdw').querySelectorAll('[data-fly]').forEach(r=>r.onclick=()=>{const t=tinfo[r.dataset.fly];if(t)gm_.flyTo([t.lat,t.lon],15,{duration:.8})});
    const near={};R.forEach(r=>{(near[r.cell]=near[r.cell]||[]).push(r.t)});const co={};
    ok.forEach(r=>{if(r.a==T)return;const ar=near[r.cell];if(!ar)return;const t=ts(r);if(ar.some(x=>Math.abs(x-t)<=RULES.coloc*6e4)){const c=co[r.a]=co[r.a]||{n:0,cells:new Set()};c.n++;c.cells.add(r.cell)}});
    const cl=Object.entries(co).sort((a,b)=>b[1].n-a[1].n).slice(0,8);
    $('gco').innerHTML=`<b>Co-location (±30 min, same tower)</b><div class="tw"><table><thead><tr><th>Number</th><th>Hits</th><th>Towers</th><th></th></tr></thead><tbody>${cl.map(([n,o])=>`<tr><td>${esc(n)}</td><td>${o.n}</td><td>${o.cells.size}</td><td><a href="#" data-trk2="${esc(n)}">Track</a></td></tr>`).join('')||'<tr><td colspan="4">No co-located numbers</td></tr>'}</tbody></table></div>`;
    $('gco').querySelectorAll('[data-trk2]').forEach(a=>a.onclick=e=>{e.preventDefault();const sel=$('tg');if([...sel.options].some(o=>o.value==a.dataset.trk2)){sel.value=a.dataset.trk2;$('go').onclick()}else alert('That number has no outgoing located records.')})};
   let fc=null,fm=false;
   $('gfe').onclick=()=>{fm=!fm;$('gfe').classList.toggle('on',fm);$('gfo').innerHTML=fm?'<p class="note">Click the map to place the geofence centre…</p>':''};
   const drawF=()=>{LY.fen.clearLayers();if(!fc)return;const rad=+$('gfr').value;$('gfv').textContent=rad+' km';L.circle(fc,{radius:rad*1000,color:'#ff3b6b',weight:2,dashArray:'8 6',fillOpacity:.08}).addTo(LY.fen);
    const ins=ok.filter(r=>hv({lat:+r.lat,lon:+r.lon},{lat:fc.lat,lon:fc.lng})<=rad),by={};ins.forEach(r=>{const st=r.date+' '+r.time,o=by[r.a]=by[r.a]||{n:0,t0:st,t1:st};o.n++;if(st<o.t0)o.t0=st;if(st>o.t1)o.t1=st});
    const L2=Object.entries(by).sort((a,b)=>b[1].n-a[1].n).slice(0,10);
    $('gfo').innerHTML=`<div class="note"><b>Geofence ${rad} km</b> · ${Object.keys(by).length} subscribers · ${ins.length} records</div><div class="tw"><table><thead><tr><th>Subscriber</th><th>Records</th><th>First seen</th><th>Last seen</th></tr></thead><tbody>${L2.map(([a,o])=>`<tr><td>${esc(a)}</td><td>${o.n}</td><td>${o.t0}</td><td>${o.t1}</td></tr>`).join('')||'<tr><td colspan="4">No activity inside the fence</td></tr>'}</tbody></table></div>`};
   gm_.on('click',e=>{if(!fm)return;fc=e.latlng;fm=false;$('gfe').classList.remove('on');drawF()});$('gfr').oninput=drawF;
   $('gej').onclick=()=>{const T=$('tg').value,R=ok.filter(r=>r.a==T).map(r=>({...r,t:ts(r)})).sort((x,y)=>x.t-y.t);const gj={type:'FeatureCollection',features:[{type:'Feature',properties:{target:T,kind:'path'},geometry:{type:'LineString',coordinates:R.map(r=>[+r.lon,+r.lat])}}].concat(T_.map(t=>({type:'Feature',properties:{kind:'tower',cell:t.cell,addr:t.addr,records:t.n},geometry:{type:'Point',coordinates:[t.lon,t.lat]}})))};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(gj,null,1)],{type:'application/geo+json'}));a.download='geoint-'+T+'.geojson';a.click()};
   const g0=$('go').onclick;$('go').onclick=()=>{g0();try{ana()}catch(e){}};ana();
  })()}catch(err){console.error('geo+',err)}
},
graph(){
  $('main').innerHTML=head('Relationship graph','Ego network of a target: top contacts and links between them.')+
  `<div class="row"><select id="tg">${numOpts()}</select><button class="btn" id="go">Draw</button></div><div id="sr"></div>`;
  $('go').onclick=()=>{
    const T=$('tg').value,c={};rows.forEach(r=>{if(r.a==T)c[r.b]=(c[r.b]||0)+1;if(r.b==T)c[r.a]=(c[r.a]||0)+1});
    const top=Object.entries(c).sort((x,y)=>y[1]-x[1]).slice(0,14),W=640,H=420,cx=W/2,cy=H/2,P={};
    top.forEach(([n],i)=>{const a=i/top.length*6.283;P[n]=[cx+Math.cos(a)*165*1.4,cy+Math.sin(a)*165]});
    const link={};rows.forEach(r=>{if(P[r.a]&&P[r.b]){const k=[r.a,r.b].sort().join('|');link[k]=(link[k]||0)+1}});
    let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:440px">`;
    top.forEach(([n,v])=>{s+=`<line x1="${cx}" y1="${cy}" x2="${P[n][0]}" y2="${P[n][1]}" stroke="var(--acc)" stroke-width="${1+v/4}" opacity=".55"/>`});
    Object.keys(link).forEach(k=>{const[a,b]=k.split('|');s+=`<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" stroke="var(--mut)" stroke-dasharray="3 3"/>`});
    top.forEach(([n,v])=>{s+=`<circle cx="${P[n][0]}" cy="${P[n][1]}" r="${6+v/3}" fill="var(--brand)" stroke="var(--acc)"/><text x="${P[n][0]}" y="${P[n][1]-12-v/3}" text-anchor="middle">${n.slice(-6)} (${v})</text>`});
    s+=`<circle cx="${cx}" cy="${cy}" r="18" fill="var(--acc)"/><text x="${cx}" y="${cy+32}" text-anchor="middle">${T}</text></svg>`;
    $('sr').innerHTML=s+'<p class="note">Solid lines: calls with target (thickness = count). Dashed: contacts who also call each other.</p>'};
  $('go').onclick();
}};
function stage(v){const i=VIEWS.findIndex(x=>x[1]==v),x=VIEWS[i],h=document.querySelector('main h2'),q=document.querySelector('main .sub');if(h)h.textContent=x[2];if(q)q.textContent=x[3];
$('crumb').innerHTML=`<div class="n">${String(i+1).padStart(2,'0')}</div><div><small>Phase ${x[0].replace(' · ',' — ')}</small><span>Stage ${i+1} of ${VIEWS.length}</span><div class="pr"><i style="width:${(i+1)/VIEWS.length*100}%"></i></div></div>`;
const p=VIEWS[i-1],n=VIEWS[i+1];$('pager').innerHTML=(p?`<button data-v="${p[1]}"><small>◂ Previous stage</small>${p[2]}</button>`:'<span></span>')+(n?`<button class="nx" data-v="${n[1]}"><small>Next stage ▸</small>${n[2]}</button>`:'');
document.querySelectorAll('#pager button').forEach(b=>b.onclick=()=>{go(b.dataset.v);scrollTo({top:0,behavior:'smooth'})})}
let alerts=[],ilog=[];
function hav(a,b){const r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dn=r(b.lon-a.lon),h=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dn/2)**2;return 12742*Math.asin(Math.sqrt(h))}
function liveBody(){const e=$('lv');if(!e)return;e.innerHTML='<h3 style="margin:12px 0 4px">Alerts ('+alerts.length+')</h3>'+(alerts.length?alerts.slice(0,20).map(a=>'<div class="tag" style="display:block;border-radius:6px">⚠ '+esc(a)+'</div>').join(''):'<p class="note">No alerts yet.</p>')+'<h3 style="margin:12px 0 4px">Last ingested records</h3>'+(ilog.length?table(ilog,new Set(ilog)):'<p class="note">Nothing ingested yet.</p>')}
function ingest(n,src){
  const key=r=>[r.a,r.b,r.date,r.time].join('|'),seen=new Set(rows.map(key)),add=[];
  n.sort((x,y)=>ts(x)-ts(y)).forEach(r=>{
    if(seen.has(key(r)))return;
    let p=null;for(let i=rows.length-1;i>=0;i--)if(rows[i].a==r.a&&ts(rows[i])<=ts(r)){p=rows[i];break}
    const al=m=>alerts.unshift(new Date().toLocaleTimeString()+' · '+r.a+' · '+m);
    if(rows.some(x=>x.a==r.a)){
      if(r.imei&&!rows.some(x=>x.a==r.a&&x.imei==r.imei))al('new IMEI '+r.imei);
      if(r.cell&&!rows.some(x=>x.a==r.a&&x.cell==r.cell))al('first time on tower '+(r.addr||r.cell));
      if(p&&p.lat!==''&&r.lat!==''&&isFinite(+p.lat)&&isFinite(+r.lat)){const km=hav({lat:+p.lat,lon:+p.lon},{lat:+r.lat,lon:+r.lon}),hr=(ts(r)-ts(p))/36e5;if(hr>0&&km/hr>120)al('impossible speed '+Math.round(km/hr)+' km/h ('+km.toFixed(1)+' km)')}
    }
    rows.push(r);seen.add(key(r));add.push(r)});
  if(!add.length)return;
  rows.sort((x,y)=>ts(x)-ts(y));ilog=add.concat(ilog).slice(0,15);alerts=alerts.slice(0,40);
  stats();$('src').textContent=src+' (+'+add.length+')';
  if(view=='live')liveBody();
}
function simRec(){
  const last=rows.reduce((m,r)=>Math.max(m,ts(r)),0)||Date.now(),d=new Date(last+(20+Math.random()*300)*1000),p=x=>String(x).padStart(2,'0'),base=rows[Math.floor(Math.random()*rows.length)];
  const tw=uniq(rows.map(r=>r.cell)).map(c=>rows.find(r=>r.cell==c)),t=Math.random()<.15?{cell:'40-10-2231-9999',addr:'Jaipur Bypass (sim)',lat:26.91,lon:75.78}:tw[Math.floor(Math.random()*tw.length)];
  return {a:base.a,b:base.b,date:d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()),time:p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()),dur:Math.floor(Math.random()*400),type:'Voice',imei:Math.random()<.1?'35'+Math.floor(Math.random()*1e13):base.imei,imsi:base.imsi,cell:t.cell,addr:t.addr,lat:t.lat,lon:t.lon};
}
function go(v){clearInterval(window._tm);window._tm=0;window._busy=false;view=v;{const ci=VIEWS.findIndex(x=>x[1]==v);$('nav').innerHTML=VIEWS.map((x,i)=>(i==0||VIEWS[i-1][0]!=x[0]?`<h4><em>${x[0].split(' · ')[0]}</em>${x[0].split(' · ')[1]}</h4>`:'')+`<button class="${i==ci?'on':i<ci?'done':''}" data-v="${x[1]}"><i></i><b>${String(i+1).padStart(2,'0')}</b><span>${x[2]}</span></button>`).join('')}
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.v));V[v]();stage(v)}
function load(d,label){rows=d;if(cur())cur().rows=d;colF={};$('src').textContent=label;stats();go('records')}
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>load(parseCSV(r.result),f.name);r.readAsText(f)};
$('sample').onclick=()=>initCases();
$('exp').onclick=()=>{const csv=[COLS.map(k=>LBL[k]).join(',')].concat(shown.map(r=>COLS.map(k=>sanitizeCsvCell(r[k])).join(','))).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='cdr-view.csv';a.click()};
/* ===== Phase IV: Investigation ===== */
VIEWS.push(['IV · Investigation','corr','Evidence Correlation Engine','Fuse device, tower, contact and time evidence from every source into scored cross-links.'],['IV · Investigation','kg','AI Knowledge Graph','Relational graph of subjects, devices and towers, ranked by AI risk score. Click a node to inspect it.'],['IV · Investigation','recon','Crime Reconstruction Dashboard','Replay the digital crime scene across space and time.'],['IV · Investigation','seq','Event-Sequence Generator','Automatically generated chronology of what happened, in order.'],['IV · Investigation','card','AI Suspect Card','Live AI dossier of the selected subject, redrafted as evidence changes.']);
let SEL=null;
const deg=()=>{const m={};rows.forEach(r=>{m[r.a]=(m[r.a]||0)+1;m[r.b]=(m[r.b]||0)+1});return m};
const defSel=()=>{if(SEL&&rows.some(r=>r.a==SEL||r.b==SEL))return SEL;const c=cur();SEL=c&&c.suspect||Object.entries(deg()).sort((x,y)=>y[1]-x[1])[0]?.[0]||'';return SEL};
const hv=rs=>{const h=Array(8).fill(0);rs.forEach(r=>{h[Math.min(7,(+String(r.time).slice(0,2)||0)/3|0)]++});const t=rs.length||1;return h.map(x=>x/t)};
const MO_ARCHETYPES = [
  { name: 'MO: Impersonation / Digital Arrest Ring', type: 'archetype', desc: 'High nocturnal ratio, wide victim fan-out, marathon coaching calls, multi-circle hops', raw: [0.85, 0.40, 0.50, 0.70, 0.75, 0.85, 0.40, 0.80, 0.90, 0.70, 0.05, 0.02, 0.04, 0.12, 0.22, 0.22, 0.20, 0.13] },
  { name: 'MO: Loan-App Extortion Syndicate', type: 'archetype', desc: 'Extreme contact fan-out, heavy short-burst pings (<25s), multi-device churn', raw: [1.00, 0.75, 0.80, 0.50, 0.35, 0.20, 0.88, 0.05, 0.95, 0.45, 0.02, 0.02, 0.08, 0.26, 0.32, 0.20, 0.08, 0.02] },
  { name: 'MO: Hawala Layering & Cross-Border Routing', type: 'archetype', desc: 'Bilateral coordination dyads, cross-border hops, multi-SIM rotation on static hardware', raw: [0.45, 0.70, 0.85, 0.95, 0.55, 0.45, 0.30, 0.35, 0.60, 0.85, 0.15, 0.05, 0.08, 0.12, 0.22, 0.20, 0.12, 0.06] },
  { name: 'MO: Automated SIM Farm / Ping Botnet', type: 'archetype', desc: '100% outbound, strict duration invariance, stationary tower, zero reciprocity', raw: [0.95, 0.90, 0.90, 0.10, 0.80, 0.10, 0.95, 0.00, 0.98, 0.10, 0.12, 0.12, 0.12, 0.12, 0.14, 0.14, 0.12, 0.12] }
];
MO_ARCHETYPES.forEach(a => {
  let nm = 0;
  for (let i = 0; i < a.raw.length; i++) nm += a.raw[i] * a.raw[i];
  nm = Math.sqrt(nm) || 1;
  a.vec = new Float32Array(a.raw.length);
  for (let i = 0; i < a.raw.length; i++) a.vec[i] = a.raw[i] / nm;
});

function bvec(n, rs) {
  const R = rs.filter(r => r.a == n || r.b == n), O = R.filter(r => r.a == n);
  if (!O.length) return null;
  const u = f => uniq(O.map(f)).length, ct = uniq(R.map(r => r.a == n ? r.b : r.a)).length;
  const loc = O.filter(r => isFinite(parseFloat(r.lat))).map(r => ({ ...r, lat: +r.lat, lon: +r.lon, t: ts(r) })).sort((x, y) => x.t - y.t);
  let hop = 0, st = 0, co = 0;
  loc.forEach((q, i) => {
    if (i && q.cell != loc[i - 1].cell) {
      const g = seg(loc[i - 1], q);
      if (g == 1) st++;
      if (g == 2) co++;
      hop += g;
    }
  });
  const dur = O.reduce((a, r) => a + (+r.dur || 0), 0) / O.length;
  const shortBurst = O.filter(r => (+r.dur || 0) < 25).length / O.length;
  const longSession = O.filter(r => (+r.dur || 0) > 300).length / O.length;
  const nightRatio = O.filter(r => isNight(+String(r.time).slice(0, 2))).length / O.length;
  const outRatio = O.length / R.length;
  const h = hv(O);
  const raw = [
    Math.min(1, ct / 15),
    Math.min(1, Math.max(0, u(r => r.imei) - 1) / 3),
    Math.min(1, Math.max(0, u(r => r.imsi) - 1) / 3),
    Math.min(1, (st * 1.5 + co * 3) / 6),
    nightRatio,
    Math.min(1, Math.log1p(dur) / Math.log(1801)),
    shortBurst,
    longSession,
    outRatio,
    Math.min(1, u(r => r.cell) / Math.max(1, loc.length)),
    ...h
  ];
  let nm = 0;
  for (let i = 0; i < raw.length; i++) nm += raw[i] * raw[i];
  nm = Math.sqrt(nm) || 1;
  const vec = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) vec[i] = raw[i] / nm;
  return { n, vec, raw, f: raw.slice(0, 7), h, ct, dur, nightRatio, shortBurst, longSession, st, co };
}

function vecCosine(a, b) {
  if (!a || !b) return 0;
  const va = a.vec || a, vb = b.vec || b;
  if (!va || !vb) return 0;
  let dot = 0, len = Math.min(va.length, vb.length);
  for (let i = 0; i < len; i++) dot += va[i] * vb[i];
  return Math.max(0, Math.min(1, dot));
}

function searchVectorSimilarity(bv, n) {
  if (!bv) return { sim: 0, simTo: '–', topMatch: null, matches: [] };
  const candidates = [];
  refV().forEach(x => {
    if (x.n != n && x.v) candidates.push({ name: 'Suspect ' + x.n + ' (' + x.fir + ')', id: x.n, type: 'suspect', v: x.v });
  });
  MO_ARCHETYPES.forEach(a => {
    candidates.push({ name: a.name, id: null, type: 'archetype', desc: a.desc, v: a });
  });
  const ranked = candidates.map(c => ({ ...c, sim: Math.round(vecCosine(bv, c.v) * 100) })).sort((a, b) => b.sim - a.sim);
  const top = ranked[0] || { name: '–', id: null, type: '', sim: 0 };
  return { sim: top.sim, simTo: top.name, topMatch: top, matches: ranked.slice(0, 5) };
}
const bsim=(a,b)=>.5*(1-a.f.reduce((t,x,i)=>t+Math.abs(x-b.f[i]),0)/a.f.length)+.5*a.h.reduce((t,x,i)=>t+Math.min(x,b.h[i]),0);
let _rv={k:'',v:[]};const refV=()=>{const k=CASES.map(c=>c.id+c.rows.length+c.suspect).join();if(_rv.k!=k)_rv={k,v:CASES.filter(c=>c.suspect).map(c=>({n:c.suspect,fir:c.fir,v:bvec(c.suspect,c.rows)})).filter(x=>x.v)};return _rv.v};
let _ow={};function ownC(){if(_ow.r!==rows||_ow.n!==rows.length)_ow={r:rows,n:rows.length,imei:owners('imei',.4),imsi:owners('imsi',.4)};return _ow}
function prof(n){const R=rows.filter(r=>r.a==n||r.b==n),O=R.filter(r=>r.a==n),oc=ownC(),im=uniq(O.map(r=>r.imei)).filter(x=>!x||(oc.imei[x]||[]).includes(n)),is=uniq(O.map(r=>r.imsi)).filter(x=>!x||(oc.imsi[x]||[]).includes(n)),tw=uniq(O.map(r=>r.cell)),ct=uniq(R.map(r=>r.a==n?r.b:r.a));
 const night=O.filter(r=>isNight(+String(r.time).slice(0,2))).length;
 const loc=O.filter(r=>isFinite(parseFloat(r.lat))).map(r=>({...r,lat:+r.lat,lon:+r.lon,t:ts(r)})).sort((x,y)=>x.t-y.t);
 let st=0,co=0;loc.forEach((p,i)=>{if(i&&p.cell!=loc[i-1].cell){const g=seg(loc[i-1],p);if(g==1)st++;if(g==2)co++}});
 const c=cur(),sus=!!c&&c.suspect==n,f=[];let s=0;const add=(k,w,t)=>{if(k){s+=w;f.push(t)}};
 add(im.length>1,RULES.w.hs,im.length+' handsets used');add(is.length>1,RULES.w.sim,is.length+' SIMs rotated');add(st>0,RULES.w.st,st+' interstate hops');add(co>0,RULES.w.co,co+' cross-border hops');add(O.length>0&&night/O.length>RULES.nightShare/100,RULES.w.night,'night-time activity');add(ct.length>RULES.ctMin,RULES.w.ct,ct.length+' distinct contacts');add(sus,RULES.w.sus,'named subject of case');
 {const In=R.filter(r=>r.b==n&&r.a!=n),cin=uniq(In.map(r=>r.a)),avg=In.length?In.reduce((s,r)=>s+(+r.dur||0),0)/In.length:0;
  add(cin.length>=RULES.fanMin&&avg<=RULES.fanDur,RULES.w.fan,'mule-like fan-in: '+cin.length+' different callers, avg '+Math.round(avg)+' s');
  const it=In.map(ts).sort((x,y)=>x-y);let pt=0;O.forEach(r=>{const t=ts(r);if(it.some(x=>x<t&&t-x<=10*6e4))pt++});
  add(In.length>=10&&pt>=5,RULES.w.pass,pt+' outbound events within 10 min of an inbound call (pass-through)')}
 const bv=bvec(n,rows),VS=searchVectorSimilarity(bv,n),sim=VS.sim,simTo=VS.simTo;
 const risk=Math.min(100,s+Math.min(10,O.length/3|0)),nf=f.length,fusion=RULES.fusion=='linear'?'linear':'synergy';
 let bonus=0,syn=0;
 if(fusion=='linear'){if(sim>=RULES.simCut){const al=Math.min(1,Math.max(0,RULES.blendW/100)),bl=Math.round(risk*(1-al)+sim*al);bonus=Math.min(RULES.simMax,Math.max(-RULES.simMax,bl-risk))}}
 else{bonus=Math.min(RULES.simMax,Math.max(0,(sim-RULES.simCut)/2|0));if(bonus>0&&nf>=2)syn=Math.min(RULES.synMax,Math.round(nf*(risk/100)*(sim-RULES.simCut)/10))}
 if(bonus>0)f.push('behaviour '+sim+'% similar to '+simTo);if(syn>0)f.push('convergence: '+nf+' rule flags reinforced by vector match (+'+syn+')');
 return{n,R,O,im,is,tw,ct,night,loc,st,co,sus,f,risk,sim,simTo,bonus,syn,fusion,topMatch:VS.topMatch,matches:VS.matches,score:Math.min(100,Math.max(0,risk+bonus+syn)),reg:trk({rows:O,suspect:n}).ch}}
const sg=x=>(x>=0?'+':'')+x;
/* owner of a device/SIM id = the number(s) taking part in a large share of that id's records (a CDR carries the target's IMEI/IMSI on incoming rows too, so A-party alone is not the owner) */
function owners(key,minShare){const by={};rows.forEach(r=>{if(!r[key])return;const g=by[r[key]]=by[r[key]]||{n:0,c:{}};g.n++;new Set([r.a,r.b]).forEach(x=>{if(x)g.c[x]=(g.c[x]||0)+1})});
 const o={};Object.entries(by).forEach(([id,g])=>{o[id]=Object.entries(g.c).filter(([,c])=>c/g.n>=minShare).map(([x])=>x)});return o}
const lvl=s=>s>=RULES.high?['HIGH','#ff3b6b']:s>=RULES.mid?['ELEVATED','#19d3a2']:['LOW','#38b6ff'];
const selBox=()=>`<select id="sel" class="btn g">${uniq(rows.flatMap(r=>[r.a,r.b])).sort().map(n=>`<option ${n==defSel()?'selected':''}>${n}</option>`).join('')}</select>`;
async function aiBrief(p){
  try {
    const s = (typeof sess === 'function') ? sess() : null;
    const consent = sessionStorage.getItem('tcdr_consent_ai');
    if (!consent) {
      const allow = confirm("AI Proxy Privacy Notice: Do you consent to sending this anonymized summary to the server AI proxy for intelligence analysis?");
      if (allow) { sessionStorage.setItem('tcdr_consent_ai', '1'); }
      else { return localBrief(p); }
    }
    const prompt = 'You are a forensic CDR analyst. In under 90 words write an intelligence brief using ONLY these facts: ' + JSON.stringify({number:p.n,calls:p.O.length,contacts:p.ct.length,handsets:p.im.length,sims:p.is.length,towers:p.tw.length,regions:p.reg,flags:p.f,risk:p.score});
    if (!s || !s.sb || !window.sb) return localBrief(p);
    const result = await window.sb.functions.invoke('ai-proxy', { body:{ prompt:prompt, model:'gemini-3.5-flash-lite' } });
    if (result.error) return localBrief(p);
    const d = result.data || {};
    return (d.content && d.content.map(i => i.text || '').join('').trim()) || localBrief(p);
  } catch(e) {
    return localBrief(p);
  }
}
const localBrief=p=>`${p.n} placed ${p.O.length} calls to ${p.ct.length} contacts via ${p.im.length} handset(s) and ${p.is.length} SIM(s), moving ${p.reg.length?p.reg.join(' → '):'without located records'}. ${p.f.length?'Indicators: '+p.f.join('; ')+'.':'No anomaly indicators raised.'} AI risk ${p.score}/100 (${lvl(p.score)[0]}).`;
Object.assign(V,{
corr(){const D=deg(),P=Object.keys(D).sort((a,b)=>D[b]-D[a]).slice(0,12).map(prof),L=[];
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const a=P[i],b=P[j],di=a.im.filter(x=>b.im.includes(x)),tw=a.tw.filter(x=>b.tw.includes(x)),ct=a.ct.filter(x=>b.ct.includes(x)),dir=rows.filter(r=>(r.a==a.n&&r.b==b.n)||(r.a==b.n&&r.b==a.n)).length;
  const src=[di.length&&'Device',tw.length&&'Tower',ct.length&&'Contacts',dir&&'Direct calls'].filter(Boolean),s=Math.min(100,di.length*35+Math.min(tw.length,3)*10+Math.min(ct.length,5)*6+Math.min(dir,5)*8);
  if(s)L.push({a:a.n,b:b.n,s,src,d:`${di.length} shared handset · ${tw.length} shared tower · ${ct.length} common contact · ${dir} direct call`})}
 L.sort((x,y)=>y.s-x.s);
 $('main').innerHTML=head('Evidence Correlation Engine','Every pair is scored across four independent evidence sources. More sources agreeing means a stronger link.')+`<div class="row"><span class="tag">${rows.length} records fused</span><span class="tag">${L.length} correlated pairs</span></div>`+(L.slice(0,14).map(l=>`<div class="bar" data-a="${l.a}"><span style="width:250px">${l.a} ⇄ ${l.b}</span><i style="width:${l.s*2.2}px;background:${lvl(l.s)[1]}"></i><span style="width:auto;color:var(--mut)">${l.s} · ${l.src.join(' + ')}<br><small>${l.d}</small></span></div>`).join('')||'<p class="note">No correlations in this dataset.</p>');
 document.querySelectorAll('.bar[data-a]').forEach(b=>b.onclick=()=>{SEL=b.dataset.a;go('kg')})},
kg(){
 const D=deg(),ids=Object.keys(D).sort((a,b)=>D[b]-D[a]).slice(0,18),idset=new Set(ids),P=ids.map(prof),W=1000,H=620,CP=['#38b6ff','#19d3a2','#a78bfa','#2fd9a0','#f472b6','#60a5fa','#fb923c','#c084fc'];
 if(!P.length){$('main').innerHTML=head('AI Knowledge Graph','Relational graph of subjects, devices and towers.')+'<p class="note">Import a CDR to build the relationship graph.</p>';return}
 const N=[],E=[],ix={},add=n=>{if(!ix[n.id]){ix[n.id]=n;N.push(n)}return ix[n.id]};
 P.forEach(p=>add({id:p.n,t:'p',p,score:p.score,r:9+p.score/8}));
 P.forEach(p=>{p.im.forEach(i=>{add({id:i,t:'d',r:7});E.push({a:p.n,b:i,k:'dev',v:1})});p.tw.slice(0,3).forEach(c=>{add({id:c,t:'w',r:7,addr:(rows.find(r=>r.cell==c)||{}).addr||c});E.push({a:p.n,b:c,k:'tow',v:1})})});
 const w={};rows.forEach(r=>{if(idset.has(r.a)&&idset.has(r.b)&&r.a!=r.b){const k=[r.a,r.b].sort().join('|');w[k]=(w[k]||0)+1}});
 Object.entries(w).forEach(([k,v])=>{const [a,b]=k.split('|');E.push({a,b,k:'call',v})});
 const adj={};N.forEach(n=>adj[n.id]=[]);E.forEach(e=>{adj[e.a].push([e.b,e.v]);adj[e.b].push([e.a,e.v])});
 /* AI layer 1: community detection on the subject graph (hub-aware label propagation) */
 const subs=N.filter(n=>n.t=='p'),sadj={};subs.forEach(n=>sadj[n.id]=[]);
 E.filter(e=>e.k=='call').forEach(e=>{sadj[e.a].push([e.b,e.v]);sadj[e.b].push([e.a,e.v])});
 N.filter(n=>n.t=='d').forEach(d=>{const ss=adj[d.id].map(x=>x[0]).filter(m=>ix[m].t=='p');ss.forEach(a=>ss.forEach(b=>{if(a!=b)sadj[a].push([b,2])}))});
 const hub=subs.slice().sort((a,b)=>new Set(sadj[b.id].map(x=>x[0])).size-new Set(sadj[a.id].map(x=>x[0])).size)[0],useHub=!!hub&&new Set(sadj[hub.id].map(x=>x[0])).size>=subs.length*.6;
 const lab={};subs.forEach((n,i)=>lab[n.id]=i);
 for(let it=0;it<25;it++)subs.forEach(n=>{if(useHub&&n===hub)return;const c={};sadj[n.id].forEach(([m,v])=>{if(useHub&&m===hub.id)return;c[lab[m]]=(c[lab[m]]||0)+v});let best=lab[n.id],bv=0;Object.entries(c).forEach(([l,v])=>{if(v>bv||(v==bv&&+l<best)){bv=v;best=+l}});lab[n.id]=best});
 const sz={};subs.forEach(n=>{if(!(useHub&&n===hub))sz[lab[n.id]]=(sz[lab[n.id]]||0)+1});
 const real=Object.keys(sz).filter(l=>sz[l]>1).map(Number).sort((a,b)=>sz[b]-sz[a]),K=real.length;
 subs.forEach(n=>{n.c=useHub&&n===hub?K+1:real.includes(lab[n.id])?real.indexOf(lab[n.id]):K});
 N.filter(n=>n.t!='p').forEach(n=>{const m=adj[n.id].map(x=>ix[x[0]]).filter(x=>x.t=='p')[0];n.c=m?m.c:K});
 const cname=n=>n.c<K?String.fromCharCode(65+n.c%26):n.c==K?'P':'H';
 const cls=real;
 /* AI layer 2: influence (weighted PageRank) */
 let pr={};N.forEach(n=>pr[n.id]=1/N.length);
 for(let it=0;it<30;it++){const nx={};N.forEach(n=>nx[n.id]=.15/N.length);N.forEach(n=>{const tot=adj[n.id].reduce((s,[,v])=>s+v,0)||1;adj[n.id].forEach(([m,v])=>{nx[m]+=.85*pr[n.id]*v/tot})});pr=nx}
 const mxp=Math.max(...Object.values(pr));N.forEach(n=>n.pr=pr[n.id]/mxp);
 /* force layout */
 N.forEach((n,i)=>{n.x=W/2+Math.cos(i*2.4+n.c)*(90+i*8);n.y=H/2+Math.sin(i*2.4+n.c)*(70+i*6);n.vx=n.vy=0});
 for(let k=0;k<280;k++){N.forEach(a=>{N.forEach(b=>{if(a!=b){const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||1,f=4200/(d*d);a.vx+=dx/d*f;a.vy+=dy/d*f}});a.vx+=(W/2-a.x)*.003;a.vy+=(H/2-a.y)*.003});
  E.forEach(e=>{const a=ix[e.a],b=ix[e.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-(e.k=='call'?120:85))*.02;a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f});
  N.forEach(n=>{n.x=Math.min(W-30,Math.max(30,n.x+(n.vx*=.6)));n.y=Math.min(H-30,Math.max(30,n.y+(n.vy*=.6)))})}
 const sharedDev=id=>ix[id].t=='d'&&adj[id].filter(([m])=>ix[m].t=='p').length>1;
 let mode='risk',showD=true,showT=true,minR=0,selN=null,pathN=null,pathE=null,pathMode=false,vw={k:1,x:0,y:0};
 const colOf=n=>n.t=='p'?(mode=='cluster'?CP[n.c%CP.length]:lvl(n.score)[1]):n.t=='d'?'#2fd9a0':'#a78bfa';
 const lbl=n=>n.t=='p'?'…'+String(n.id).slice(-4):n.t=='d'?'IMEI…'+String(n.id).slice(-4):'T-'+String(n.id).slice(-4);
 const eCol={call:'#38b6ff',dev:'#2fd9a0',tow:'#a78bfa'};
 const nodeSVG=n=>{const c=colOf(n);let sh='';
  if(n.t=='p')sh=(n.score>=60?`<circle class="ring" r="${n.r}"/>`:'')+`<circle r="${n.r}" fill="${c}" fill-opacity=".92" stroke="${CP[n.c%CP.length]}" stroke-width="3"/>`;
  else if(n.t=='d')sh=`<rect x="-7" y="-7" width="14" height="14" fill="${c}" ${sharedDev(n.id)?'stroke="#ff3b6b" stroke-width="3"':''}/>`;
  else sh=`<polygon points="0,-9 9,0 0,9 -9,0" fill="${c}"/>`;
  return `<g class="kn" data-n="${esc(n.id)}" transform="translate(${n.x},${n.y})">${sh}<text y="${(n.t=='p'?n.r:11)+12}" text-anchor="middle">${lbl(n)}</text></g>`};
 const edgeSVG=(e,i)=>`<line data-i="${i}" x1="${ix[e.a].x}" y1="${ix[e.a].y}" x2="${ix[e.b].x}" y2="${ix[e.b].y}" stroke="${eCol[e.k]}" stroke-opacity=".5" stroke-width="${e.k=='call'?Math.min(6,1+e.v*.7):1}" ${e.k=='call'?'':'stroke-dasharray="3 4"'}/>`;
 /* AI insights */
 const ins=[];
 N.filter(n=>sharedDev(n.id)).slice(0,2).forEach(n=>ins.push([n.id,'⚠ Shared handset …'+String(n.id).slice(-4)+' used by '+adj[n.id].filter(([m])=>ix[m].t=='p').length+' subjects']));
 const topI=N.filter(n=>n.t=='p').sort((a,b)=>b.pr-a.pr)[0];if(topI)ins.push([topI.id,'◎ Key influencer …'+String(topI.id).slice(-4)]);
 const br=subs.map(n=>[n,new Set(adj[n.id].map(([m])=>ix[m]).filter(m=>m.t=='p'&&m.c<K&&m.c!=n.c).map(m=>m.c)).size]).sort((a,b)=>b[1]-a[1])[0];if(br&&br[1]>0)ins.push([br[0].id,'⇄ '+(useHub&&br[0]===hub?'Hub':'Bridge')+' linking '+br[1]+' cluster'+(br[1]==1?'':'s')+' …'+String(br[0].id).slice(-4)]);
 const hr=N.filter(n=>n.t=='p').sort((a,b)=>b.score-a.score)[0];if(hr)ins.push([hr.id,'▲ Highest risk '+hr.score+' …'+String(hr.id).slice(-4)]);
 const svg=`<svg id="kgs" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:70vh;background:#060d1a;border:1px solid var(--line);touch-action:none;display:block"><g id="vp"><g id="ke">${E.map(edgeSVG).join('')}</g><g id="kn2">${N.map(nodeSVG).join('')}</g></g></svg>`;
 $('main').innerHTML=head('AI Knowledge Graph','Entity-relationship graph with AI community detection, influence ranking and link analysis. Drag nodes, scroll to zoom, click to inspect, then use Link path to see how two entities connect.')+
 `<div class="row"><span class="tag">${N.length} entities</span><span class="tag">${E.length} relations</span><span class="tag">${K} cluster${K==1?'':'s'}${useHub?' + hub':''}</span>${ins.map((x,i)=>`<button class="btn g" data-go="${esc(x[0])}">${esc(x[1])}</button>`).join('')}</div>
 <div class="row"><select id="km"><option value="risk">Colour: AI risk</option><option value="cluster">Colour: cluster</option></select><label class="note"><input type="checkbox" id="kd" checked> Handsets</label><label class="note"><input type="checkbox" id="kt" checked> Towers</label><label class="note">Min risk <input type="range" id="kr" min="0" max="100" value="0" style="width:90px"> <b id="krv">0</b></label><input id="kq" list="kl" placeholder="Find subject…" style="width:140px"><datalist id="kl">${P.map(p=>`<option value="${esc(p.n)}">`).join('')}</datalist><button class="btn g" id="kpb">⇢ Link path</button><button class="btn g" id="kz">Reset view</button><button class="btn g" id="kx">Export JSON</button></div>
 <div class="kgw"><div class="kgv">${svg}<div class="note" style="margin-top:6px"><span style="color:#38b6ff">━</span> calls (thickness = volume) · <span style="color:#2fd9a0">┅</span> handset · <span style="color:#a78bfa">┅</span> tower · ● subject · ■ handset (red outline = shared) · ◆ tower · pulsing ring = high risk</div></div><aside id="kp" class="kgp"><b>Select a node</b><p class="note">Click any entity for its AI dossier: risk, cluster, influence, associates and shared evidence.</p></aside></div>`;
 const svgE=$('kgs'),vp=$('vp'),gEl={},lEl=[];
 document.querySelectorAll('.kn').forEach(g=>gEl[g.dataset.n]=g);document.querySelectorAll('#ke line').forEach(l=>lEl[+l.dataset.i]=l);
 const ap=()=>vp.setAttribute('transform',`translate(${vw.x},${vw.y}) scale(${vw.k})`);
 const upd=()=>{N.forEach(n=>gEl[n.id].setAttribute('transform',`translate(${n.x},${n.y})`));E.forEach((e,i)=>{const a=ix[e.a],b=ix[e.b],l=lEl[i];l.setAttribute('x1',a.x);l.setAttribute('y1',a.y);l.setAttribute('x2',b.x);l.setAttribute('y2',b.y)})};
 const vis=n=>{if(n.t=='p')return n.score>=minR;if(n.t=='d'&&!showD)return false;if(n.t=='w'&&!showT)return false;return adj[n.id].some(([m])=>ix[m].t=='p'&&ix[m].score>=minR)};
 const refresh=()=>{const nb=selN?new Set([selN,...adj[selN].map(x=>x[0])]):null;
  N.forEach(n=>{const g=gEl[n.id];g.style.display=vis(n)?'':'none';let o=1;if(nb&&!nb.has(n.id))o=.12;if(pathN)o=pathN.has(n.id)?1:.08;g.style.opacity=o;g.classList.toggle('sel',n.id==selN)});
  E.forEach((e,i)=>{const l=lEl[i];l.style.display=vis(ix[e.a])&&vis(ix[e.b])?'':'none';let o=.5;if(nb)o=(e.a==selN||e.b==selN)?1:.05;if(pathE)o=(pathE.has(e.a+'|'+e.b)||pathE.has(e.b+'|'+e.a))?1:.04;l.style.opacity=o;l.style.strokeWidth=pathE&&o==1?4:''})};
 const recol=()=>N.forEach(n=>{const c=gEl[n.id].querySelector(n.t=='p'?'circle:last-of-type':'rect,polygon');if(c&&n.t=='p')c.setAttribute('fill',colOf(n))});
 const bfs=(a,b)=>{const q=[[a]],seen=new Set([a]);while(q.length){const p=q.shift(),u=p[p.length-1];if(u==b)return p;adj[u].forEach(([m])=>{if(!seen.has(m)){seen.add(m);q.push(p.concat(m))}})}return null};
 const nm=id=>ix[id].t=='p'?id:ix[id].t=='d'?'IMEI '+id:'Tower '+(ix[id].addr||id);
 const panel=id=>{const n=ix[id],box=$('kp');let h='';
  if(n.t=='p'){const p=n.p,L=lvl(p.score),nbs=adj[id].filter(([m])=>ix[m].t=='p').sort((x,y)=>y[1]-x[1]),dv=adj[id].filter(([m])=>ix[m].t=='d'),sh=dv.filter(([m])=>sharedDev(m));
   h=`<b>${esc(id)}</b> <span class="b" style="background:${L[1]}33;color:${L[1]}">${L[0]} ${p.score}</span><div class="kst"><div><small>Cluster</small>${cname(n)}</div><div><small>Influence</small>${Math.round(n.pr*100)}</div><div><small>Links</small>${adj[id].length}</div></div><p class="note">${localBrief(p)}</p>
   ${sh.length?`<p class="note" style="color:#ff3b6b">⚠ Shares handset(s) with: ${sh.map(([m])=>adj[m].filter(([q])=>q!=id&&ix[q].t=='p').map(([q])=>`<a href="#" data-go="${esc(q)}">${esc(q)}</a>`).join(', ')).join('; ')}</p>`:''}
   <b>Top associates</b>${nbs.slice(0,6).map(([m,v])=>`<div class="bar" data-go="${esc(m)}"><span style="width:105px">${esc(m)}</span><i style="width:${Math.min(110,v*12)}px;background:#38b6ff"></i><span style="width:auto">${v}</span></div>`).join('')||'<p class="note">No direct subject links.</p>'}
   <div class="row" style="margin-top:8px"><button class="btn" id="kc1">Suspect card</button><button class="btn g" id="kc2">Track on map</button><button class="btn g" id="kc3">Isolate</button></div>`}
  else if(n.t=='d'){const sb=adj[id].filter(([m])=>ix[m].t=='p');h=`<b>Handset IMEI ${esc(id)}</b><p class="note">${sb.length>1?'<span style="color:#ff3b6b">⚠ Shared handset</span> – used by '+sb.length+' subjects (SIM swapping / common operator).':'Used by one subject.'}</p>${sb.map(([m])=>`<div class="bar" data-go="${esc(m)}"><span style="width:140px">${esc(m)}</span></div>`).join('')}`}
  else{const sb=adj[id].filter(([m])=>ix[m].t=='p');h=`<b>Tower ${esc(n.addr||id)}</b><p class="note">Cell ${esc(id)} · seen by ${sb.length} subject(s) in this graph.</p>${sb.map(([m])=>`<div class="bar" data-go="${esc(m)}"><span style="width:140px">${esc(m)}</span></div>`).join('')}`}
  box.innerHTML=h;
  if(n.t=='p'){$('kc1').onclick=()=>{SEL=id;go('card')};$('kc2').onclick=()=>{window._pick=id;SEL=id;go('map')};$('kc3').onclick=()=>{pathN=null;pathE=null;refresh()}}};
 const select=(id,center)=>{if(!ix[id])return;if(pathMode&&selN&&selN!=id){const pth=bfs(selN,id);pathMode=false;$('kpb').classList.remove('on');if(pth){pathN=new Set(pth);pathE=new Set(pth.slice(1).map((x,i)=>pth[i]+'|'+x));$('kp').innerHTML=`<b>Link path</b><p class="note">${pth.length-1} hop(s) between <b>${esc(nm(pth[0]))}</b> and <b>${esc(nm(id))}</b>:</p>${pth.map((x,i)=>`<div class="bar" data-go="${esc(x)}"><span style="width:auto">${i+1}. ${esc(nm(x))}</span></div>`).join('')}<button class="btn g" id="kcp" style="margin-top:8px">Clear path</button>`;$('kcp').onclick=()=>{pathN=pathE=null;refresh()}}else{pathN=pathE=null;$('kp').innerHTML='<b>No link</b><p class="note">These entities are not connected in the graph.</p>'}refresh();return}
  pathN=pathE=null;selN=id;panel(id);refresh();if(center){vw.k=Math.max(vw.k,1.4);vw.x=W/2-ix[id].x*vw.k;vw.y=H/2-ix[id].y*vw.k;ap()}if(window._bp)window._bp(780,.05,'sine',.04)};
 /* pan / zoom / drag */
 const pt=e=>{const r=svgE.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]};
 svgE.addEventListener('wheel',e=>{e.preventDefault();const[px,py]=pt(e),f=e.deltaY<0?1.15:1/1.15,k=Math.max(.35,Math.min(5,vw.k*f));vw.x=px-(px-vw.x)*k/vw.k;vw.y=py-(py-vw.y)*k/vw.k;vw.k=k;ap()},{passive:false});
 let dr=null,mv=0,lc={t:0,n:null};
 svgE.addEventListener('pointerdown',e=>{const g=e.target.closest('.kn'),[px,py]=pt(e);dr={n:g?ix[g.dataset.n]:null,px,py,lx:px,ly:py,x0:vw.x,y0:vw.y};mv=0;svgE.setPointerCapture(e.pointerId)});
 svgE.addEventListener('pointermove',e=>{if(!dr)return;const[px,py]=pt(e);mv=Math.max(mv,Math.abs(px-dr.px)+Math.abs(py-dr.py));if(dr.n){if(mv>5){dr.n.x+=(px-dr.lx)/vw.k;dr.n.y+=(py-dr.ly)/vw.k;upd()}}else{vw.x=dr.x0+px-dr.px;vw.y=dr.y0+py-dr.py;ap()}dr.lx=px;dr.ly=py});
 svgE.addEventListener('pointerup',e=>{if(!dr)return;const d=dr;dr=null;if(mv>5)return;if(d.n){const now=Date.now();if(lc.n==d.n.id&&now-lc.t<380&&d.n.t=='p'){SEL=d.n.id;go('card');return}lc={t:now,n:d.n.id};select(d.n.id,false)}else{selN=null;pathN=pathE=null;$('kp').innerHTML='<b>Select a node</b><p class="note">Click any entity for its AI dossier.</p>';refresh()}});
 $('kp').addEventListener('click',e=>{const t=e.target.closest('[data-go]');if(t){e.preventDefault();select(t.dataset.go,true)}});
 document.querySelectorAll('.row [data-go]').forEach(b=>b.onclick=()=>select(b.dataset.go,true));
 $('km').onchange=()=>{mode=$('km').value;recol();if(selN)panel(selN)};
 $('kd').onchange=()=>{showD=$('kd').checked;refresh()};$('kt').onchange=()=>{showT=$('kt').checked;refresh()};
 $('kr').oninput=()=>{minR=+$('kr').value;$('krv').textContent=minR;refresh()};
 $('kq').onchange=()=>{const v=$('kq').value.trim();if(ix[v])select(v,true)};
 $('kpb').onclick=()=>{if(!selN){$('kp').innerHTML='<b>Link path</b><p class="note">First select a starting node, then press Link path and click the destination.</p>';return}pathMode=!pathMode;$('kpb').classList.toggle('on',pathMode);if(pathMode)$('kp').insertAdjacentHTML('afterbegin','<p class="note" style="color:#19d3a2">Now click the destination node…</p>')};
 $('kz').onclick=()=>{vw={k:1,x:0,y:0};selN=null;pathN=pathE=null;ap();refresh()};
 $('kx').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({nodes:N.map(n=>({id:n.id,type:n.t,cluster:n.c,influence:+n.pr.toFixed(3),risk:n.score})),edges:E.map(e=>({from:e.a,to:e.b,kind:e.k,weight:e.v}))},null,1)],{type:'application/json'}));a.download='relationship-graph.json';a.click()};
 refresh()},
recon(){const p=prof(defSel()),L=p.loc.filter((x,i,A)=>i==0||x.cell!=A[i-1].cell),span=L.length>1?Math.round((L[L.length-1].t-L[0].t)/36e5):0;
 $('main').innerHTML=head('Crime Reconstruction Dashboard','Replay the subject’s movement tower by tower.')+`<div class="row">${selBox()}<span class="tag">${L.length} located stops</span><span class="tag">${span} h span</span><span class="tag">${p.st} interstate · ${p.co} cross-border</span><button class="btn" id="pl">▶ Replay</button></div><div class="mp"><div id="gmap"></div><div id="stc"></div></div><input type="range" id="sl" min="0" max="${Math.max(0,L.length-1)}" value="0" style="width:100%">`;
 $('sel').onchange=e=>{SEL=e.target.value;V.recon()};if(!L.length){$('stc').textContent='No located records for this subject.';return}
 if(!window.L){$('stc').textContent='Map library could not load (check internet connection).';return}
 const m=L.map(x=>[x.lat,x.lon]),mp=window.L.map('gmap');window.L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{subdomains:'0123',maxZoom:20}).addTo(mp);window.L.polyline(m,{color:'#19d3a2'}).addTo(mp);mp.fitBounds(m,{padding:[40,40],maxZoom:14});
 const dot=window.L.circleMarker(m[0],{radius:9,color:'#fff',fillColor:'#e03131',fillOpacity:1}).addTo(mp);L.forEach((x,i)=>window.L.circleMarker(m[i],{radius:6,color:'#1aa6ff'}).addTo(mp).bindTooltip('Stop '+(i+1)+' · '+esc(x.addr)).on('click',()=>{at(i);window._bp&&window._bp(500+i*30,.1,'sine',.05)}));
 const at=i=>{const x=L[i];dot.setLatLng(m[i]);try{mp.panTo(m[i],{animate:true})}catch(e){}$('sl').value=i;$('stc').innerHTML=`<b>Stop ${i+1}/${L.length}</b> · ${x.date} ${x.time} · ${esc(x.addr)} · ${regName(reg(x))}`};at(0);
 $('sl').oninput=e=>{at(+e.target.value);window._bp&&window._bp(400+(+e.target.value)*30,.05,'sine',.03)};
 let spd=900,pos=0,playing=false;const pl=$('pl'),tick=()=>{at(pos);window._bp&&window._bp(360+pos*45,.12,'triangle',.05);if(++pos>=L.length){stop()}},stop=()=>{clearInterval(window._tm);playing=false;pl.textContent='▶ Replay'},start=()=>{if(pos>=L.length)pos=0;clearInterval(window._tm);playing=true;pl.textContent='⏸ Pause';tick();window._tm=setInterval(tick,spd)};
 pl.onclick=()=>playing?stop():start();
 pl.insertAdjacentHTML('afterend',[['0.5×',1800],['1×',900],['2×',450],['4×',225]].map(x=>`<button class="btn g" data-sp="${x[1]}">${x[0]}</button>`).join(''));
 document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{spd=+b.dataset.sp;if(playing){clearInterval(window._tm);window._tm=setInterval(tick,spd)}});},
seq(){const p=prof(defSel()),ev=[];let ld=null;
 p.loc.forEach((x,i)=>{if(i&&x.cell!=p.loc[i-1].cell){const g=seg(p.loc[i-1],x);ev.push([x.t,g==2?'✈':g==1?'➜':'⌖',`${g==2?'Crossed border into':g==1?'Moved interstate to':'Moved to'} ${x.addr} (${regName(reg(x))})`,g?1:0])}else if(!i)ev.push([x.t,'⌖','First located at '+x.addr,0]);
  if(ld&&x.imei!=ld){ev.push([x.t,'▣','Handset changed: '+x.imei,1])}ld=x.imei});
 p.R.filter(r=>r.b==p.n).slice(0,4).forEach(r=>ev.push([ts(r),'☎','Incoming from '+r.a+' ('+r.dur+'s)',0]));
 ev.sort((a,b)=>a[0]-b[0]);const txt=ev.map(e=>new Date(e[0]).toISOString().slice(0,16).replace('T',' ')+'  '+e[2]).join('\n');
 $('main').innerHTML=head('Event-Sequence Generator','Auto-generated chronology for the selected subject. Flagged events are anomalies.')+`<div class="row">${selBox()}<span class="tag">${ev.length} events</span><button class="btn" id="cp">Copy narrative</button></div>`+ev.map(e=>`<div class="cs ${e[3]?'on':''}"><b>${e[1]}</b> <span class="note">${new Date(e[0]).toISOString().slice(0,16).replace('T',' ')}</span> ${esc(e[2])}${e[3]?'<span class="b r">anomaly</span>':''}</div>`).join('');
 $('sel').onchange=e=>{SEL=e.target.value;V.seq()};$('cp').onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(txt)},
card(){const draw=async first=>{const p=prof(defSel()),L=lvl(p.score),D=deg(),top=p.ct.sort((a,b)=>(D[b]||0)-(D[a]||0)).slice(0,5),ls=p.R.map(ts).filter(isFinite).sort((a,b)=>a-b),f=t=>t?new Date(t).toISOString().slice(0,16).replace('T',' '):'–';
  const html=`<div class="cs on" style="border-color:${L[1]}"><div class="row" style="margin:0;gap:16px"><div style="width:84px;height:84px;display:grid;place-items:center;font:900 28px var(--fd);border:2px solid ${L[1]};color:${L[1]}">${p.n.slice(-2)}</div><div><b style="font:700 18px var(--fd)">SUBJECT-${p.n.slice(-4)}</b><div class="note">${p.sus?'Primary subject of '+esc(cur().fir):'Associate / contact'} · ${p.n}</div><span class="b" style="background:${L[1]}33;color:${L[1]}">${L[0]} RISK ${p.score}/100</span></div></div>
  <div class="fx"><span>Rule Risk <small>R<sub>base</sub></small><b>${p.risk}</b></span><i>+</i><span>Vector Match <small>Δ<sub>vector</sub></small><b>${sg(p.bonus)}</b></span><i>+</i><span>Convergence Synergy <small>Δ<sub>synergy</sub></small><b>${sg(p.syn)}</b></span><i>=</i><span class="fin" style="border-color:${L[1]};color:${L[1]}">FINAL RISK SCORE<b>${p.score}</b></span></div>
  <div class="note" style="margin:6px 0">Top match: <b>${esc(p.simTo)}</b> · cosine ${p.sim}% · ${p.topMatch?(p.topMatch.type=='archetype'?'crime modus operandi — '+esc(p.topMatch.desc):'known suspect profile'):'no reference profile'} · fusion: ${p.fusion=='linear'?'weighted linear blend':'synergy'}${p.matches.length>1?'<br>Next closest: '+p.matches.slice(1,4).map(m=>esc(m.name)+' '+m.sim+'%').join(' · '):''}</div><p id="brief">${esc(localBrief(p))}</p><div class="note">Handsets: ${p.im.map(esc).join(', ')||'–'}<br>SIMs: ${p.is.map(esc).join(', ')||'–'}<br>Towers: ${p.tw.length} · Contacts: ${p.ct.length} · Calls out/in: ${p.O.length}/${p.R.length-p.O.length}<br>Movement: ${p.reg.map(esc).join(' → ')||'–'}<br>First seen ${f(ls[0])} · last seen ${f(ls[ls.length-1])}<br>Top contacts: ${top.join(', ')||'–'}</div><div>${p.f.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="note">Linked matters: ${CASES.filter(c=>c.rows.some(r=>r.a==p.n||r.b==p.n)).map(c=>esc(c.fir)).join(', ')||'–'}</div></div>`;
  if(first)$('main').innerHTML=head('AI Suspect Card','Live AI dossier of the selected subject, redrafted every few seconds as evidence changes.')+`<div class="row">${selBox()}<span class="tag" id="lv">● LIVE</span></div><div id="cbox"></div>`;
  $('cbox').innerHTML=html;if($('sel'))$('sel').onchange=e=>{SEL=e.target.value;draw(0)};
  const k=JSON.stringify([p.n,p.O.length,p.score]);if(k!=window._ck){window._ck=k;const b=await aiBrief(p);if(b&&$('brief')){$('brief').textContent=b;$('lv').textContent='● LIVE · AI brief'}}};
 draw(1);window._tm=setInterval(()=>{if(view=='card')draw(0)},4000)}});
/* ===== Phase banners: one header page per phase ===== */
const PH={I:['Acquisition','Collect and ingest raw communication evidence.','#19d3a2'],II:['Correlation','Cross-link subscribers, devices and events.','#1aa6ff'],III:['Visualisation','See movement, towers and networks.','#2fd9a0'],IV:['Investigation','AI reconstruction and suspect profiling.','#ff3b6b']};
const _stage=stage;stage=function(v){_stage(v);const x=VIEWS.find(y=>y[1]==v),n=x[0].split(' · ')[0],P=PH[n];let b=$('phb');if(!b){b=document.createElement('div');b.id='phb';$('stg').prepend(b)}
 b.style.setProperty('--ph',P[2]);b.innerHTML=`<div class="pn2">${n}</div><div><small>PHASE ${n}</small><h1>${P[0]}</h1><p>${P[1]}</p></div><div class="pt">${Object.keys(PH).map(k=>`<button class="${k==n?'on':''}" data-v="${VIEWS.find(y=>y[0].startsWith(k+' '))[1]}" style="--c:${PH[k][2]}">${k}</button>`).join('')}</div>`;
 b.querySelectorAll('button').forEach(t=>t.onclick=()=>go(t.dataset.v));
 [...$('nav').children].forEach(el=>{let k;if(el.tagName=='H4')k=el.querySelector('em').textContent;else{const y=VIEWS.find(z=>z[1]==el.dataset.v);k=y[0].split(' · ')[0]}el.style.display=k==n?'':'none'})};


const TSESSION=(()=>{try{return JSON.parse(sessionStorage.getItem('tcdr_sess')||'null')}catch(e){return null}})();
const TKEY=TSESSION&&TSESSION.sb&&TSESSION.id?'tcdr_data_v2_'+TSESSION.id:'tcdr_data_offline';let _sig='';
const sgn=()=>CASES.map(c=>[c.id,c.status,c.charges.join(','),c.rows.length,c.suspect,c.fir,c.title].join('|')).join(';');
function tcPersist(){try{const j=JSON.stringify({cases:CASES,fseq,cur:CUR});localStorage.setItem(TKEY,j);_sig=sgn();window._saved={t:Date.now(),kb:j.length/1024|0,err:0};return true}catch(e){window._saved={t:Date.now(),kb:0,err:1};return false}}
function tcRestore(){try{const o=JSON.parse(localStorage.getItem(TKEY)||'null');if(!o||!Array.isArray(o.cases)||!o.cases.length)return false;CASES=o.cases;fseq=o.fseq||CASES.length;_sig=sgn();setCase(CASES.some(c=>c.id==o.cur)?o.cur:CASES[0].id,'cases');return true}catch(e){return false}}
setInterval(()=>{try{if(CASES.length&&sgn()!=_sig)tcPersist()}catch(e){}},4000);addEventListener('beforeunload',()=>{try{tcPersist()}catch(e){}});
function initEmpty(){CASES=[];fseq=0;const c=newCase({title:'New case',status:'Open',rows:[]});$('cs').onchange=()=>setCase($('cs').value);setCase(c.id,'cases')}
if(!tcRestore())initEmpty();
(function(){
const ov=$('intro'),cv=$('ic'),cap=$('icap'),bar=$('ibar'),fl=$('iflash'),reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
let run=1;const T0=performance.now()+10000;const close=()=>{if(window._icd)return;window._icd=1;run=0;if(window._chk&&!reduce){window._chk(real);return}real()};const real=()=>{ov.style.opacity=0;window._cd=0;document.documentElement.style.overflow='';scrollTo(0,0);stats();setTimeout(()=>ov.remove(),600)};document.documentElement.style.overflow='hidden';
$('ienter').onclick=close;$('iskip').onclick=close;setTimeout(close,reduce?6000:35500);
if(!window.THREE)return;
try{
const T=THREE,R=new T.WebGLRenderer({canvas:cv,antialias:true}),sc=new T.Scene(),cam=new T.PerspectiveCamera(55,1,.1,100);
sc.fog=new T.Fog(0x03060c,8,26);
const rs=()=>{R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.fov=innerWidth<innerHeight?75:55;cam.updateProjectionMatrix()};rs();addEventListener('resize',rs);
const S=(a,b,t)=>Math.min(1,Math.max(0,(t-a)/(b-a)));
const tex=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');f(x,w,h);const t=new T.CanvasTexture(c);t.needsUpdate=true;return t};
const grid=new T.GridHelper(60,60,0xd9a441,0x3a2d10);grid.position.y=-2.6;grid.visible=false;sc.add(grid);
const pg=new T.BufferGeometry(),pa=new Float32Array(900);for(let i=0;i<900;i++)pa[i]=(Math.random()-.5)*40;pg.setAttribute('position',new T.BufferAttribute(pa,3));
sc.add(new T.Points(pg,new T.PointsMaterial({color:0xffd479,size:.08})));
const screen=(on)=>tex(256,512,(x,w,h)=>{x.fillStyle=on?'#2a0d0d':'#0b1220';x.fillRect(0,0,w,h);x.fillStyle='#ff6b6b';x.font='bold 22px sans-serif';x.textAlign='center';x.fillText('Incoming call',w/2,70);x.fillStyle='#fff';x.font='bold 30px sans-serif';x.fillText('+91 98••• 44170',w/2,130);x.fillStyle='#ffb3b3';x.font='18px sans-serif';x.fillText('“CBI Officer”',w/2,170);x.fillText('Unknown · Possible scam',w/2,200);x.fillStyle='#e03131';x.beginPath();x.arc(70,430,34,0,7);x.fill();x.fillStyle='#2f9e44';x.beginPath();x.arc(186,430,34,0,7);x.fill()});
const tA=screen(0),tB=screen(1),ph=new T.Group(),sm=new T.MeshBasicMaterial({map:tA});
ph.add(new T.Mesh(new T.BoxGeometry(1.2,2.4,.14),new T.MeshBasicMaterial({color:0x1a2a4a})));
const scr=new T.Mesh(new T.PlaneGeometry(1.08,2.2),sm);scr.position.z=.08;ph.add(scr);
const halo=new T.Mesh(new T.RingGeometry(1.6,1.65,48),new T.MeshBasicMaterial({color:0xe03131,transparent:true}));ph.add(halo);sc.add(ph);
const C=[['Digital arrest','Fake CBI video call','₹42.6 L'],['KYC / OTP fraud','“Bank account will freeze”','₹3.1 L'],['SIM swap','Number cloned overnight','₹11.8 L'],['Sextortion call','Recorded video call','₹1.9 L'],['Investment scam','Tips group + follow-up call','₹27 L']];
const cg=new T.Group(),cards=C.map((c,i)=>{const m=new T.MeshBasicMaterial({map:tex(440,260,(x,w,h)=>{x.fillStyle='#0b1a33';x.fillRect(0,0,w,h);x.strokeStyle=i%2?'#d9a441':'#ffc857';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6);x.fillStyle='#8fa6cc';x.font='20px monospace';x.fillText('CASE #'+(2041+i),24,44);x.fillStyle='#fff';x.font='bold 36px sans-serif';x.fillText(c[0],24,110);x.fillStyle='#7dffb2';x.font='22px sans-serif';x.fillText(c[1],24,154);x.fillStyle='#19d3a2';x.font='bold 40px sans-serif';x.fillText(c[2]+' lost',24,222)}),transparent:true,side:T.DoubleSide});
const p=new T.Mesh(new T.PlaneGeometry(2.4,1.42),m),a=i/5*6.283;p.position.set(Math.sin(a)*3.4,Math.sin(i*1.7)*.7,Math.cos(a)*3.4);p.rotation.y=a;cg.add(p);return p});sc.add(cg);
const ring=new T.Mesh(new T.TorusGeometry(1.4,.07,16,80),new T.MeshBasicMaterial({color:0xffc857}));sc.add(ring);
let last='';const say=h=>{if(h!==last){cap.innerHTML=h;last=h}};
function upd(t,now){
 const g=S(6,7.5,t),k=S(6.5,8.5,t)*(1-S(17,19,t));
 ph.visible=g<1;ph.scale.setScalar(Math.max(.001,1-g));ph.rotation.y=Math.sin(t*1.4)*.4+g*8;ph.position.x=t<6&&Math.floor(t*3)%2?Math.sin(t*70)*.04:0;
 sm.map=Math.floor(t*2)%2?tB:tA;halo.scale.setScalar(1+(t*1.5%1)*.5);halo.material.opacity=1-(t*1.5%1);
 cg.scale.setScalar(Math.max(.001,k));cg.rotation.y=t*.3;
 const ix=Math.floor((t-8.5)/1.7);cards.forEach((c,i)=>{const on=t>8.5&&t<17&&((ix%5)+5)%5==i;c.scale.setScalar(on?1.18:1);c.material.opacity=on?1:.6});
 const rg=S(17,19,t);ring.visible=rg>0;ring.scale.setScalar(Math.max(.001,rg*3));ring.rotation.z=t;
 cam.position.set(Math.sin(t*.3)*1.2,.4,t<6?7-S(0,6,t)*2.3:6.5-S(18,22,t)*9.5);cam.lookAt(0,0,0);
 grid.position.z=(now/1000*2)%1;
 bar.style.width=(t/24*100)+'%';fl.style.opacity=t>21.5?S(21.5,23,t):1-S(0,.8,t);
 if(t<6)say('<b>Unknown caller</b>“This is CBI. Your Aadhaar is linked to a crime. Stay on the call.”');
 else if(t<8.5)say('<b>The call ends</b>The money is already gone.');
 else if(t<17){const c=C[((ix%5)+5)%5];say('<b>'+c[0]+'</b>'+c[1]+' · '+c[2])}
 else say('<b>Every call leaves a trace</b>Opening the TraceCDR dashboard…');
 R.render(sc,cam)}
if(reduce){upd(10,0);return}
(function f(now){if(!run)return;requestAnimationFrame(f);const tt=(now-T0)/1000;if(tt>=24){close();return}upd(tt<0?3+Math.sin(now/1200):tt,now)})(0);
}catch(e){}
})();
