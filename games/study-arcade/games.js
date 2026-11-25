(()=>{
const I=SA.IMPL;
const COL=['#e9503f','#2f74e0','#c98a0c','#11897c'];
const acc=(r,t)=>(t?Math.round(r/t*100):0)+'%';

/* ===== Gold Rush ===== */
const UP={
  mpq:{name:'Gold per Answer',desc:'Base gold for each right answer',vals:[10,50,200,800,3000,12000,50000,200000],cost:[0,100,800,4000,20000,100000,500000,2000000],f:v=>v.toLocaleString('en-US')+'G'},
  str:{name:'Streak Bonus',desc:'Extra gold times your streak',vals:[0,10,40,150,600,2500,10000,40000],cost:[0,200,1500,7000,35000,150000,700000,3000000],f:v=>'+'+v.toLocaleString('en-US')+'G × streak'},
  mul:{name:'Multiplier',desc:'Multiplies all the gold from an answer',vals:[1,1.5,2,3,5,8,12,20],cost:[0,500,3000,15000,80000,400000,1500000,6000000],f:v=>'×'+v},
  ins:{name:'Oops Insurance',desc:'Lose less gold when you miss',vals:[0,25,50,75,90],cost:[0,300,2500,15000,90000],f:v=>v+'% protected'},
};
const POW={fifty:{name:'50/50',desc:'Removes 2 wrong answers',k:4},dbl:{name:'Double Time',desc:'Double gold for 30 seconds',k:20},shield:{name:'Shield',desc:'Your next wrong answer costs nothing',k:6}};
I.gr=c=>{
  const {$,fmt,mmss,shuf}=c,o=c.opts.mode||'g1000000',goal=o[0]==='g'?+o.slice(1):0,limit=o[0]==='t'?+o.slice(1):0,next=c.dealer();
  const S={money:0,lv:{mpq:0,str:0,mul:0,ins:0},inv:{fifty:0,dbl:0,shield:0},streak:0,best:0,right:0,wrong:0,earned:0,dblUntil:0,shieldOn:0,start:Date.now(),wrongs:[],over:false};
  let cur=null,tm,shown=0;
  const mt=setInterval(()=>{const m=$('#money');if(!m)return;if(Math.abs(S.money-shown)<1)shown=S.money;else{shown+=(S.money-shown)*.22;m.classList.remove('bump');void m.offsetWidth;m.classList.add('bump')}m.innerHTML=fmt(shown)+'<small>G</small>'},50);
  const val=k=>UP[k].vals[S.lv[k]],pc=k=>Math.max(50,Math.round(val('mpq')*POW[k].k));
  c.setStats(`<span class="money" id="money"></span><div class="prog"><i id="prog"></i></div><span id="goalTxt"></span><span>Streak <b id="streak">0</b></span><span id="clock"></span><span id="dbl" class="dbl hide"></span>`);
  c.stage.innerHTML=`<div class="tabs"><button id="tQuiz" aria-pressed="true">Questions</button><button id="tShop" aria-pressed="false">Shop (S)</button></div>
  <div id="vQuiz"><div class="qcard" id="qcard"><div class="qtag" id="qtag"></div><p class="q" id="q"></p><div class="fb" id="fb" aria-live="polite"></div></div><div class="ans" id="ans"></div><div class="pows" id="pows"></div></div>
  <div id="vShop" class="hide"><div class="shop" id="shop"></div></div>`;
  const tab=t=>{$('#vQuiz').classList.toggle('hide',t!=='quiz');$('#vShop').classList.toggle('hide',t!=='shop');$('#tQuiz').setAttribute('aria-pressed',t==='quiz');$('#tShop').setAttribute('aria-pressed',t==='shop');if(t==='shop')shop()};
  $('#tQuiz').onclick=()=>tab('quiz');$('#tShop').onclick=()=>tab('shop');
  function ask(){cur=c.makeQ(next());cur.locked=false;$('#qtag').textContent=cur.tag;$('#q').textContent=cur.q;$('#fb').textContent='';c.drawAns($('#ans'),cur);pows()}
  function pick(i){
    if(!cur||cur.locked||S.over)return;const bs=[...$('#ans').children];if(!bs[i]||bs[i].classList.contains('gone'))return;
    cur.locked=true;$('#ans').classList.add('lock');const ok=cur.opts[i]===cur.a;
    bs.forEach((b,j)=>{if(cur.opts[j]===cur.a)b.classList.add('right');else if(j===i)b.classList.add('bad')});
    if(ok){const bonus=val('str')*S.streak;S.streak++;S.best=Math.max(S.best,S.streak);S.right++;
      const g=(val('mpq')+bonus)*val('mul')*(Date.now()<S.dblUntil?2:1);S.money+=g;S.earned+=g;c.floatTxt($('#qcard'),'+'+fmt(g)+'G','var(--gold)');c.hit(cur.card);c.fx.good(bs[i]);c.fx.coins(bs[i],$('#money'));c.fx.combo(S.streak);$('#fb').textContent=S.streak>1?`Correct! ${S.streak} in a row`:'Correct!'}
    else{S.streak=0;S.wrong++;S.wrongs.push(cur.card);let loss=Math.round(val('mpq')*(1-val('ins')/100));
      if(S.shieldOn){S.shieldOn--;loss=0;$('#fb').textContent='Your shield blocked it!'}else $('#fb').textContent='Answer: '+cur.a;
      loss=Math.min(loss,S.money);S.money-=loss;if(loss)c.floatTxt($('#qcard'),'−'+fmt(loss)+'G','var(--red)');c.fx.bad()}
    top();if(goal&&S.money>=goal)return end();
    setTimeout(()=>{if(!S.over)ask()},ok?650:1500);
  }
  function top(){$('#streak').textContent=S.streak;
    if(goal){$('#prog').style.width=Math.min(100,S.money/goal*100)+'%';$('#goalTxt').innerHTML=`Goal <b>${fmt(goal)}G</b>`}
    if(!$('#vShop').classList.contains('hide'))shop()}
  function pows(){$('#pows').innerHTML=Object.entries(POW).map(([k,p])=>`<button data-p="${k}" ${S.inv[k]?'':'disabled'}>${p.name} ×${S.inv[k]}</button>`).join('')+(S.shieldOn?`<span class="hint" style="align-self:center">Shield ready: ${S.shieldOn}</span>`:'')}
  function use(k){if(!S.inv[k]||!cur||cur.locked)return;
    if(k==='fifty'){const w=[...$('#ans').children].filter((b,j)=>cur.opts[j]!==cur.a&&!b.classList.contains('gone'));if(w.length<2)return;shuf(w).slice(0,2).forEach(b=>b.classList.add('gone'))}
    if(k==='dbl')S.dblUntil=Math.max(Date.now(),S.dblUntil)+30000;if(k==='shield')S.shieldOn++;S.inv[k]--;pows();tick();c.fx.sfx('buy');c.fx.popup(POW[k].name+'!','small')}
  function shop(){
    $('#shop').innerHTML=Object.entries(UP).map(([k,u])=>{const lv=S.lv[k],max=lv>=u.vals.length-1,cs=u.cost[lv+1];
      return `<div class="card up"><h3>${u.name}</h3><p>${u.desc}</p><div class="dots">${u.vals.map((_,i)=>`<i class="${i<=lv?'on':''}"></i>`).join('')}</div><div class="vals"><span>Now ${u.f(u.vals[lv])}</span>${max?'<span>Max level</span>':`<span>Next ${u.f(u.vals[lv+1])}</span>`}</div><button class="btn" data-u="${k}" ${max||S.money<cs?'disabled':''}>${max?'Maxed':'Buy for '+fmt(cs)+'G'}</button></div>`}).join('')
    +`<div class="card powshop"><h3 style="margin:0 0 10px">Power-ups</h3><div class="pgrid">${Object.entries(POW).map(([k,p])=>`<div><b>${p.name}</b> <span class="hint">Have ${S.inv[k]}</span><p>${p.desc}</p><button class="btn" data-b="${k}" ${S.money<pc(k)?'disabled':''}>${fmt(pc(k))}G</button></div>`).join('')}</div><p class="hint">Use power-ups under the questions.</p></div>`}
  $('#ans').onclick=e=>{const b=e.target.closest('button');if(b)pick(+b.dataset.i)};
  $('#pows').onclick=e=>{const b=e.target.closest('[data-p]');if(b)use(b.dataset.p)};
  $('#shop').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.u){const k=b.dataset.u,cs=UP[k].cost[S.lv[k]+1];if(cs!=null&&S.money>=cs){S.money-=cs;S.lv[k]++;c.fx.sfx('buy');c.fx.popup(UP[k].name+' UP!','small')}}
    if(b.dataset.b){const k=b.dataset.b,cs=pc(k);if(S.money>=cs){S.money-=cs;S.inv[k]++;pows();c.fx.sfx('buy')}}top();shop()};
  function tick(){if(S.over)return;const el=(Date.now()-S.start)/1000;
    if(limit){const left=Math.max(0,limit-el);$('#clock').innerHTML=`Left <b>${mmss(left)}</b>`;$('#prog').style.width=left/limit*100+'%';if(left<=0)end()}
    else $('#clock').innerHTML=`Time <b>${mmss(el)}</b>`;
    const d=S.dblUntil-Date.now();$('#dbl').classList.toggle('hide',d<=0);if(d>0)$('#dbl').textContent=`2× ${Math.ceil(d/1000)}s`}
  function end(){if(S.over)return;S.over=true;clearInterval(tm);clearInterval(mt);
    const el=Math.round((Date.now()-S.start)/1000),tot=S.right+S.wrong,won=goal&&S.money>=goal;
    c.finish({title:won?`Goal reached in ${Math.floor(el/60)}m ${el%60}s!`:limit?`You collected ${fmt(S.money)}G`:'Gold Rush over',
      stats:[['Accuracy',acc(S.right,tot)],['Right',S.right+' / '+tot],['Best streak',S.best],['Gold earned',fmt(S.earned)+'G']],wrongs:S.wrongs,
      rec:won?{key:'gr-g',val:el}:limit?{key:'gr-t',val:S.money}:null,right:S.right,total:tot,score:won?'Goal in '+mmss(el):fmt(S.money)+'G'})}
  ask();top();tm=setInterval(tick,250);tick();
  return{stop(){S.over=true;clearInterval(tm);clearInterval(mt)},end,key(e){if(/^[1-4]$/.test(e.key)&&!$('#vQuiz').classList.contains('hide'))pick(+e.key-1);if(e.key==='s'||e.key==='S')tab($('#vShop').classList.contains('hide')?'shop':'quiz')}};
};

