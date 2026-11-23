(function(){const rm=matchMedia('(prefers-reduced-motion:reduce)').matches,C=['#19d3a2','#38b6ff','#7dffb2','#ff3b6b','#ffd479','#b388ff'];
const mk=(x,y,w)=>{const s=document.createElement('div');s.className='spk';s.style.left=x+'px';s.style.top=y+'px';s.style.width=w+'px';s.style.background=C[Math.random()*C.length|0];document.body.append(s);return s};
let lt=0;if(rm)return;
addEventListener('pointermove',e=>{if(e.pointerType=='touch'||e.timeStamp-lt<45)return;lt=e.timeStamp;const s=mk(e.clientX,e.clientY,9+Math.random()*6),r=Math.random()*180,dx=(Math.random()-.5)*30,dy=18+Math.random()*34;
 s.animate([{transform:`translate(-50%,-50%) rotate(${r}deg)`,opacity:1},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${r+200}deg)`,opacity:0}],{duration:650+Math.random()*350,easing:'ease-in'}).onfinish=()=>s.remove()},{passive:true});
addEventListener('pointerdown',e=>{for(let k=0;k<14;k++){const s=mk(e.clientX,e.clientY,10+Math.random()*6),a=k/14*6.283+Math.random()*.4,d=34+Math.random()*44,deg=a*57.3;
 s.animate([{transform:`translate(-50%,-50%) rotate(${deg}deg) scale(1)`,opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d+14}px)) rotate(${deg+240}deg) scale(.6)`,opacity:0}],{duration:700,easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish=()=>s.remove()}});
addEventListener('pointerover',e=>{const c=document.getElementById('cd');if(c)c.classList.toggle('hv',!!(e.target.closest&&e.target.closest('a,button,select,input,label,th,tr,summary,.btn,[onclick]')))});
})();
