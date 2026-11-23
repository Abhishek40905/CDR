(function(){
const ov=document.getElementById('intro'),cv=document.getElementById('chk'),sk=document.getElementById('iskip');
if(!cv)return;
if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const tx={style:{},innerHTML:''};
const x=cv.getContext('2d'),TOT=7.5,S=(a,b,t)=>Math.min(1,Math.max(0,(t-a)/(b-a))),ease=u=>1-Math.pow(1-u,3);
let W=0,H=0,dpr=1;const rs=()=>{dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)};rs();addEventListener('resize',rs);
const gold=(r)=>{const g=x.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#fff3c4');g.addColorStop(.45,'#e2b04a');g.addColorStop(1,'#8a5a12');return g};
function teeth(n,r0,r1,rot){x.beginPath();for(let i=0;i<n;i++){const a=rot+i/n*6.2832,b=rot+(i+.5)/n*6.2832,c=rot+(i+1)/n*6.2832;x.lineTo(Math.cos(a)*r0,Math.sin(a)*r0);x.lineTo(Math.cos(b)*r1,Math.sin(b)*r1);x.lineTo(Math.cos(c)*r0,Math.sin(c)*r0)}x.closePath()}
function chakra(R,rot,pulse){
 const gl=x.createRadialGradient(0,0,R*.2,0,0,R*2.1);gl.addColorStop(0,'rgba(255,170,60,'+(.55*pulse)+')');gl.addColorStop(.5,'rgba(255,90,0,'+(.22*pulse)+')');gl.addColorStop(1,'rgba(255,60,0,0)');
 x.globalCompositeOperation='lighter';x.fillStyle=gl;x.beginPath();x.arc(0,0,R*2.1,0,6.2832);x.fill();x.globalCompositeOperation='source-over';
 // outer serrated blade ring (108 teeth)
 teeth(108,R*.97,R*1.1,rot);x.fillStyle=gold(R);x.fill();x.lineWidth=Math.max(1,R*.006);x.strokeStyle='#fff3c4';x.stroke();
 x.beginPath();x.arc(0,0,R*.97,0,6.2832);x.arc(0,0,R*.86,0,6.2832,true);x.fillStyle=gold(R);x.fill('evenodd');
 x.strokeStyle='#5a3708';x.lineWidth=Math.max(1,R*.008);x.beginPath();x.arc(0,0,R*.91,0,6.2832);x.stroke();
 // inner counter-rotating serrated ring
 teeth(54,R*.8,R*.86,-rot*1.35);x.fillStyle='#c98f2b';x.fill();x.strokeStyle='#fff3c4';x.lineWidth=Math.max(1,R*.004);x.stroke();
 // dark disc body
 x.beginPath();x.arc(0,0,R*.8,0,6.2832);const bd=x.createRadialGradient(0,0,0,0,0,R*.8);bd.addColorStop(0,'#2a1304');bd.addColorStop(1,'#0d0602');x.fillStyle=bd;x.fill();
 x.strokeStyle='#e2b04a';x.lineWidth=Math.max(1,R*.012);x.stroke();
 // spokes
 x.save();x.rotate(rot*.5);x.strokeStyle='rgba(255,210,120,.55)';x.lineWidth=Math.max(.6,R*.004);for(let i=0;i<24;i++){x.rotate(6.2832/24);x.beginPath();x.moveTo(R*.3,0);x.lineTo(R*.78,0);x.stroke()}x.restore();
 // two lotus petal rings
 [[12,.78,.46,rot*.7,'rgba(226,176,74,.9)'],[12,.62,.3,-rot*.9,'rgba(255,146,43,.95)']].forEach(([n,ro,ri,rt,col])=>{x.save();x.rotate(rt);for(let i=0;i<n;i++){x.rotate(6.2832/n);x.beginPath();x.moveTo(R*ri,0);x.bezierCurveTo(R*(ri+ro)/2,-R*.17,R*ro*.97,-R*.08,R*ro,0);x.bezierCurveTo(R*ro*.97,R*.08,R*(ri+ro)/2,R*.17,R*ri,0);x.fillStyle='rgba(60,25,4,.85)';x.fill();x.strokeStyle=col;x.lineWidth=Math.max(1,R*.01);x.stroke()}x.restore()});
 // central ring + shatkona
 x.beginPath();x.arc(0,0,R*.27,0,6.2832);x.fillStyle='#1a0b02';x.fill();x.strokeStyle='#ffd479';x.lineWidth=Math.max(1,R*.014);x.stroke();
 x.save();x.rotate(rot*.4);x.strokeStyle='#ffd479';x.lineWidth=Math.max(1,R*.012);for(let k=0;k<2;k++){x.beginPath();for(let i=0;i<3;i++){const a=i/3*6.2832+k*Math.PI/3-Math.PI/2;x.lineTo(Math.cos(a)*R*.23,Math.sin(a)*R*.23)}x.closePath();x.stroke()}x.restore();
 const cg=x.createRadialGradient(0,0,0,0,0,R*.13);cg.addColorStop(0,'#fff');cg.addColorStop(.4,'#9cc4ff');cg.addColorStop(1,'rgba(43,107,255,0)');x.globalCompositeOperation='lighter';x.fillStyle=cg;x.beginPath();x.arc(0,0,R*.14*(1+.15*Math.sin(rot*2)),0,6.2832);x.fill();x.globalCompositeOperation='source-over'}
const P=[];let rot=0,last=0,t0=0,done=0,cap=0,go=0,rl=null,rd=0;
const say=(h)=>{if(cap!==h){cap=h;tx.innerHTML=h}};
function frame(now){
 if(done||!go)return;requestAnimationFrame(frame);
 if(!t0){t0=now;last=now}
 const t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;
 const m=Math.min(W,H),R0=m*(W<H?.36:.3);
 const appear=ease(S(0,1.9,t)),launch=S(4.9,6.7,t);
 const sc=(.04+.96*appear)*(1+Math.pow(launch,3)*(Math.max(W,H)/R0*1.7));
 const om=(1+26*Math.pow(S(0,3.4,t),1.6))*(1+launch*1.4);rot+=om*dt;
 const R=R0*sc,cx=W/2,cy=H*(W<H?.42:.46)+Math.sin(t*1.6)*3*(1-launch);
 // trail wash
 x.globalCompositeOperation='source-over';x.fillStyle='rgba(2,4,10,'+(launch>0?.22:.35)+')';x.fillRect(0,0,W,H);
 // embers / flames from rim
 const rate=appear*(launch>0?30:14);for(let i=0;i<rate;i++){if(R<8)break;const a=Math.random()*6.2832,rr=R*(1.04+Math.random()*.08),sp=60+Math.random()*120;P.push({x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr,vx:-Math.sin(a)*sp*.5+Math.cos(a)*sp*.4,vy:Math.cos(a)*sp*.5+Math.sin(a)*sp*.4-70,l:1,s:1+Math.random()*3.2*Math.min(1,R/R0)})}
 x.globalCompositeOperation='lighter';
 for(let i=P.length-1;i>=0;i--){const p=P[i];p.l-=dt*1.1;if(p.l<=0){P.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=40*dt;const g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,p.s*4);g.addColorStop(0,'rgba(255,'+(120+p.l*120|0)+',40,'+p.l*.9+')');g.addColorStop(1,'rgba(255,60,0,0)');x.fillStyle=g;x.beginPath();x.arc(p.x,p.y,p.s*4,0,6.2832);x.fill()}
 if(P.length>900)P.splice(0,P.length-900);
 x.globalCompositeOperation='source-over';
 // chakra + spin ghosts for motion blur
 const ghosts=om>14?3:0;
 for(let g=ghosts;g>=0;g--){x.save();x.translate(cx,cy);x.globalAlpha=g?.22:1;chakra(R,rot-g*om*.012,.7+.3*Math.sin(t*5));x.restore()}
 // shockwave ring as it leaps
 if(launch>0){x.globalCompositeOperation='lighter';x.strokeStyle='rgba(255,200,110,'+(1-launch)*.7+')';x.lineWidth=3;x.beginPath();x.arc(cx,cy,R0*(1+launch*6),0,6.2832);x.stroke();x.globalCompositeOperation='source-over'}
  // flash + reveal
 if(t>6.1){const a=S(6.1,6.85,t);x.fillStyle='rgba(255,236,190,'+a+')';x.fillRect(0,0,W,H)}
 cv.style.opacity=S(0,.5,t)*(1-S(6.9,7.5,t));
 if(t>=6.85&&!rd){rd=1;rl&&rl()}
 if(t>=7.5)end();
}
function end(){if(done)return;done=1;if(!rd){rd=1;rl&&rl()}cv.remove()}
window._chk=(real)=>{rl=real;go=1;cv.style.display='block';cv.style.opacity=0;rs();requestAnimationFrame(frame)};
sk&&sk.addEventListener('click',()=>{if(go&&!done)end()});
new MutationObserver(()=>{if(!document.getElementById('intro'))end()}).observe(document.body,{childList:true});
})();