/* ===== Yes or No ===== */
I.ox=c=>{
  const {$}=c,sec=+c.opts.sec||60,next=c.dealer(),t0=Date.now();let score=0,streak=0,best=0,tot=0,wr=[],cur=null,over=false,lock=false,tm;
  c.stage.innerHTML=`<div class="qcard" id="oxc"><div class="qtag">Do these go together?</div><p class="q" id="oxq"></p><div class="oxeq">‖</div><p class="q oxa" id="oxa"></p><div class="fb" id="fb" aria-live="polite"></div></div>
  <div class="oxb"><button class="ob o" id="bO"><span>✓</span>Yes (←)</button><button class="ob x" id="bX"><span>✗</span>No (→)</button></div>`;
  function ask(){const q=c.makeQ(next()),others=q.opts.filter(x=>x!==q.a),truth=!others.length||Math.random()<.5;cur={q,truth};lock=false;$('#oxq').textContent=q.q;$('#oxa').textContent=truth?q.a:others[c.rnd(others.length)]}
  function pick(yes){if(lock||over)return;lock=true;tot++;const ok=yes===cur.truth,el=$('#oxc');
    if(ok){score++;streak++;best=Math.max(best,streak);$('#fb').innerHTML=`<span class="okc">${streak>2?`Correct! ${streak} in a row`:'Correct!'}</span>`}
    else{streak=0;wr.push(cur.q.card);$('#fb').innerHTML=`<span class="noc">Nope! It goes with: ${c.esc(cur.q.a)}</span>`}
    if(ok){c.hit(cur.q.card);c.fx.good(el);c.fx.combo(streak)}else c.fx.bad();el.classList.remove('good','badc');void el.offsetWidth;el.classList.add(ok?'good':'badc');stats();setTimeout(()=>{if(!over)ask()},ok?280:1100)}
  let ls=99;function stats(){const left=Math.max(0,sec-(Date.now()-t0)/1000);if(left<=5&&Math.ceil(left)<ls&&left>0){ls=Math.ceil(left);c.fx.sfx('tick')}c.setStats(`<span>Time left <b>${Math.ceil(left)}s</b></span><span>Right <b>${score}</b></span><span>Streak <b>${streak}</b></span>`);if(left<=0)end()}
  $('#bO').onclick=()=>pick(true);$('#bX').onclick=()=>pick(false);
  function end(){if(over)return;over=true;clearInterval(tm);c.finish({title:`${score} right!`,stats:[['Right',score],['Accuracy',acc(score,tot)],['Best streak',best],['Answered',tot]],wrongs:wr,rec:tot?{key:'ox',val:score}:null,right:score,total:tot,score:score+' right'})}
  ask();tm=setInterval(stats,200);stats();
  return{stop(){over=true;clearInterval(tm)},end,key(e){const k=e.key.toLowerCase();if(k==='arrowleft'||k==='o'||k==='y'||k==='1'){e.preventDefault();pick(true)}if(k==='arrowright'||k==='x'||k==='n'||k==='2'){e.preventDefault();pick(false)}}};
};

/* ===== Typing Challenge ===== */
I.type=c=>{
  const {$}=c,n=+c.opts.n||15,list=c.shuf(c.cards).slice(0,Math.min(n,c.cards.length));let i=0,right=0,hints=0,wrongs=[],state='ask',cur=null,over=false,hinted=false;
  c.stage.innerHTML=`<div class="qcard"><div class="qtag" id="qtag"></div><p class="q" id="q"></p><div class="fb" id="fb" aria-live="polite"></div></div>
  <form class="tform" id="tf" autocomplete="off"><input id="ti" aria-label="Your answer" placeholder="Type the answer, then Enter"><button class="btn" id="tb">Check</button></form>
  <div class="row center" style="margin-top:12px"><button class="btn ghost sm" id="hint" type="button">Hint (first letter)</button><button class="btn ghost sm hide" id="override" type="button">Count it as right</button></div>`;
  const N=s=>String(s).toLowerCase().normalize('NFC').replace(/[\s.,!?'"·()~\-_;:]/g,'');
  const ok=(v,a)=>{const x=N(v);if(!x)return false;if(x===N(a))return true;return!/\d/.test(a)&&a.split(/[,;\/]/).some(p=>N(p).length>1&&N(p)===x)};
  const stats=d=>c.setStats(`<span>Question <b>${Math.min(i+1,list.length)}</b> / ${list.length}</span><span>Right <b>${right}</b></span><span>Hints <b>${hints}</b></span>`);
  function ask(){if(i>=list.length)return end();const card=list[i],d=c.dir();cur={card,q:d==='f'?card.t:card.d,a:d==='f'?card.d:card.t};state='ask';hinted=false;
    $('#qtag').textContent=`Type the ${d==='f'?'back':'front'}`;$('#q').textContent=cur.q;$('#fb').textContent='';
    const ti=$('#ti');ti.value='';ti.readOnly=false;ti.focus();$('#tb').textContent='Check';$('#override').classList.add('hide');$('#hint').disabled=false;stats()}
  $('#tf').onsubmit=e=>{e.preventDefault();if(over)return;if(state==='shown'){i++;return ask()}
    const v=$('#ti').value;if(!v.trim())return;
    if(ok(v,cur.a)){right++;$('#fb').innerHTML='<span class="okc">Correct!</span>';c.hit(cur.card);c.fx.good($('#ti'))}else{c.fx.bad();wrongs.push(cur.card);$('#fb').innerHTML=`<span class="noc">Answer: ${c.esc(cur.a)}</span>`;$('#override').classList.remove('hide')}
    state='shown';$('#ti').readOnly=true;$('#tb').textContent='Next';$('#hint').disabled=true;$('#ti').focus();stats()};
  $('#hint').onclick=()=>{if(state!=='ask'||hinted)return;hinted=true;hints++;$('#fb').textContent=`First letter: ${cur.a.trim()[0]}`;$('#ti').focus();stats()};
  $('#override').onclick=()=>{right++;c.hit(wrongs.pop());$('#override').classList.add('hide');$('#fb').innerHTML='<span class="okc">Counted as right</span>';$('#ti').focus();stats()};
  function end(){if(over)return;over=true;const full=i>=list.length,tot=full?list.length:(state==='shown'?i+1:i),a=tot?Math.round(right/tot*100):0;
    c.finish({title:`${right} right (${a}%)`,stats:[['Accuracy',a+'%'],['Right',right+' / '+tot],['Hints',hints],['Missed',wrongs.length]],wrongs,rec:full?{key:'type',val:a}:null,right,total:tot,score:a+'%'})}
  ask();return{stop(){over=true},end};
};

/* ===== Monster Defense ===== */
I.def=c=>{
  const {$}=c,base=+c.opts.lvl||10,next=c.dealer();let hearts=3,kills=0,pos=0,cur=null,paused=false,over=false,raf=0,last=performance.now(),wrongs=[],tries=0,missed=false;
  const travel=()=>Math.max(base*.4,base-kills*.3);
  c.stage.innerHTML=`<div class="qcard slim"><div class="qtag" id="qtag"></div><p class="q" id="q"></p></div>
  <div class="lane" id="lane"><svg class="castle" viewBox="0 0 90 150" preserveAspectRatio="xMinYMax meet"><rect x="0" y="50" width="70" height="100" fill="#cfc6b0"/><rect x="0" y="50" width="70" height="12" fill="#b4aa92"/>${[0,24,48].map(x=>`<rect x="${x}" y="38" width="16" height="14" fill="#cfc6b0"/>`).join('')}<rect x="24" y="104" width="22" height="46" rx="11" fill="#5a4a32"/><line x1="35" y1="38" x2="35" y2="6" stroke="#5a4a32" stroke-width="3"/><path d="M35 6h26l-6 8 6 8H35z" fill="#f2b632"/></svg>
  <div class="mon" id="mon"><svg viewBox="0 0 100 100"><ellipse cx="50" cy="95" rx="30" ry="5" fill="#000" opacity=".25"/><path id="mb" d="M18 90 Q10 45 30 28 L26 10 L40 24 Q50 20 60 24 L74 10 L70 28 Q90 45 82 90 Z"/><ellipse cx="38" cy="50" rx="9" ry="11" fill="#fff"/><ellipse cx="62" cy="50" rx="9" ry="11" fill="#fff"/><circle cx="36" cy="52" r="4.5" fill="#1b1b1b"/><circle cx="60" cy="52" r="4.5" fill="#1b1b1b"/><path d="M36 72 Q50 64 64 72" stroke="#1b1b1b" stroke-width="4" fill="none" stroke-linecap="round"/></svg></div></div>
  <div class="ans" id="ans"></div>`;
  const lane=$('#lane'),mon=$('#mon');
  const stats=()=>c.setStats(`<span class="hearts" aria-label="Lives left: ${hearts}">${'♥'.repeat(hearts)}<span style="opacity:.3">${'♥'.repeat(3-hearts)}</span></span><span>Defeated <b>${kills}</b></span><span>Speed <b>${(base/travel()).toFixed(1)}×</b></span>`);
  function place(){const W=lane.clientWidth,cw=Math.min(90,W*.2);mon.style.transform=`translateX(${cw+(1-pos)*Math.max(0,W-cw-90)}px)`}
  function spawn(){cur=c.makeQ(next());missed=false;pos=0;mon.classList.remove('pop');$('#mb').setAttribute('fill',`hsl(${c.rnd(360)} 65% 52%)`);$('#qtag').textContent=cur.tag;$('#q').textContent=cur.q;c.drawAns($('#ans'),cur);place();paused=false}
  function loop(t){const dt=Math.min(.1,(t-last)/1000);last=t;if(!paused&&!over){pos+=dt/travel();if(pos>=1)reach();place()}if(!over)raf=requestAnimationFrame(loop)}
  function reach(){hearts--;c.fx.bad();c.fx.sfx('hit');if(!missed)wrongs.push(cur.card);lane.classList.remove('hit');void lane.offsetWidth;lane.classList.add('hit');stats();if(hearts<=0)return end();paused=true;setTimeout(()=>{if(!over)spawn()},400)}
  function pick(i){if(paused||over)return;const b=$('#ans').children[i];if(!b||b.classList.contains('bad'))return;tries++;
    if(cur.opts[i]===cur.a){kills++;paused=true;b.classList.add('right');mon.classList.add('pop');if(!missed)c.hit(cur.card);c.fx.good(mon);c.fx.sfx('boom');c.fx.combo(kills%10===0?kills:0);stats();setTimeout(()=>{if(!over)spawn()},420)}
    else{b.classList.add('bad');c.fx.bad();pos=Math.min(.97,pos+.18);if(!missed){missed=true;wrongs.push(cur.card)}}}
  function end(){if(over)return;over=true;cancelAnimationFrame(raf);c.finish({title:`You defeated ${kills} monster${kills===1?'':'s'}!`,stats:[['Defeated',kills],['Lives left',hearts],['Answers tried',tries],['Missed cards',wrongs.length]],wrongs,rec:{key:'def',val:kills},right:kills,total:kills+wrongs.length,score:kills+(kills===1?' monster':' monsters')})}
  $('#ans').onclick=e=>{const b=e.target.closest('button');if(b)pick(+b.dataset.i)};
  stats();spawn();raf=requestAnimationFrame(t=>{last=t;loop(t)});
  return{stop(){over=true;cancelAnimationFrame(raf)},end,key(e){if(/^[1-4]$/.test(e.key))pick(+e.key-1)}};
};

/* ===== Space Shooter ===== */
I.shoot=c=>{
  const {$}=c,base=+c.opts.lvl||10,next=c.dealer();
  c.stage.innerHTML=`<div class="qcard slim"><div class="qtag" id="qtag"></div><p class="q" id="q"></p></div><div id="cvh"></div><p class="hint center">Tap the right box or press 1–4 to fire · ←/→ to move, Space to fire straight up</p>`;
  const nar=c.stage.clientWidth<600,W=nar?480:800,H=nar?640:460,SY=H-46,K=c.mkCanvas($('#cvh'),W,H),g=K.g;
  const stars=Array.from({length:80},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.4+.4,v:Math.random()*30+12}));
  let streak=0,lives=3,score=0,wave=0,ship={x:400,tx:400},crates=[],lasers=[],parts=[],texts=[],cur=null,over=false,raf=0,last=0,right=0,tot=0,wr=[],waveMiss=false,busy=false,shake=0;
  const fallSpeed=()=>(SY-40)/Math.max(base*.45,base-wave*.28);
  const stats=()=>c.setStats(`<span class="hearts" aria-label="Shields: ${lives}">${'◆'.repeat(lives)}<span style="opacity:.3">${'◆'.repeat(3-lives)}</span></span><span>Score <b>${c.fmt(score)}</b></span><span>Wave <b>${wave+1}</b></span>`);
  function spawn(){cur=c.makeQ(next());waveMiss=false;busy=false;$('#qtag').textContent=`Wave ${wave+1} · ${cur.tag}`;$('#q').textContent=cur.q;
    const n=cur.opts.length,slot=(W-40)/n,w=Math.min(176,slot-10);
    crates=cur.opts.map((o,i)=>{const wr=c.wrapText(g,o,w-16,nar?4:3,nar?24:20);return{i,ok:o===cur.a,w,h:nar?110:86,x:20+(i+.5)*slot,y:-60-c.rnd(50),alive:true,wr,col:COL[i]}});stats()}
  function fireAt(cr){if(!cr||!cr.alive||over||busy||cr.y<-40)return;c.fx.sfx('laser');ship.tx=cr.x;lasers.push({cr,t:0,x0:ship.x})}
  function boom(x,y,col){for(let i=0;i<22;i++){const a=Math.random()*6.28,s=60+Math.random()*180;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.7,col})}}
  function resolve(cr){if(!cr.alive)return;cr.alive=false;tot++;boom(cr.x,cr.y,cr.ok?'#ffd76a':'#ff5d4a');
    if(cr.ok){right++;streak++;if(!waveMiss)c.hit(cur.card);{const r=K.cv.getBoundingClientRect();c.fx.good({x:r.left+cr.x/W*r.width,y:r.top+cr.y/H*r.height})}c.fx.sfx('boom');c.fx.combo(streak);const pts=100+Math.max(0,Math.round((SY-cr.y)/3))+wave*10;score+=pts;texts.push({x:cr.x,y:cr.y,t:'+'+pts,life:1,col:'#ffd76a'});wave++;busy=true;crates.forEach(x=>{if(x.alive){x.alive=false;boom(x.x,x.y,'#8899cc')}});setTimeout(()=>{if(!over)spawn()},650)}
    else{lives--;shake=.3;streak=0;c.fx.bad();texts.push({x:cr.x,y:cr.y,t:'Wrong!',life:1,col:'#ff8a7a'});if(!waveMiss){waveMiss=true;wr.push(cur.card)}if(lives<=0)setTimeout(end,500)}stats()}
  function update(dt){
    for(const s of stars){s.y+=s.v*dt;if(s.y>H){s.y=0;s.x=Math.random()*W}}
    if(!busy)for(const cr of crates){if(!cr.alive)continue;cr.y+=fallSpeed()*dt;
      if(cr.ok&&cr.y+cr.h/2>=SY-30){cr.alive=false;lives--;streak=0;c.fx.bad();shake=.35;tot++;if(!waveMiss){waveMiss=true;wr.push(cur.card)}texts.push({x:W/2,y:H/2,t:'Answer: '+cur.a,life:1.6,col:'#ffd76a'});busy=true;crates.forEach(x=>x.alive=false);stats();if(lives<=0)setTimeout(end,700);else setTimeout(()=>{if(!over)spawn()},1300)}}
    ship.x+=(ship.tx-ship.x)*Math.min(1,dt*9);
    for(const l of lasers){l.t+=dt*7;if(l.t>=1&&!l.done){l.done=true;resolve(l.cr)}}lasers=lasers.filter(l=>l.t<1.4);
    for(const p of parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=200*dt;p.life-=dt}parts=parts.filter(p=>p.life>0);
    for(const t of texts){t.y-=40*dt;t.life-=dt}texts=texts.filter(t=>t.life>0);shake=Math.max(0,shake-dt);
  }
  function draw(){K.begin();g.save();if(shake)g.translate((Math.random()-.5)*12*shake/.3,(Math.random()-.5)*8*shake/.3);
    const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0a1033');bg.addColorStop(1,'#1b1450');g.fillStyle=bg;g.fillRect(-10,-10,W+20,H+20);
    g.fillStyle='#fff';for(const s of stars){g.globalAlpha=.4+s.r/3;g.beginPath();g.arc(s.x,s.y,s.r,0,6.3);g.fill()}g.globalAlpha=1;
    g.fillStyle='rgba(120,240,255,.12)';g.fillRect(0,SY-30,W,2);
    for(const cr of crates){if(!cr.alive)continue;const x=cr.x-cr.w/2,y=cr.y-cr.h/2;
      g.fillStyle='rgba(0,0,0,.35)';c.rr(g,x+4,y+6,cr.w,cr.h,12);g.fill();g.fillStyle=cr.col;c.rr(g,x,y,cr.w,cr.h,12);g.fill();
      g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=2;c.rr(g,x+5,y+5,cr.w-10,cr.h-10,8);g.stroke();
      g.fillStyle='#fff';g.beginPath();g.arc(x+6,y+6,13,0,6.3);g.fill();g.fillStyle=cr.col;g.font='900 15px "Noto Sans KR",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(cr.i+1,x+6,y+7);
      c.drawLines(g,cr.wr,cr.x,cr.y+2,'#fff')}
    for(const l of lasers){const t=Math.min(1,l.t),tx=l.cr.x,ty=l.cr.y+l.cr.h/2;g.strokeStyle='rgba(123,240,255,'+(1.4-l.t)+')';g.lineWidth=5;g.beginPath();g.moveTo(l.x0,SY-14);g.lineTo(l.x0+(tx-l.x0)*t,SY-14+(ty-SY+14)*t);g.stroke()}
    g.save();g.translate(ship.x,SY);g.fillStyle='#ff9a3d';g.beginPath();g.moveTo(-8,22);g.lineTo(0,34+Math.random()*8);g.lineTo(8,22);g.fill();
    g.fillStyle='#e8ecff';g.beginPath();g.moveTo(0,-26);g.lineTo(22,22);g.lineTo(0,14);g.lineTo(-22,22);g.closePath();g.fill();g.fillStyle='#2f74e0';g.beginPath();g.arc(0,2,6,0,6.3);g.fill();g.restore();
    for(const p of parts){g.globalAlpha=Math.max(0,p.life/.7);g.fillStyle=p.col;g.fillRect(p.x-3,p.y-3,6,6)}g.globalAlpha=1;
    for(const t of texts){g.globalAlpha=Math.min(1,t.life);const w=c.wrapText(g,t.t,W-80,2,28,900);c.drawLines(g,w,t.x,t.y,t.col,900)}g.globalAlpha=1;g.restore()}
  function loop(ts){if(over)return;const dt=Math.min(.05,(ts-last)/1000||0);last=ts;update(dt);draw();raf=requestAnimationFrame(loop)}
  K.cv.addEventListener('pointerdown',e=>{e.preventDefault();const p=K.pt(e);const cr=crates.find(x=>x.alive&&Math.abs(p.x-x.x)<x.w/2+6&&Math.abs(p.y-x.y)<x.h/2+6);if(cr)fireAt(cr);else ship.tx=Math.max(30,Math.min(W-30,p.x))});
  function end(){if(over)return;over=true;cancelAnimationFrame(raf);K.ro.disconnect();c.finish({title:`${c.fmt(score)} points!`,stats:[['Score',c.fmt(score)],['Waves',wave],['Accuracy',acc(right,tot)],['Missed cards',wr.length]],wrongs:wr,rec:{key:'shoot',val:score},right,total:Math.max(tot,right),score:c.fmt(score)+' pts'})}
  spawn();raf=requestAnimationFrame(t=>{last=t;loop(t)});
  return{stop(){over=true;cancelAnimationFrame(raf);K.ro.disconnect()},end,key(e){
    if(/^[1-4]$/.test(e.key))fireAt(crates[+e.key-1]);
    if(e.key==='ArrowLeft'){e.preventDefault();ship.tx=Math.max(30,ship.tx-70)}if(e.key==='ArrowRight'){e.preventDefault();ship.tx=Math.min(W-30,ship.tx+70)}
    if(e.key===' '){e.preventDefault();const cr=crates.find(x=>x.alive&&Math.abs(x.x-ship.x)<x.w/2);if(cr)fireAt(cr)}}};
};

/* ===== Lane Runner ===== */
I.run=c=>{
  const {$}=c,base=+c.opts.lvl||10,next=c.dealer();
  c.stage.innerHTML=`<div class="qcard slim"><div class="qtag" id="qtag"></div><p class="q" id="q"></p></div><div id="cvh"></div><p class="hint center">←/→ or tap a lane to move · number keys jump to that lane</p>`;
  const nar=c.stage.clientWidth<600,W=nar?480:800,H=nar?680:500,PY=H-70,RL=nar?22:90,RW=W-2*RL,K=c.mkCanvas($('#cvh'),W,H),g=K.g;
  const GH=nar?96:70;let sT=0,lanes=4,lane=1,px=1,row=null,T=base*.62,dist=0,lives=3,right=0,tot=0,wr=[],combo=0,over=false,raf=0,last=0,scroll=0,msg=null,flash=0,cur=null;
  const lx=i=>RL+(i+.5)*(RW/lanes);
  const stats=()=>c.setStats(`<span class="hearts" aria-label="Lives left: ${lives}">${'♥'.repeat(lives)}<span style="opacity:.3">${'♥'.repeat(3-lives)}</span></span><span>Distance <b>${c.fmt(dist)}m</b></span><span>Combo <b>${combo}</b></span>`);
  function newRow(){cur=c.makeQ(next());lanes=cur.opts.length;lane=Math.min(lane,lanes-1);px=Math.min(px,lanes-1);
    const w=RW/lanes-(nar?8:16);row={y:-80,items:cur.opts.map((o,i)=>({o,ok:o===cur.a,wr:c.wrapText(g,o,w-12,nar?4:3,nar?21:19)}))};$('#qtag').textContent=cur.tag;$('#q').textContent=cur.q;stats()}
  function cross(){const ok=row.items[lane].ok;tot++;
    if(ok){right++;combo++;c.hit(cur.card);c.fx.good(K.cv);c.fx.combo(combo);T=Math.max(base*.28,T-.2);msg={t:combo>2?`Nice! ${combo} combo`:'Passed!',col:'#ffd76a',life:.9}}
    else{lives--;combo=0;flash=.4;c.fx.bad();wr.push(cur.card);msg={t:'Answer: '+cur.a,col:'#ff8a7a',life:1.6}}
    row=null;stats();if(lives<=0)setTimeout(end,600);else setTimeout(()=>{if(!over)newRow()},ok?350:1100)}
  function update(dt){const v=(PY+80)/T;scroll=(scroll+v*dt)%60;dist+=v*dt/12;px+=(lane-px)*Math.min(1,dt*12);
    if(row){row.y+=v*dt;if(row.y+GH/2>=PY-30)cross()}sT+=dt;if(sT>.25){sT=0;stats()}if(msg){msg.life-=dt;if(msg.life<=0)msg=null}flash=Math.max(0,flash-dt)}
  function draw(){K.begin();g.fillStyle='#3f7a3a';g.fillRect(0,0,W,H);
    g.fillStyle='#4c8c45';for(let y=-60+scroll;y<H;y+=60){g.fillRect(0,y,RL-14,24);g.fillRect(RL+RW+14,y+30,W,24)}
    g.fillStyle='#3a3f47';g.fillRect(RL-10,0,RW+20,H);g.fillStyle='#f2b632';g.fillRect(RL-10,0,5,H);g.fillRect(RL+RW+5,0,5,H);
    g.strokeStyle='rgba(244,239,227,.7)';g.lineWidth=4;g.setLineDash([26,34]);g.lineDashOffset=-scroll;for(let i=1;i<lanes;i++){const x=RL+i*RW/lanes;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}g.setLineDash([]);
    if(row)row.items.forEach((it,i)=>{const w=RW/lanes-(nar?8:16),x=lx(i)-w/2,y=row.y-GH/2;g.fillStyle='rgba(0,0,0,.3)';c.rr(g,x+3,y+6,w,GH,10);g.fill();g.fillStyle=COL[i];c.rr(g,x,y,w,GH,10);g.fill();
      g.fillStyle='rgba(255,255,255,.9)';g.font='900 13px "Noto Sans KR",sans-serif';g.textAlign='left';g.textBaseline='top';g.fillText(i+1,x+8,y+5);c.drawLines(g,it.wr,lx(i),row.y,'#fff')});
    const x=RL+(px+.5)*(RW/lanes);g.save();g.translate(x,PY);g.fillStyle='rgba(0,0,0,.3)';c.rr(g,-24,-30,52,72,14);g.fill();g.fillStyle='#ffd76a';c.rr(g,-26,-36,52,72,14);g.fill();
    g.fillStyle='#26305e';c.rr(g,-18,-24,36,18,5);g.fill();g.fillStyle='#e9503f';g.fillRect(-26,18,10,8);g.fillRect(16,18,10,8);g.restore();
    if(flash){g.fillStyle=`rgba(255,60,40,${flash})`;g.fillRect(0,0,W,H)}
    if(msg){g.globalAlpha=Math.min(1,msg.life*2);const w=c.wrapText(g,msg.t,W-120,2,30,900);g.fillStyle='rgba(12,34,30,.75)';c.rr(g,40,H/2-60,W-80,100,16);g.fill();c.drawLines(g,w,W/2,H/2-10,msg.col,900);g.globalAlpha=1}}
  function loop(ts){if(over)return;const dt=Math.min(.05,(ts-last)/1000||0);last=ts;update(dt);draw();raf=requestAnimationFrame(loop)}
  K.cv.addEventListener('pointerdown',e=>{e.preventDefault();const p=K.pt(e);if(p.x>=RL&&p.x<=RL+RW)lane=Math.max(0,Math.min(lanes-1,Math.floor((p.x-RL)/(RW/lanes))));else lane=p.x<RL?Math.max(0,lane-1):Math.min(lanes-1,lane+1)});
  function end(){if(over)return;over=true;cancelAnimationFrame(raf);K.ro.disconnect();const d=Math.round(dist);c.finish({title:`You ran ${c.fmt(d)}m!`,stats:[['Distance',c.fmt(d)+'m'],['Gates passed',right],['Accuracy',acc(right,tot)],['Missed cards',wr.length]],wrongs:wr,rec:{key:'run',val:d},right,total:tot,score:c.fmt(d)+'m'})}
  newRow();raf=requestAnimationFrame(t=>{last=t;loop(t)});
  return{stop(){over=true;cancelAnimationFrame(raf);K.ro.disconnect()},end,key(e){const k=e.key;
    if(k==='ArrowLeft'||k==='a'||k==='A'){e.preventDefault();lane=Math.max(0,lane-1)}if(k==='ArrowRight'||k==='d'||k==='D'){e.preventDefault();lane=Math.min(lanes-1,lane+1)}
    if(/^[1-4]$/.test(k)&&+k<=lanes)lane=+k-1}};
};

/* ===== Quiz Snake ===== */
I.snake=c=>{
  const {$}=c,CO=20,RO=13,CS=40,t0ms=+c.opts.spd||165,next=c.dealer();
  c.stage.innerHTML=`<div class="qcard slim"><div class="qtag" id="qtag"></div><p class="q" id="q"></p></div>
  <div class="snk"><div><div id="cvh"></div><div class="dpad" id="dpad"><span></span><button data-d="0,-1" aria-label="Up">▲</button><span></span><button data-d="-1,0" aria-label="Left">◀</button><button data-d="0,1" aria-label="Down">▼</button><button data-d="1,0" aria-label="Right">▶</button></div></div><ol class="foods" id="foods"></ol></div>`;
  const K=c.mkCanvas($('#cvh'),CO*CS,RO*CS),g=K.g;
  let snake,dir,ndir,grow=0,foods=[],started=false,lives=3,score=0,tot=0,wr=[],over=false,raf=0,last=0,accT=0,tick=t0ms,cur=null,missed=false,msg='Press an arrow to start!',flash=0;
  const reset=()=>{snake=[{x:6,y:6},{x:5,y:6},{x:4,y:6},{x:3,y:6}];dir={x:1,y:0};ndir=dir;started=false};
  const stats=()=>c.setStats(`<span class="hearts" aria-label="Lives left: ${lives}">${'♥'.repeat(lives)}<span style="opacity:.3">${'♥'.repeat(3-lives)}</span></span><span>Eaten <b>${score}</b></span><span>Length <b>${snake.length}</b></span>`);
  const occ=(x,y)=>snake.some(s=>s.x===x&&s.y===y)||foods.some(f=>f.x===x&&f.y===y);
  function place(){const h=snake[0];let x,y,t=0;do{x=c.rnd(CO);y=c.rnd(RO);t++}while((occ(x,y)||Math.abs(x-h.x)+Math.abs(y-h.y)<4)&&t<400);return{x,y}}
  function newQ(){cur=c.makeQ(next());missed=false;foods=[];cur.opts.forEach((o,i)=>{const p=place();foods.push({...p,i,ok:o===cur.a})});
    $('#qtag').textContent=cur.tag;$('#q').textContent=cur.q;$('#foods').innerHTML=cur.opts.map((o,i)=>`<li><span class="fdot" style="background:${COL[i]}">${i+1}</span><span>${c.esc(o)}</span></li>`).join('')}
  function step(){if(ndir.x!==-dir.x||ndir.y!==-dir.y)dir=ndir;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
    if(h.x<0||h.y<0||h.x>=CO||h.y>=RO||snake.slice(0,-1).some(s=>s.x===h.x&&s.y===h.y))return crash();
    snake.unshift(h);const f=foods.find(f=>f.x===h.x&&f.y===h.y);if(f)eat(f);if(grow>0)grow--;else snake.pop()}
  function eat(f){tot++;{const r=K.cv.getBoundingClientRect(),p={x:r.left+(f.x+.5)/CO*r.width,y:r.top+(f.y+.5)/RO*r.height};if(f.ok){if(!missed)c.hit(cur.card);c.fx.good(p);c.fx.combo(score+1>=3&&(score+1)%3===0?score+1:0)}else c.fx.bad()}if(f.ok){score++;grow+=2;tick=Math.max(75,tick-6);msg='';newQ()}
    else{lives--;flash=.4;foods=foods.filter(x=>x!==f);if(!missed){missed=true;wr.push(cur.card)}for(let i=0;i<2&&snake.length>3;i++)snake.pop();if(lives<=0)return end()}stats()}
  function crash(){lives--;flash=.5;c.fx.bad();c.fx.sfx('hit');if(lives<=0){stats();return end()}reset();stats();foods.forEach(f=>{if(Math.abs(f.x-6)+Math.abs(f.y-6)<3){const p=place();f.x=p.x;f.y=p.y}});msg='Crash! Press an arrow to go again'}
  function draw(){K.begin();for(let y=0;y<RO;y++)for(let x=0;x<CO;x++){g.fillStyle=(x+y)%2?'#5d9d3c':'#67a845';g.fillRect(x*CS,y*CS,CS,CS)}
    for(const f of foods){const cx=f.x*CS+CS/2,cy=f.y*CS+CS/2;g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.arc(cx+2,cy+3,15,0,6.3);g.fill();g.fillStyle=COL[f.i];g.beginPath();g.arc(cx,cy,15,0,6.3);g.fill();g.fillStyle='#fff';g.font='900 17px "Noto Sans KR",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(f.i+1,cx,cy+1)}
    snake.forEach((s,i)=>{g.fillStyle=i?'#f2b632':'#ffd76a';c.rr(g,s.x*CS+3,s.y*CS+3,CS-6,CS-6,10);g.fill();if(!i){g.fillStyle='#1b1b1b';const ex=dir.x,ey=dir.y;g.beginPath();g.arc(s.x*CS+20+ex*7-ey*7,s.y*CS+20+ey*7-ex*7,3.5,0,6.3);g.arc(s.x*CS+20+ex*7+ey*7,s.y*CS+20+ey*7+ex*7,3.5,0,6.3);g.fill()}});
    if(flash){g.fillStyle=`rgba(255,60,40,${flash})`;g.fillRect(0,0,CO*CS,RO*CS)}
    if(!started&&msg){g.fillStyle='rgba(12,34,30,.7)';c.rr(g,200,210,400,100,16);g.fill();c.drawLines(g,c.wrapText(g,msg,360,2,26,900),400,260,'#fff',900)}}
  function loop(ts){if(over)return;const dt=Math.min(.1,(ts-last)/1000||0);last=ts;flash=Math.max(0,flash-dt);accT+=dt*1000;while(accT>=tick){accT-=tick;if(started&&!over)step()}if(!over){draw();raf=requestAnimationFrame(loop)}}
  function setDir(x,y){if(over)return;if(started&&x===-dir.x&&y===-dir.y)return;if(!started&&x===-dir.x&&y===-dir.y)dir={x,y};ndir={x,y};started=true}
  $('#dpad').onclick=e=>{const b=e.target.closest('[data-d]');if(b){const [x,y]=b.dataset.d.split(',').map(Number);setDir(x,y)}};
  let ts0=null;K.cv.addEventListener('touchstart',e=>{ts0=K.pt(e)},{passive:true});
  K.cv.addEventListener('touchend',e=>{if(!ts0)return;const p=K.pt(e),dx=p.x-ts0.x,dy=p.y-ts0.y;if(Math.max(Math.abs(dx),Math.abs(dy))>25){if(Math.abs(dx)>Math.abs(dy))setDir(Math.sign(dx),0);else setDir(0,Math.sign(dy))}ts0=null});
  function end(){if(over)return;over=true;cancelAnimationFrame(raf);K.ro.disconnect();c.finish({title:`You ate ${score} right answer${score===1?'':'s'}!`,stats:[['Eaten',score],['Final length',snake.length],['Accuracy',acc(score,tot)],['Missed cards',wr.length]],wrongs:wr,rec:{key:'snake',val:score},right:score,total:Math.max(tot,score),score:score+' right'})}
  reset();newQ();stats();raf=requestAnimationFrame(t=>{last=t;loop(t)});
  return{stop(){over=true;cancelAnimationFrame(raf);K.ro.disconnect()},end,key(e){const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],W:[0,-1],S:[0,1],A:[-1,0],D:[1,0]}[e.key];if(m){e.preventDefault();setDir(m[0],m[1])}}};
};

/* ===== Sky Tower ===== */
I.obby=c=>{
  const {$}=c,goal=+(c.opts.goal==null?40:c.opts.goal),inf=!goal,LIMIT=180,next=c.dealer(),t0=Date.now(),MAXE=12;
  c.stage.innerHTML=`<div class="obw"><div class="obl"><div id="cvh"></div><div class="obpad" id="obpad"><button data-k="L" aria-label="Left">◀</button><button data-k="J" class="jb" aria-label="Jump">Jump</button><button data-k="R" aria-label="Right">▶</button></div></div>
  <div class="obr"><div class="energy"><span>Energy</span><div class="ebar" id="ebw"><i id="eb"></i></div><b id="en"></b></div><div class="qcard slim" id="qc"><div class="qtag" id="qtag"></div><p class="q" id="q"></p><div class="fb" id="fb" aria-live="polite"></div></div><div class="ans" id="ans"></div>
  <p class="hint">Right answer = +3 energy (+1 more for every 3 in a row). Each jump uses 1 energy. ←/→ to move, Space or ↑ to jump, 1–4 to answer.</p></div></div>`;
  const W=480,H=680,K=c.mkCanvas($('#cvh'),W,H),g=K.g;
  const narrow=matchMedia('(max-width:860px)').matches;K.wrap.style.maxWidth=narrow?`calc(46vh * ${W/H})`:`calc(72vh * ${W/H})`;K.fit();
  const SP=86,N=goal||400,plats=[{x:0,y:0,w:W,h:40,t:'ground',fl:0}];let lx=W/2;
  for(let i=1;i<=N;i++){const cp=i%10===0,top=goal&&i===goal,wd=cp||top?W:Math.max(62,138-i*1.1+c.rnd(26));let x=0,tries=0;
    if(!cp&&!top)do{x=16+Math.random()*(W-32-wd);tries++}while(Math.abs(x+wd/2-lx)>190&&tries<40);
    if(!cp&&!top)lx=x+wd/2;let t=top?'top':cp?'cp':'n';
    if(t==='n'){const r=Math.random();if(i>5&&r<.2)t='move';else if(i>11&&r<.34)t='crumb';else if(i>3&&r<.42&&i%10<8)t='spring'}
    plats.push({x,ox:x,y:-i*SP,w:wd,h:t==='cp'||t==='top'?22:16,t,fl:i,ph:Math.random()*6.28,sp:.8+Math.random()*.9,st:0,gone:0,dx:0})}
  const clouds=Array.from({length:40},(_,i)=>({x:Math.random()*W,y:-i*260-Math.random()*200,s:.6+Math.random()*.8}));
  const stars=Array.from({length:70},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.4+.3}));
  const pl={x:W/2-17,y:-44,w:34,h:44,vx:0,vy:0,on:plats[0],face:1,coy:0,buf:0,sq:1};
  let energy=5,best=0,cp=0,falls=0,right=0,tot=0,streak=0,wr=[],cur=null,lock=false,over=false,raf=0,last=0,T=0,camY=-(H-40),keys={L:0,R:0},parts=[],noE=0,msg=null,maxFallFrom=0;
  const img=new Image();let imgOk=false;img.onload=()=>{imgOk=true};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(c.avatar().replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="120" height="132" '));
  function stats(){const el=(Date.now()-t0)/1000;c.setStats(`<span>Floor <b>${pl.on?pl.on.fl:'—'}</b></span><span>Best <b>${best}</b>${goal?` / ${goal}`:''}</span><span>${inf?'Left':'Time'} <b>${c.mmss(inf?Math.max(0,LIMIT-el):el)}</b></span><span>Falls <b>${falls}</b></span>`);if(inf&&el>=LIMIT)end(false)}
  function eui(){$('#en').textContent=`${energy} / ${MAXE}`;$('#eb').style.width=energy/MAXE*100+'%';$('#ebw').classList.toggle('low',energy<=1)}
  function ask(){cur=c.makeQ(next());lock=false;$('#qtag').textContent=cur.tag;$('#q').textContent=cur.q;$('#fb').textContent='';c.drawAns($('#ans'),cur)}
  function pick(i){if(lock||over)return;const bs=[...$('#ans').children];if(!bs[i])return;lock=true;tot++;$('#ans').classList.add('lock');const ok=cur.opts[i]===cur.a;
    bs.forEach((b,j)=>{if(cur.opts[j]===cur.a)b.classList.add('right');else if(j===i)b.classList.add('bad')});
    if(ok){right++;streak++;const gn=3+(streak%3===0?1:0),before=energy;energy=Math.min(MAXE,energy+gn);c.hit(cur.card);c.fx.good(bs[i]);c.fx.combo(streak);c.floatTxt($('#qc'),`+${energy-before} energy`,'var(--ok)');$('#fb').innerHTML=energy===MAXE?'<span class="okc">Energy full!</span>':'<span class="okc">Correct!</span>'}
    else{streak=0;wr.push(cur.card);c.fx.bad(bs[i]);$('#fb').innerHTML=`<span class="noc">Answer: ${c.esc(cur.a)}</span>`}
    eui();setTimeout(()=>{if(!over)ask()},ok?450:1300)}
  $('#ans').onclick=e=>{const b=e.target.closest('button');if(b)pick(+b.dataset.i)};
  function dust(x,y,n,col){for(let i=0;i<n;i++)parts.push({x,y,vx:(Math.random()-.5)*160,vy:-Math.random()*120,life:.5,col:col||'rgba(255,255,255,.8)'})}
  function land(p){pl.on=p;pl.y=p.y-pl.h;pl.vy=0;pl.sq=.75;dust(pl.x+pl.w/2,p.y,6);
    if(p.t==='spring'){pl.vy=-1090;pl.on=null;pl.sq=1.3;c.fx.sfx('combo',8);p.boing=.25}
    if(p.t==='crumb'&&!p.st)p.st=.001;
    if(p.fl>best){if(p.fl>=best+1&&p.t==='cp'){cp=p.fl;msg={t:`Checkpoint: floor ${p.fl}!`,life:1.4};c.fx.sfx('win')}best=p.fl;if(best%5===0&&p.t!=='cp'&&p.t!=='top')c.fx.sfx('coin')}
    if(maxFallFrom-p.fl>=3){falls++;msg={t:"Don't look down!",life:1.2};c.fx.bad();}
    maxFallFrom=p.fl;
    if(p.t==='top')setTimeout(()=>end(true),500)}
  function jump(){pl.buf=.14}
  function update(dt){T+=dt;
    for(const p of plats){if(p.t==='move'){const nx=Math.max(0,Math.min(W-p.w,p.ox+Math.sin(T*p.sp+p.ph)*70));p.dx=nx-p.x;p.x=nx}
      if(p.t==='crumb'){if(p.gone>0){p.gone-=dt;if(p.gone<=0)p.st=0}else if(p.st>0){p.st+=dt;if(p.st>.55){p.gone=3;p.st=0;dust(p.x+p.w/2,p.y,10,'#b58b5a');c.fx.sfx('hit')}}}
      if(p.boing)p.boing=Math.max(0,p.boing-dt)}
    const ax=(keys.R?1:0)-(keys.L?1:0);pl.vx=ax*235;if(ax)pl.face=ax;
    if(pl.on&&pl.on.dx)pl.x+=pl.on.dx;pl.x=Math.max(0,Math.min(W-pl.w,pl.x+pl.vx*dt));
    pl.coy-=dt;pl.buf-=dt;
    if(pl.buf>0&&(pl.on||pl.coy>0)){if(energy>0){energy--;eui();pl.vy=-725;pl.on=null;pl.coy=0;pl.buf=0;pl.sq=1.25;c.fx.sfx('jump');dust(pl.x+pl.w/2,pl.y+pl.h,4)}else{pl.buf=0;noE=1.2;c.fx.sfx('bad')}}
    if(pl.on){const p=pl.on;if(p.gone>0||pl.x+pl.w<p.x+6||pl.x>p.x+p.w-6){pl.on=null;pl.coy=.09}else pl.y=p.y-pl.h}
    if(!pl.on){const pb=pl.y+pl.h;pl.vy=Math.min(1150,pl.vy+1850*dt);pl.y+=pl.vy*dt;
      if(pl.vy>=0)for(const p of plats){if(p.gone>0||p.y<pl.y-20||p.y>pb+pl.vy*dt+60)continue;if(pb<=p.y+2&&pl.y+pl.h>=p.y&&pl.x+pl.w>p.x+6&&pl.x<p.x+p.w-6){land(p);break}}
      if(cp&&pl.y>-cp*SP+10){const p=plats[cp];land(p)}}
    pl.sq+=(1-pl.sq)*Math.min(1,dt*10);
    const target=Math.min(pl.y-H*.6,-(H-40));camY+=(target-camY)*Math.min(1,dt*6);
    for(const q of parts){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=400*dt;q.life-=dt}parts=parts.filter(q=>q.life>0);
    noE=Math.max(0,noE-dt);if(msg){msg.life-=dt;if(msg.life<=0)msg=null}
  }
  const mix=(a,b,k)=>{const pa=[a>>16,(a>>8)&255,a&255],pb=[b>>16,(b>>8)&255,b&255];return`rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*k)).join(',')})`};
  function sky(h){const st=[[0,0x7cc6ff,0xd8f1ff],[1600,0x5aa8f0,0xffd9a8],[3200,0xff9e6b,0x6a3d8f],[4800,0x2a1f5c,0x0b0d2e],[9999,0x0b0d2e,0x05060f]];for(let i=0;i<st.length-1;i++)if(h<st[i+1][0]){const k=(h-st[i][0])/(st[i+1][0]-st[i][0]);return[mix(st[i][1],st[i+1][1],k),mix(st[i][2],st[i+1][2],k),h>3800?Math.min(1,(h-3800)/1200):0]}return['#0b0d2e','#05060f',1]}
  function draw(){K.begin();const h=-camY-H,[top,bot,night]=sky(Math.max(0,h));const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,top);gr.addColorStop(1,bot);g.fillStyle=gr;g.fillRect(0,0,W,H);
    if(night){g.fillStyle='#fff';for(const s of stars){g.globalAlpha=night*(.4+s.r/2);g.beginPath();g.arc(s.x,s.y,s.r,0,6.3);g.fill()}g.globalAlpha=1}
    g.fillStyle=`rgba(255,255,255,${.75-night*.6})`;for(const cl of clouds){const y=cl.y-camY*.5;const sy=((y%(H+200))+H+200)%(H+200)-100;g.beginPath();g.ellipse(cl.x,sy,46*cl.s,14*cl.s,0,0,6.3);g.ellipse(cl.x+26*cl.s,sy-8*cl.s,26*cl.s,14*cl.s,0,0,6.3);g.fill()}
    for(const p of plats){const y=p.y-camY;if(y<-60||y>H+60)continue;if(p.gone>0){g.globalAlpha=.15}
      let x=p.x;if(p.t==='crumb'&&p.st>0)x+=Math.sin(T*60)*2;
      if(p.t==='ground'){g.fillStyle='#5cc45c';g.fillRect(0,y,W,10);g.fillStyle='#6b4f3a';g.fillRect(0,y+10,W,60)}
      else if(p.t==='cp'||p.t==='top'){const gold=p.t==='top';g.fillStyle=gold?'#f2b632':'#8f9b96';c.rr(g,x,y,p.w,p.h,6);g.fill();g.fillStyle=gold?'#b97c06':'#6e7a75';g.fillRect(x,y+p.h-6,p.w,6);
        g.strokeStyle='#5a4a32';g.lineWidth=3;g.beginPath();g.moveTo(W-40,y);g.lineTo(W-40,y-46);g.stroke();g.fillStyle=gold?'#e9503f':(cp>=p.fl?'#22b468':'#f4efe3');g.beginPath();g.moveTo(W-40,y-46);g.lineTo(W-14,y-38);g.lineTo(W-40,y-30);g.fill();
        g.fillStyle=gold?'#2a1d00':'#fff';g.font='900 13px "Noto Sans KR",sans-serif';g.textAlign='left';g.textBaseline='middle';g.fillText(gold?`Top! Floor ${p.fl}`:`Checkpoint · floor ${p.fl}`,12,y+p.h/2)}
      else{const col={n:['#5cc45c','#6b4f3a'],move:['#9fb8ff','#5a7bd6'],crumb:['#e3c28f','#b58b5a'],spring:['#5cc45c','#6b4f3a']}[p.t];
        g.fillStyle=col[1];c.rr(g,x,y,p.w,p.h,5);g.fill();g.fillStyle=col[0];c.rr(g,x,y,p.w,6,4);g.fill();
        if(p.t==='crumb'){g.strokeStyle='#7a5a36';g.lineWidth=1.5;g.beginPath();g.moveTo(x+p.w*.3,y+3);g.lineTo(x+p.w*.38,y+12);g.moveTo(x+p.w*.65,y+4);g.lineTo(x+p.w*.58,y+13);g.stroke()}
        if(p.t==='move'){g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.moveTo(x+8,y+10);g.lineTo(x+14,y+7);g.lineTo(x+14,y+13);g.fill();g.beginPath();g.moveTo(x+p.w-8,y+10);g.lineTo(x+p.w-14,y+7);g.lineTo(x+p.w-14,y+13);g.fill()}
        if(p.t==='spring'){const cx=x+p.w/2,hh=p.boing?16:10;g.strokeStyle='#cfd6dd';g.lineWidth=3;g.beginPath();for(let k=0;k<=4;k++)g.lineTo(cx+(k%2?-8:8),y-k*hh/4);g.stroke();g.fillStyle='#e9503f';c.rr(g,cx-14,y-hh-5,28,6,3);g.fill()}}
      if(p.fl&&p.fl%5===0&&p.t!=='cp'&&p.t!=='top'){g.fillStyle='rgba(0,0,0,.35)';g.font='700 11px "Noto Sans KR",sans-serif';g.textAlign='left';g.fillText('F'+p.fl,4,y-8)}
      g.globalAlpha=1}
    for(const q of parts){g.globalAlpha=Math.max(0,q.life*2);g.fillStyle=q.col;g.fillRect(q.x-2,q.y-2,4,4)}g.globalAlpha=1;
    const px=pl.x+pl.w/2,py=pl.y-camY+pl.h;g.save();g.translate(px,py);g.scale(pl.face*(2-pl.sq)*.9+pl.face*.1,pl.sq);
    if(imgOk)g.drawImage(img,-pl.w*.75,-pl.h*1.12,pl.w*1.5,pl.h*1.2);else{g.fillStyle='#ff6b57';g.beginPath();g.arc(0,-pl.h/2,pl.w/2,0,6.3);g.fill()}g.restore();
    g.fillStyle='rgba(12,34,30,.72)';c.rr(g,10,10,150,30,10);g.fill();g.fillStyle='#fff';g.font='900 15px "Noto Sans KR",sans-serif';g.textAlign='left';g.textBaseline='middle';g.fillText(`Floor ${pl.on?pl.on.fl:best}${goal?` / ${goal}`:''}`,22,26);
    if(energy===0||noE){g.fillStyle=`rgba(233,80,63,${noE?.92:.75})`;c.rr(g,W/2-170,H-60,340,40,12);g.fill();g.fillStyle='#fff';g.textAlign='center';g.font='900 15px "Noto Sans KR",sans-serif';g.fillText(narrow?'No energy! Answer below to get more':'No energy! Answer on the right →',W/2,H-40)}
    if(msg){g.globalAlpha=Math.min(1,msg.life*2);g.fillStyle='rgba(12,34,30,.78)';c.rr(g,60,H*.32,W-120,64,16);g.fill();g.fillStyle='#ffd76a';g.textAlign='center';g.font='900 26px "Noto Sans KR",sans-serif';g.fillText(msg.t,W/2,H*.32+33);g.globalAlpha=1}}
  let st=0;function loop(ts){if(over)return;const dt=Math.min(.033,(ts-last)/1000||0);last=ts;update(dt);draw();st+=dt;if(st>.25){st=0;stats()}raf=requestAnimationFrame(loop)}
  const KD=e=>{if(over||(e.target.matches&&e.target.matches('input,textarea,select')))return;const k=e.key;
    if(k==='ArrowLeft'||k==='a'||k==='A'){keys.L=1;e.preventDefault()}else if(k==='ArrowRight'||k==='d'||k==='D'){keys.R=1;e.preventDefault()}
    else if(k===' '||k==='ArrowUp'||k==='w'||k==='W'){if(!e.repeat)jump();e.preventDefault()}else if(/^[1-4]$/.test(k))pick(+k-1)};
  const KU=e=>{const k=e.key;if(k==='ArrowLeft'||k==='a'||k==='A')keys.L=0;if(k==='ArrowRight'||k==='d'||k==='D')keys.R=0};
  document.addEventListener('keydown',KD);document.addEventListener('keyup',KU);
  const pad=$('#obpad');const dn=e=>{const b=e.target.closest('[data-k]');if(!b)return;e.preventDefault();const k=b.dataset.k;if(k==='J')jump();else keys[k]=1;SFX_init()};const up=e=>{const b=e.target.closest('[data-k]');if(b&&b.dataset.k!=='J')keys[b.dataset.k]=0};
  const SFX_init=()=>{};pad.addEventListener('pointerdown',dn);pad.addEventListener('pointerup',up);pad.addEventListener('pointerleave',()=>{keys.L=0;keys.R=0});pad.addEventListener('pointercancel',()=>{keys.L=0;keys.R=0});
  K.cv.addEventListener('pointerdown',e=>{e.preventDefault();jump()});
  function cleanup(){over=true;cancelAnimationFrame(raf);K.ro.disconnect();document.removeEventListener('keydown',KD);document.removeEventListener('keyup',KU)}
  function end(win){if(over)return;cleanup();const el=Math.round((Date.now()-t0)/1000);
    c.finish({title:win?`Reached the top in ${c.mmss(el)}!`:inf?`You climbed to floor ${best}!`:`Stopped at floor ${best}`,stats:[['Highest floor',best],['Time',c.mmss(el)],['Falls',falls],['Accuracy',acc(right,tot)]],wrongs:wr,
      rec:win?{key:'obby'+goal,val:el}:inf?{key:'obbyinf',val:best}:null,right,total:tot,score:win?'Top in '+c.mmss(el):'Floor '+best})}
  K.cv._st={pl,plats,get energy(){return energy},set energy(v){energy=v;eui()}};
  ask();eui();stats();raf=requestAnimationFrame(t=>{last=t;loop(t)});
  return{stop:cleanup,end:()=>end(false)};
};

/* ===== Boss Raid ===== */
I.boss=c=>{
  const {$}=c,max=+c.opts.hp||1800,next=c.dealer(),QT=15,t0=Date.now();
  let hp=max,me=100,streak=0,best=0,right=0,tot=0,pot=0,dealt=0,wr=[],cur=null,lock=true,over=false,qs=0,tm;
  c.stage.innerHTML=`<div class="arena" id="arena">
    <div class="bar3"><b>Lava Golem</b><div class="hpbar"><i id="bh"></i></div><span id="bhn"></span></div>
    <div class="boss" id="boss"><svg viewBox="0 0 200 180" aria-hidden="true"><ellipse cx="100" cy="170" rx="70" ry="9" fill="#000" opacity=".4"/>
      <path d="M40 165Q22 95 52 58Q100 22 148 58Q178 95 160 165Z" fill="#6b5446"/><path d="M52 58Q100 22 148 58L140 70Q100 40 60 70Z" fill="#8a6f5a"/>
      <path d="M18 120Q14 90 40 82L52 120Q40 134 18 120ZM182 120Q186 90 160 82L148 120Q160 134 182 120Z" fill="#5a4539"/>
      <path id="crk" d="M70 80l14 12-8 18 12 14M128 74l-10 18 16 10-6 20M96 130l8 14-10 12" stroke="#ff8a3d" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M68 92h22M110 92h22" stroke="#ffcf4a" stroke-width="9" stroke-linecap="round"/><path d="M80 128Q100 118 120 128" stroke="#2a1a14" stroke-width="6" fill="none" stroke-linecap="round"/></svg></div>
    <div class="bar3"><b>You</b><div class="hpbar me"><i id="ph"></i></div><span id="phn"></span><button class="btn sm" id="pot">Potion ×0</button></div>
  </div>
  <div class="qcard"><div class="qtimer"><i id="qt"></i></div><div class="qtag" id="qtag"></div><p class="q" id="q"></p><div class="fb" id="fb" aria-live="polite"></div></div><div class="ans" id="ans"></div>`;
  const arena=$('#arena'),boss=$('#boss');
  function bars(){$('#bh').style.width=Math.max(0,hp/max*100)+'%';$('#bhn').textContent=`${c.fmt(Math.max(0,hp))} / ${c.fmt(max)}`;$('#ph').style.width=Math.max(0,me)+'%';$('#phn').textContent=`${Math.max(0,me)} / 100`;$('#pot').textContent='Potion ×'+pot;$('#pot').disabled=!pot||me>=100;boss.classList.toggle('rage',hp<max/2);
    c.setStats(`<span>Streak <b>${streak}</b></span><span>Damage <b>${c.fmt(dealt)}</b></span><span>Time <b>${c.mmss((Date.now()-t0)/1000)}</b></span>`)}
  function ask(){cur=c.makeQ(next());$('#qtag').textContent=cur.tag;$('#q').textContent=cur.q;$('#fb').textContent='';c.drawAns($('#ans'),cur);lock=false;qs=Date.now()}
  function hitBoss(){let dmg=100+25*Math.min(streak-1,8);const crit=streak>=3&&Math.random()<.25;if(crit)dmg*=2;hp-=dmg;dealt+=dmg;c.fx.sfx('hit');c.fx.good(boss);c.fx.combo(streak);if(crit)c.fx.popup('Critical hit!');
    c.floatTxt(arena,`−${dmg}${crit?' CRIT!':''}`,crit?'#ffd76a':'#fff');boss.classList.remove('shake');void boss.offsetWidth;boss.classList.add('shake');$('#fb').innerHTML=`<span class="okc">${crit?'Critical hit!':streak>2?`${streak}-hit combo!`:'Hit!'}</span>`}
  function hitMe(){c.fx.bad();const d=hp<max/2?26:18;me-=d;arena.classList.remove('flash');void arena.offsetWidth;arena.classList.add('flash');c.floatTxt(arena,`Golem strikes back −${d}`,'#ff8a7a')}
  function after(ok){bars();if(hp<=0)return setTimeout(()=>end(true),600);if(me<=0)return setTimeout(()=>end(false),600);setTimeout(()=>{if(!over)ask()},ok?750:1500)}
  function pick(i){if(lock||over)return;const bs=[...$('#ans').children];if(!bs[i])return;lock=true;tot++;$('#ans').classList.add('lock');const ok=cur.opts[i]===cur.a;
    bs.forEach((b,j)=>{if(cur.opts[j]===cur.a)b.classList.add('right');else if(j===i)b.classList.add('bad')});
    if(ok){right++;streak++;best=Math.max(best,streak);if(right%5===0)pot++;c.hit(cur.card);hitBoss()}else{streak=0;wr.push(cur.card);$('#fb').innerHTML=`<span class="noc">Answer: ${c.esc(cur.a)}</span>`;hitMe()}after(ok)}
  function tick(){if(over)return;const left=lock?null:Math.max(0,QT-(Date.now()-qs)/1000);if(left!=null){$('#qt').style.width=left/QT*100+'%';
      if(left<=0){lock=true;tot++;streak=0;wr.push(cur.card);$('#ans').classList.add('lock');[...$('#ans').children].forEach((b,j)=>{if(cur.opts[j]===cur.a)b.classList.add('right')});$('#fb').innerHTML=`<span class="noc">Time's up! Answer: ${c.esc(cur.a)}</span>`;hitMe();after(false)}}bars()}
  $('#ans').onclick=e=>{const b=e.target.closest('button');if(b)pick(+b.dataset.i)};
  $('#pot').onclick=()=>{if(pot&&me<100){pot--;me=Math.min(100,me+35);c.fx.sfx('buy');c.floatTxt(arena,'+35 health','#7be0a4');bars()}};
  function end(win){if(over)return;over=true;clearInterval(tm);const el=Math.round((Date.now()-t0)/1000);
    c.finish({title:win?`Boss defeated in ${c.mmss(el)}!`:'The golem won this time…',sub:win?'':'Next time, build a streak to land critical hits.',stats:[['Damage dealt',c.fmt(dealt)],['Accuracy',acc(right,tot)],['Best streak',best],['Health left',Math.max(0,me)]],wrongs:wr,rec:win?{key:'boss',val:el}:null,right,total:tot,score:win?'Won in '+c.mmss(el):c.fmt(dealt)+' damage'})}
  bars();ask();tm=setInterval(tick,100);
  return{stop(){over=true;clearInterval(tm)},end:()=>end(false),key(e){if(/^[1-4]$/.test(e.key))pick(+e.key-1);if(e.key==='p'||e.key==='P')$('#pot').click()}};
};

/* ===== Quiz Bingo ===== */
I.bingo=c=>{
  const {$}=c,d=c.opts.dir==='b'?'b':'f',A=x=>d==='f'?x.d:x.t,P=x=>d==='f'?x.t:x.d;
  const sa=new Set(),sp=new Set(),pool=[];for(const x of c.shuf(c.deck.cards)){if(sa.has(A(x))||sp.has(P(x)))continue;sa.add(A(x));sp.add(P(x));pool.push(x)}
  if(pool.length<9){c.stage.innerHTML='<p class="err">Bingo needs at least 9 different answers.</p>';return{stop(){},end(){}}}
  const N=pool.length>=16?4:3,need=N===4?3:2,board=pool.slice(0,N*N),mk=Array(N*N).fill(false),t0=Date.now();
  let cur=-1,right=0,strikes=0,pen=0,wr=[],missed=false,over=false,tm,asked=0;
  c.stage.innerHTML=`<div class="qcard slim"><div class="qtag">Find the answer square · ${N}×${N} board, ${need} lines to win</div><p class="q" id="q"></p><div class="fb" id="fb" aria-live="polite"></div></div>
  <div class="bgrid" style="--n:${N}" id="bg">${board.map((x,i)=>`<button class="bcell" data-i="${i}">${c.esc(A(x))}</button>`).join('')}</div>`;
  const lines=()=>{const L=[];for(let r=0;r<N;r++){L.push([...Array(N)].map((_,k)=>r*N+k));L.push([...Array(N)].map((_,k)=>k*N+r))}L.push([...Array(N)].map((_,k)=>k*N+k));L.push([...Array(N)].map((_,k)=>k*N+N-1-k));return L.filter(l=>l.every(i=>mk[i]))};
  const el=()=>(Date.now()-t0)/1000+pen;
  const stats=()=>c.setStats(`<span>Time <b>${c.mmss(el())}</b></span><span>Bingo <b>${lines().length}</b> / ${need}</span><span>Mistakes <b>${strikes}</b></span>`);
  function ask(){const rest=mk.map((m,i)=>m?-1:i).filter(i=>i>=0);cur=rest[c.rnd(rest.length)];missed=false;asked++;$('#q').textContent=P(board[cur])}
  $('#bg').onclick=e=>{const b=e.target.closest('.bcell');if(!b||over)return;const i=+b.dataset.i;if(mk[i])return;
    if(i===cur){const before=lines().length;mk[i]=true;right++;b.classList.add('mk');if(!missed)c.hit(board[i]);c.fx.good(b);if(lines().length>before){c.fx.popup('BINGO!');c.fx.sfx('win')}$('#fb').innerHTML='<span class="okc">Found it!</span>';const ls=lines();if(ls.length>=need){ls.flat().forEach(j=>$('#bg').children[j].classList.add('win'));stats();return setTimeout(()=>end(true),700)}ask()}
    else{strikes++;pen+=3;c.fx.bad();if(!missed){missed=true;wr.push(board[cur])}b.classList.remove('no');void b.offsetWidth;b.classList.add('no');$('#fb').innerHTML='<span class="noc">Not that one! +3s</span>'}stats()};
  function end(win){if(over)return;over=true;clearInterval(tm);const t=Math.round(el());
    c.finish({title:win?`Bingo in ${c.mmss(t)}!`:'Bingo stopped',stats:[['Time',c.mmss(t)],['Squares found',right],['Mistakes',strikes],['Penalty',pen+'s']],wrongs:wr,rec:win?{key:'bingo',val:t}:null,right,total:right+wr.length,score:win?'Bingo '+c.mmss(t):'Stopped'})}
  ask();stats();tm=setInterval(stats,250);
  return{stop(){over=true;clearInterval(tm)},end:()=>end(false)};
};

/* ===== Flashcards ===== */
I.flash=c=>{
  const {$}=c,all=c.cards;let queue=c.shuf(all),seen=new Set(),first=0,views=0,missed=[],flipped=false,over=false;
  c.stage.innerHTML=`<div class="flip" id="fc" role="button" tabindex="0" aria-label="Flip card"><div class="fin"><div class="face fr" id="fr"></div><div class="face bk" id="bk"></div></div></div>
  <p class="hint center">Tap the card or press Space to flip it</p><div class="row center" style="margin-top:14px"><button class="btn bad" id="fNo">Don’t know (1)</button><button class="btn" id="fYes">Know it (2)</button></div>`;
  const fc=$('#fc');
  function draw(){if(!queue.length)return end();const x=queue[0],d=c.dir();flipped=false;fc.classList.remove('on');views++;
    $('#fr').innerHTML=`<div><small>${d==='f'?'Front':'Back'}</small>${c.esc(d==='f'?x.t:x.d)}</div>`;$('#bk').innerHTML=`<div><small>${d==='f'?'Back':'Front'}</small>${c.esc(d==='f'?x.d:x.t)}</div>`;
    c.setStats(`<span>Cards left <b>${queue.length}</b></span><span>Learned <b>${all.length-queue.length}</b> / ${all.length}</span>`)}
  const flip=()=>{flipped=!flipped;fc.classList.toggle('on',flipped);c.fx.sfx('flip')};
  function ans(know){if(over||!queue.length)return;const x=queue.shift();c.fx.sfx(know?'good':'tick');if(know){if(!seen.has(x)){first++;c.hit(x)}}else{if(!seen.has(x))missed.push(x);queue.push(x)}seen.add(x);setTimeout(draw,flipped?180:0)}
  fc.onclick=flip;$('#fNo').onclick=()=>ans(false);$('#fYes').onclick=()=>ans(true);
  function end(){if(over)return;over=true;c.finish({title:queue.length?'Flashcards stopped':'You passed every card!',stats:[['Knew right away',first+' / '+all.length],['Cards shown',views],['Needed review',missed.length],['Cards left',queue.length]],wrongs:missed,right:first,total:seen.size,done:!queue.length,score:`${first}/${all.length} known`})}
  draw();return{stop(){over=true},end,key(e){if(e.key===' '||e.key==='Enter'){e.preventDefault();flip()}if(e.key==='1')ans(false);if(e.key==='2')ans(true)}};
};

/* ===== Match Up and Memory Cards ===== */
function pairs(c){const p=[],sT=new Set(),sD=new Set();for(const x of c.shuf(c.cards)){if(sT.has(x.t)||sD.has(x.d)||sT.has(x.d)||sD.has(x.t))continue;sT.add(x.t);sD.add(x.d);p.push(x);if(p.length===6)break}return p}
I.match=c=>{
  const {$}=c,pk=pairs(c),tiles=c.shuf(pk.flatMap((x,k)=>[{k,s:'t',x:x.t},{k,s:'d',x:x.d}]));let sel=null,left=pk.length,pen=0,over=false,miss=[];const t0=Date.now();
  c.stage.innerHTML=`<p class="hint center" style="margin:0 0 12px">Tap the front, then the back of the same card.</p><div class="mgrid">${tiles.map((t,i)=>`<button class="tile ${t.s}" data-i="${i}">${c.esc(t.x)}</button>`).join('')}</div>`;
  const el=()=>(Date.now()-t0)/1000+pen;
  const tm=setInterval(()=>c.setStats(`<span>Time <b>${el().toFixed(1)}s</b></span><span>Pairs left <b>${left}</b></span>${pen?`<span>Penalty <b>+${pen}s</b></span>`:''}`),100);
  c.stage.querySelector('.mgrid').onclick=e=>{const b=e.target.closest('.tile');if(!b||over||b.classList.contains('done'))return;const i=+b.dataset.i,bs=c.stage.querySelectorAll('.tile');
    if(sel===null){sel=i;b.classList.add('sel');c.fx.sfx('flip');return}if(sel===i){b.classList.remove('sel');sel=null;return}
    const a=tiles[sel],d=tiles[i],ab=bs[sel];ab.classList.remove('sel');
    if(a.k===d.k&&a.s!==d.s){ab.classList.add('done');b.classList.add('done');left--;c.hit(pk[a.k]);c.fx.good(b);if(!left)setTimeout(end,400)}else{c.fx.bad();pen++;miss.push(pk[a.k]);[ab,b].forEach(x=>{x.classList.remove('no');void x.offsetWidth;x.classList.add('no')})}sel=null};
  function end(){if(over)return;over=true;clearInterval(tm);const t=Math.round(el()*10)/10;
    if(left)return c.finish({title:'Match Up stopped',stats:[['Pairs matched',(pk.length-left)+' / '+pk.length],['Time',t+'s']],wrongs:miss,right:pk.length-left,total:pk.length,score:'Stopped'});
    c.finish({title:`Done in ${t}s!`,stats:[['Time',t+'s'],['Pairs',pk.length],['Mistakes',pen],['Penalty',pen+'s']],wrongs:miss,rec:{key:'match',val:t},right:pk.length,total:pk.length+pen,score:t+'s'})}
  return{stop(){over=true;clearInterval(tm)},end};
};
I.memory=c=>{
  const {$}=c,pk=pairs(c),tiles=c.shuf(pk.flatMap((x,k)=>[{k,s:'t',x:x.t},{k,s:'d',x:x.d}]));let open=[],moves=0,found=0,lock=false,over=false,miss=[];const t0=Date.now();
  c.stage.innerHTML=`<p class="hint center" style="margin:0 0 12px">Flip two cards at a time to find the front and back of the same card.</p><div class="mgrid">${tiles.map((t,i)=>`<button class="mtile" data-i="${i}" aria-label="Card ${i+1}">${c.esc(t.x)}</button>`).join('')}</div>`;
  const bs=[...c.stage.querySelectorAll('.mtile')];
  const stats=()=>c.setStats(`<span>Tries <b>${moves}</b></span><span>Pairs found <b>${found}</b> / ${pk.length}</span><span>Time <b>${c.mmss((Date.now()-t0)/1000)}</b></span>`);
  const tm=setInterval(stats,500);
  c.stage.querySelector('.mgrid').onclick=e=>{const b=e.target.closest('.mtile');if(!b||lock||over)return;const i=+b.dataset.i;if(b.classList.contains('open')||b.classList.contains('done'))return;
    b.classList.add('open');open.push(i);c.fx.sfx('flip');if(open.length<2)return;moves++;const [x,y]=open,a=tiles[x],d=tiles[y];
    if(a.k===d.k&&a.s!==d.s){bs[x].classList.replace('open','done');bs[y].classList.replace('open','done');open=[];found++;c.hit(pk[a.k]);c.fx.good(bs[y]);stats();if(found===pk.length)setTimeout(end,500)}
    else{lock=true;miss.push(pk[a.k]);setTimeout(()=>c.fx.sfx('bad'),250);setTimeout(()=>{bs[x].classList.remove('open');bs[y].classList.remove('open');open=[];lock=false},900)}stats()};
  function end(){if(over)return;over=true;clearInterval(tm);const done=found===pk.length;
    c.finish({title:done?`Done in ${moves} tries!`:'Memory Cards stopped',stats:[['Tries',moves],['Pairs found',found+' / '+pk.length],['Time',c.mmss((Date.now()-t0)/1000)],['Fewest possible',pk.length]],wrongs:[],rec:done?{key:'memory',val:moves}:null,right:found,total:moves,score:done?moves+' tries':'Stopped'})}
  stats();return{stop(){over=true;clearInterval(tm)},end};
};
})();
