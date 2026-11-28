window.SA=(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.floor(n).toLocaleString('en-US');
const rnd=n=>Math.floor(Math.random()*n);
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const uniq=a=>[...new Set(a.map(String))];
const newId=()=>'d'+Date.now().toString(36)+rnd(1e6).toString(36);
const mmss=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const lget=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
const lset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const timeout=(ms,v)=>new Promise(r=>setTimeout(()=>r(v),ms));
const ck=c=>c.t+'\t'+c.d;

/* ---------- starter decks ---------- */
const CAP=[["France","Paris"],["Japan","Tokyo"],["Canada","Ottawa"],["Australia","Canberra"],["Brazil","Brasília"],["Egypt","Cairo"],["Germany","Berlin"],["Italy","Rome"],["Spain","Madrid"],["United Kingdom","London"],["China","Beijing"],["India","New Delhi"],["Russia","Moscow"],["Mexico","Mexico City"],["Argentina","Buenos Aires"],["Türkiye (Turkey)","Ankara"],["Thailand","Bangkok"],["Vietnam","Hanoi"],["Kenya","Nairobi"],["New Zealand","Wellington"],["Switzerland","Bern"],["Netherlands","Amsterdam"],["Saudi Arabia","Riyadh"],["Indonesia","Jakarta"]];
/* Starter decks: words = every Word League word, math = Math Space War questions (decks.js, made by tools/study_decks/build.py). */
const SDK=window.SA_DECKS||{words:[],math:[]};
let MGRADE=null,MCARDS=null;   // school grade: the parent's choice on Zanycade, else age − 5
const gradeName=g=>g>=12?'Grade 12':'Grade '+g;
function mathGrade(){if(MGRADE)return MGRADE;try{const a=PCA&&PCA.profile&&+PCA.profile.age;if(a)return Math.max(1,Math.min(12,a-5))}catch(e){}return 1}
// Only questions at the player's grade or harder, nearest grades first (up to two grades higher; more only if there are too few).
function mathCards(){if(MCARDS)return MCARDS;const g=mathGrade();let pool=SDK.math.filter(q=>q.lv>=g&&q.lv<=g+2);if(pool.length<40)pool=SDK.math.filter(q=>q.lv>=g);
  pool=pool.slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  return MCARDS=pool.slice(0,40).map(q=>({t:q.q,d:q.a,w:q.w.slice()}))}
const SAMPLES=[
  {id:'s-words',sample:true,title:`Word League Words (${SDK.words.length})`,desc:'Every word in Word League ↔ its meaning',cards:SDK.words.map(([t,d])=>({t,d,w:[]}))},
  {id:'s-math',sample:true,get title(){return `Math Review · ${gradeName(mathGrade())} and up`},get desc(){return 'Math Space War questions at your grade or harder'},get cards(){return mathCards()}},
  {id:'s-cap',sample:true,title:'World Capitals 24',desc:'Country ↔ capital city',cards:CAP.map(([t,d])=>({t,d,w:[]}))},
];

/* Controls drawn like the real thing: key caps, a W A S D / arrow block, a mouse or a finger, and the game's own buttons.
   Row = [tokens, what it does, 'k' keyboard only | 't' touch only | both]. Phones (coarse pointer) only see touch rows. */
const MOUSE='<svg class="kmouse" viewBox="0 0 18 24" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="21" rx="7.5" fill="#fff" stroke="#3b2f86" stroke-width="2"/><path d="M9 2.5A6.5 6.5 0 0 0 2.5 9v1.5H9z" fill="#ff4f8b"/><path d="M9 2.5v8M2.5 10.5h13" stroke="#3b2f86" stroke-width="1.6"/></svg>';
const kb=t=>`<kbd${t.length>2?' class="wide"':''}>${esc(t)}</kbd>`;
const kpad=(a,b,l)=>`<span class="kpad" role="img" aria-label="${l}"><span>${kb(a)}</span><span>${b.map(kb).join('')}</span></span>`;
const KTOK={WASD:()=>kpad('W',['A','S','D'],'W A S D keys'),ARROWS:()=>kpad('↑',['←','↓','→'],'arrow keys'),'←→':()=>kb('←')+kb('→'),'1-4':()=>['1','2','3','4'].map(kb).join(''),
  PTR:()=>`<span class="kdev onk">${MOUSE}Click</span><span class="kdev ont"><i aria-hidden="true">👆</i>Tap</span>`,TAP:()=>'<span class="kdev"><i aria-hidden="true">👆</i>Tap</span>',SWIPE:()=>'<span class="kdev"><i aria-hidden="true">👆</i>Swipe</span>'};
function ctlHTML(rows,slim){
  const tok=t=>t==='or'?'<i class="kor">or</i>':KTOK[t]?KTOK[t]():t.startsWith('B:')?`<span class="tbtn">${esc(t.slice(2).replace(/_/g,' '))}</span>`:kb(t);
  const one=r=>`<li class="${r[2]==='k'?'onk':r[2]==='t'?'ont':''}"><span class="kc">${r[0].replace(/ or /g,' | ').split(' | ').map(g=>g.split(' ').map(tok).join('')).join('<i class="kor">or</i>')}</span><b>${esc(r[1])}</b></li>`;
  return rows&&rows.length?`<ul class="ctls${slim?' slim':''}">${rows.map(one).join('')}</ul>`:'';
}

/* ---------- game list ---------- */
const CATS={quick:'Quick Quiz',action:'Action',rpg:'Strategy & RPG',memo:'Memory'};
const LV=[{id:'lvl',label:'Difficulty',ch:[['13','Easy'],['10','Normal',1],['7','Hard']]}];
const GAMES=[
  {k:'gr',name:'Gold Rush',cat:'quick',color:'#c98a0c',short:'Earn gold, then upgrade in the shop',desc:'Every right answer earns gold. Spend it on a better pickaxe, a hot hand, lucky charms and your own gold mine, use power-ups, and reach the goal as fast as you can.',how:['Right answer = gold. Wrong answer = lose a little gold','Buy upgrades in the shop','Power-ups: 50/50, Double Time and Shield'],ctl:[['PTR','Pick an answer'],['1-4','Pick an answer','k'],['S','Open the shop','k']],opts:[{id:'mode',label:'Mode',ch:[['g100000','Goal: 100,000G'],['g500000','Goal: 500,000G',1],['t180','Most gold in 3 minutes'],['t300','Most gold in 5 minutes']]}],recs:['gr-g','gr-t'],min:2},
  {k:'ox',name:'Yes or No',cat:'quick',color:'#e9503f',short:'Do they go together? Yes or no!',desc:'You see a front and a back. If they belong together, pick YES. If not, pick NO! Get as many right as you can before time runs out.',how:['Build a streak and find your rhythm'],ctl:[['PTR','Pick YES or NO'],['← or Y','Yes, they match','k'],['→ or N','No, they don’t','k']],opts:[{id:'sec',label:'Time',ch:[['30','30 seconds'],['60','60 seconds',1],['90','90 seconds']]}],recs:['ox'],min:2},
  {k:'type',name:'Typing Challenge',cat:'quick',color:'#3d4a8c',short:'No choices: type the answer yourself',desc:'There are no choices here. You type the answer, so you find out if you really know it.',how:['Wrong only because of a typo? Tap “Count it as right”'],ctl:[['Enter','Check your answer','k'],['B:Check','Check your answer','t'],['B:Hint','See the first letter']],opts:[{id:'n',label:'Questions',ch:[['10','10 questions'],['15','15 questions',1],['999','Whole deck']]}],recs:['type'],min:1},
  {k:'def',name:'Monster Defense',cat:'action',color:'#d9483a',short:'Answer before monsters reach the castle!',desc:'Monsters march toward your castle. Pick the right answer to knock each one out. A wrong answer lets the monster jump closer.',how:['Monsters get faster as you defeat more','The game ends when 3 monsters reach the castle'],ctl:[['PTR','Pick an answer'],['1-4','Pick an answer','k']],opts:LV,recs:['def'],min:2},
  {k:'shoot',name:'Space Shooter',cat:'action',color:'#2a3b8f',short:'Laser the box with the right answer',desc:'Boxes with answers fall through space. Shoot the right one. The faster you hit it, the more points you get.',how:['Wrong box or missing the right one = lose 1 shield'],ctl:[['PTR','Shoot a box'],['1-4','Shoot box 1, 2, 3 or 4','k'],['←→','Move','k'],['Space','Shoot straight up','k']],opts:LV,recs:['shoot'],min:2},
  {k:'run',name:'Lane Runner',cat:'action',color:'#0f8a6a',short:'Run through the gate with the right answer',desc:'Gates with answers come down the road. Move into the lane with the right gate to run through it.',how:['The more you get right, the faster you go'],ctl:[['←→ or A D','Change lanes','k'],['1-4','Jump to that lane','k'],['TAP','Tap a lane to go there','t']],opts:LV,recs:['run'],min:2},
  {k:'snake',name:'Quiz Snake',cat:'action',color:'#4f8f2f',short:'A snake that eats only right answers',desc:'Eat the numbered food with the right answer and your snake grows. Eat a wrong one or hit a wall and you lose a life.',how:['Eat the food with the right number','The snake speeds up as it eats'],ctl:[['ARROWS or WASD','Turn','k'],['B:▲ B:◀ B:▼ B:▶ or SWIPE','Turn','t']],opts:[{id:'spd',label:'Speed',ch:[['210','Slow'],['165','Normal',1],['125','Fast']]}],recs:['snake'],min:2},
  {k:'obby',name:'Sky Tower',cat:'action',color:'#3b8fd9',short:'Answer for energy, then climb the tower',desc:'Every jump uses energy. Answer the questions next to the tower to earn energy, then hop across moving, crumbling and spring platforms to reach the top. Miss a jump and you fall to a lower floor!',how:['Right answer = +3 energy, +1 more for every 3 in a row','Checkpoint every 10 floors: you can’t fall below it'],ctl:[['←→ or A D','Move','k'],['Space or ↑','Jump','k'],['1-4','Answer','k'],['B:◀ B:▶','Move','t'],['B:Jump','Jump','t'],['PTR','Pick an answer']],opts:[{id:'goal',label:'Goal',ch:[['40','Top at floor 40',1],['80','Top at floor 80'],['0','Endless tower (3 min)']]}],recs:['obby40','obby80','obbyinf'],min:2},
  {k:'boss',name:'Boss Raid',cat:'rpg',color:'#7a2e1f',short:'Attack with right answers to beat the boss',desc:'Face the Lava Golem! Right answers attack, streaks hit harder, and sometimes you land a critical hit. Wrong answers or running out of time let the golem strike back.',how:['15 seconds for each question','Longer streaks do more damage','1 potion for every 5 right answers'],ctl:[['PTR','Pick an answer to attack'],['1-4','Pick an answer','k'],['P','Drink a potion','k'],['B:Potion','Drink a potion','t']],opts:[{id:'hp',label:'Boss health',ch:[['1000','Easy'],['1800','Normal',1],['3000','Hard']]}],recs:['boss'],min:2},
  {k:'bingo',name:'Quiz Bingo',cat:'rpg',color:'#8f5a12',short:'Find the answer squares and get bingo',desc:'The board is full of answers. Find the square for each question and complete your bingo lines. A wrong tap adds 3 seconds.',how:['4×4 board: 3 lines to win; 3×3 board: 2 lines','Wrong tap = +3 seconds','Needs at least 9 cards'],ctl:[['PTR','Pick the right square']],opts:[],recs:['bingo'],min:9},
  {k:'flash',name:'Flashcards',cat:'memo',color:'#11897c',short:'Flip, check, and repeat the tricky ones',desc:'Flip each card to check yourself. Cards you know are done; cards you don’t know go to the back and come again.',how:['Cards you don’t know come back again','You finish when you pass every card'],ctl:[['PTR','Flip the card'],['Space','Flip the card','k'],['1','I don’t know it','k'],['2','I know it','k'],['B:Don’t_know','I don’t know it','t'],['B:Know_it','I know it','t']],opts:[],recs:[],min:1},
  {k:'match',name:'Match Up',cat:'memo',color:'#2f6fd6',short:'Pair up 12 tiles fast',desc:'Fronts and backs are laid out as tiles. Find each pair by tapping one, then the other. A wrong pair adds 1 second.',how:['Wrong pair = +1 second','Shorter time = better record'],ctl:[['PTR','Pick a front, then its back']],opts:[],recs:['match'],min:2},
  {k:'memory',name:'Memory Cards',cat:'memo',color:'#5a3d8a',short:'Find pairs among face-down cards',desc:'All the cards are face down. Flip two at a time to find pairs. Remember where things are to finish in fewer tries.',how:['If the two cards match, they stay open','If not, they flip back over','Fewer tries = better record'],ctl:[['PTR','Flip two cards']],opts:[],recs:['memory'],min:2},
];
const GM=Object.fromEntries(GAMES.map(g=>[g.k,g]));
const RECDEF={'gr-g':{lo:1,n:'Gold Rush (goal)',f:v=>mmss(v)},'gr-t':{n:'Gold Rush (timed)',f:v=>fmt(v)+'G'},ox:{n:'Yes or No',f:v=>v+' right'},type:{n:'Typing Challenge',f:v=>v+'%'},def:{n:'Monster Defense',f:v=>v+(v===1?' monster':' monsters')},shoot:{n:'Space Shooter',f:v=>fmt(v)+' pts'},run:{n:'Lane Runner',f:v=>fmt(v)+'m'},snake:{n:'Quiz Snake',f:v=>v+' eaten'},boss:{lo:1,n:'Boss Raid',f:v=>'won in '+mmss(v)},bingo:{lo:1,n:'Quiz Bingo',f:v=>mmss(v)},obby40:{lo:1,n:'Sky Tower (40 floors)',f:v=>mmss(v)},obby80:{lo:1,n:'Sky Tower (80 floors)',f:v=>mmss(v)},obbyinf:{n:'Sky Tower (endless)',f:v=>'floor '+v},match:{lo:1,n:'Match Up',f:v=>v.toFixed(1)+'s'},memory:{lo:1,n:'Memory Cards',f:v=>v+' tries'}};

const ART={
gr:`<svg viewBox="0 0 160 100"><ellipse cx="80" cy="88" rx="56" ry="6" fill="#000" opacity=".18"/>${[[50,78],[80,80],[110,78],[65,66],[95,66],[80,54]].map(([x,y])=>`<g transform="translate(${x} ${y})"><ellipse cy="5" rx="18" ry="6" fill="#8a5a00"/><rect x="-18" width="36" height="5" fill="#b97c06"/><ellipse rx="18" ry="6" fill="#ffd76a"/><ellipse rx="11" ry="3.4" fill="none" stroke="#b97c06" stroke-width="1.5"/></g>`).join('')}<circle cx="124" cy="30" r="14" fill="#ffd76a" stroke="#8a5a00" stroke-width="3"/><text x="124" y="36" text-anchor="middle" font-family="Black Han Sans" font-size="16" fill="#8a5a00">G</text><path d="M34 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff6cf"/></svg>`,
ox:`<svg viewBox="0 0 160 100"><circle cx="54" cy="50" r="24" fill="none" stroke="#fff" stroke-width="11"/><path d="M92 28l40 44M132 28l-40 44" stroke="#2a0d08" stroke-opacity=".35" stroke-width="12" stroke-linecap="round" transform="translate(2 3)"/><path d="M92 28l40 44M132 28l-40 44" stroke="#ffe08a" stroke-width="12" stroke-linecap="round"/></svg>`,
type:`<svg viewBox="0 0 160 100"><rect x="22" y="40" width="116" height="46" rx="8" fill="#26305e"/>${[0,1,2,3,4,5,6].map(i=>`<rect x="${29+i*15}" y="47" width="12" height="11" rx="2" fill="#f4efe3"/>`).join('')}${[0,1,2,3,4,5].map(i=>`<rect x="${36+i*15}" y="62" width="12" height="11" rx="2" fill="#f4efe3"/>`).join('')}<rect x="52" y="76" width="56" height="6" rx="2" fill="#f2b632"/><rect x="34" y="14" width="92" height="20" rx="6" fill="#fff"/><rect x="42" y="21" width="44" height="6" rx="3" fill="#3d4a8c"/><rect x="90" y="19" width="3" height="10" fill="#e9503f"/></svg>`,
def:`<svg viewBox="0 0 160 100"><rect y="68" width="160" height="32" fill="#3f7a3a"/><rect x="10" y="34" width="34" height="46" fill="#e8dfc8"/>${[10,22,34].map(x=>`<rect x="${x}" y="27" width="8" height="8" fill="#e8dfc8"/>`).join('')}<rect x="21" y="58" width="12" height="22" rx="6" fill="#5a4a32"/><path d="M27 27V8h14l-4 4 4 4H27" fill="#f2b632"/><g transform="translate(112 48)"><path d="M-20 30Q-26 0-12-10L-15-24-5-14Q0-16 5-14L15-24 12-10Q26 0 20 30Z" fill="#7be0d4"/><circle cx="-7" cy="2" r="5" fill="#fff"/><circle cx="7" cy="2" r="5" fill="#fff"/><circle cx="-7" cy="3" r="2.4"/><circle cx="7" cy="3" r="2.4"/></g></svg>`,
shoot:`<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="#141d4a" opacity=".6"/>${[[20,14],[60,30],[140,20],[100,10],[30,60],[150,70]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join('')}<rect x="30" y="16" width="38" height="24" rx="5" fill="#e9503f"/><rect x="92" y="22" width="38" height="24" rx="5" fill="#f2b632"/><path d="M111 46L80 76" stroke="#7bf0ff" stroke-width="4" stroke-linecap="round"/><path d="M80 66l12 22H68z" fill="#e8ecff"/><circle cx="80" cy="78" r="3" fill="#2f74e0"/></svg>`,
run:`<svg viewBox="0 0 160 100"><rect x="30" width="100" height="100" fill="#3a3f47"/><path d="M63 0v100M97 0v100" stroke="#f4efe3" stroke-width="2.5" stroke-dasharray="9 9"/><rect x="34" y="14" width="26" height="16" rx="3" fill="#e9503f"/><rect x="67" y="14" width="26" height="16" rx="3" fill="#2f74e0"/><rect x="101" y="14" width="26" height="16" rx="3" fill="#f2b632"/><rect x="70" y="62" width="20" height="30" rx="7" fill="#ffd76a"/><rect x="73" y="66" width="14" height="8" rx="2" fill="#26305e"/></svg>`,
snake:`<svg viewBox="0 0 160 100"><path d="M24 74H70V40h40v26h22" fill="none" stroke="#ffd76a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="132" cy="66" r="9" fill="#ffd76a"/><circle cx="135" cy="63" r="2.4" fill="#1b1b1b"/><circle cx="130" cy="24" r="9" fill="#e9503f"/><text x="130" y="28" text-anchor="middle" font-size="11" font-weight="900" fill="#fff">1</text><circle cx="36" cy="28" r="9" fill="#2f74e0"/><text x="36" y="32" text-anchor="middle" font-size="11" font-weight="900" fill="#fff">2</text></svg>`,
boss:`<svg viewBox="0 0 160 100"><g transform="translate(80 58)"><path d="M-36 34Q-46-6-26-26Q0-42 26-26Q46-6 36 34Z" fill="#6b5446"/><path d="M-20-10l10 8-6 12M16-18l-6 14 12 6" stroke="#ff8a3d" stroke-width="3" fill="none"/><path d="M-18-6h12M6-6h12" stroke="#ffcf4a" stroke-width="6" stroke-linecap="round"/></g><rect x="30" y="8" width="100" height="8" rx="4" fill="#000" opacity=".35"/><rect x="30" y="8" width="62" height="8" rx="4" fill="#ff5d4a"/></svg>`,
obby:`<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="#8fd0ff" opacity=".35"/><ellipse cx="30" cy="24" rx="16" ry="6" fill="#fff" opacity=".8"/><ellipse cx="128" cy="44" rx="14" ry="5" fill="#fff" opacity=".8"/><rect x="14" y="84" width="56" height="9" rx="3" fill="#6b4f3a"/><rect x="14" y="84" width="56" height="3" fill="#5cc45c"/><rect x="84" y="62" width="44" height="9" rx="3" fill="#5a7bd6"/><rect x="40" y="40" width="40" height="9" rx="3" fill="#b58b5a"/><rect x="92" y="18" width="48" height="9" rx="3" fill="#f2b632"/><path d="M132 18V4l10 4-10 4" fill="#e9503f" stroke="#5a4a32" stroke-width="1.5"/><g transform="translate(98 44)"><path d="M0 -6L8 10H-8Z" fill="#ff6b57"/><circle cy="-8" r="6" fill="#ff6b57"/><circle cx="-2" cy="-9" r="1.2"/><circle cx="2" cy="-9" r="1.2"/></g><path d="M90 56q4-6 8-10" stroke="#fff" stroke-width="2" stroke-dasharray="2 3" fill="none"/></svg>`,
bingo:`<svg viewBox="0 0 160 100">${[0,1,2].flatMap(r=>[0,1,2].map(c=>`<rect x="${44+c*25}" y="${14+r*25}" width="22" height="22" rx="4" fill="${(r===c)?'#ffd76a':'#fff7e6'}"/>`)).join('')}<path d="M47 17l66 66" stroke="#e9503f" stroke-width="5" stroke-linecap="round" opacity=".8"/></svg>`,
flash:`<svg viewBox="0 0 160 100"><rect x="30" y="18" width="64" height="70" rx="9" fill="#0b5f56" transform="rotate(-8 62 53)"/><rect x="62" y="14" width="64" height="70" rx="9" fill="#f2b632" transform="rotate(6 94 49)"/><text x="95" y="58" text-anchor="middle" font-family="Black Han Sans" font-size="28" fill="#5a3d00" transform="rotate(6 94 49)">A</text></svg>`,
match:`<svg viewBox="0 0 160 100">${[[22,18],[86,18],[22,58],[86,58]].map(([x,y],i)=>`<rect x="${x}" y="${y}" width="52" height="28" rx="6" fill="${i%3?'#fff7e6':'#ffd76a'}"/>`).join('')}<path d="M74 32Q80 60 86 72" stroke="#fff" stroke-width="3" stroke-dasharray="5 4" fill="none"/></svg>`,
memory:`<svg viewBox="0 0 160 100">${[0,1,2,3].map(i=>`<rect x="${20+i*31}" y="${i%2?30:22}" width="27" height="40" rx="5" fill="${i===2?'#fff7e6':'#2b1d44'}" stroke="#f2b632" stroke-width="2"/>`).join('')}<text x="43" y="48" text-anchor="middle" font-family="Black Han Sans" font-size="18" fill="#f2b632">?</text><text x="74" y="56" text-anchor="middle" font-family="Black Han Sans" font-size="18" fill="#f2b632">?</text><text x="136" y="56" text-anchor="middle" font-family="Black Han Sans" font-size="18" fill="#f2b632">?</text></svg>`,
};

/* ---------- saving ----------
   Signed in on Zanycade: one private save per player (Account.writeSave('study-arcade')).
   localStorage (kept per player) is only an offline backup. */
const PCA=(()=>{try{return window.parent!==window&&window.parent.Account?window.parent.Account:null}catch(e){return null}})();
const SLUG='study-arcade';let LK='';
const myId=()=>{try{return PCA&&PCA.signedIn&&PCA.profile?String(PCA.profile.username||''):''}catch(e){return''}};
let DECKS=[];
let R={data:{},hist:[],miss:{},tot:{games:0,ans:0,right:0},days:[]};
function loadLocal(){DECKS=lget('sa-decks'+LK,[]);if(!Array.isArray(DECKS))DECKS=[];R=Object.assign({data:{},hist:[],miss:{},tot:{games:0,ans:0,right:0},days:[]},lget('sa-rec2'+LK,{}));wallet()}
/* ---------- coin wallet ---------- */
function wallet(){if(typeof R.coins!=='number')R.coins=0;if(!Array.isArray(R.ledger))R.ledger=[];if(!R.inv||typeof R.inv!=='object')R.inv={};const v=R.inv;v.owned=Array.isArray(v.owned)?v.owned.filter(x=>SI[x]):[];['c-coral','a-none'].forEach(x=>{if(!v.owned.includes(x))v.owned.push(x)});v.equip=v.equip||{};if(!SI[v.equip.c])v.equip.c='c-coral';if(!SI[v.equip.a])v.equip.a='a-none';v.boost=+v.boost||0;v.shield=+v.shield||0;if(!R.earn)R.earn={d:'',n:0};R.wt=R.wt||0}
function renderCoin(){const n=$('#coinN');if(n)n.textContent=fmt(R.coins)}
function addCoins(n,why){wallet();R.coins=Math.max(0,R.coins+n);R.ledger.unshift({at:Date.now(),n,why});R.ledger=R.ledger.slice(0,40);R.wt=Date.now()}
function countTo(target){const n=$('#coinN');if(!n)return;const from=parseInt(n.textContent.replace(/,/g,''))||0,t0=performance.now(),d=900;const step=t=>{const k=Math.min(1,(t-t0)/d);n.textContent=fmt(from+(target-from)*k);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step);const ch=$('#coinChip');ch.classList.remove('bump');void ch.offsetWidth;ch.classList.add('bump')}
function flyCoins(from,n){const a=elC(from),b=elC($('#coinChip'));FX.coins(a.x,a.y,b.x,b.y,Math.min(14,Math.max(5,Math.round(n/8))));SFX.play('coin');setTimeout(()=>SFX.play('coin'),300);setTimeout(()=>countTo(R.coins),600)}
const MPOOL=[
  {id:'r20',txt:'Get 20 questions right',goal:20,m:'right',rw:30},{id:'r50',txt:'Get 50 questions right',goal:50,m:'right',rw:60},
  {id:'w5',txt:'Get 5 often-missed cards right',goal:5,m:'weak',rw:40},{id:'o2',txt:'Fully beat 2 weak cards',goal:2,m:'over',rw:50},
  {id:'g3',txt:'Play 3 games',goal:3,m:'games',rw:30},{id:'k2',txt:'Play 2 different games',goal:2,m:'kinds',rw:30},
  {id:'a80',txt:'Score 80% or better in one game (5+ questions)',goal:1,m:'acc',rw:35},{id:'t10',txt:'Get 10 right in Typing Challenge',goal:10,m:'type',rw:45},
  {id:'f1',txt:'Finish a whole deck in Flashcards',goal:1,m:'flash',rw:30},
];
const MP=Object.fromEntries(MPOOL.map(m=>[m.id,m]));
function missions(){const d=today();if(!R.mis||R.mis.d!==d||!Array.isArray(R.mis.ids)){let h=0;for(const ch of d)h=(h*31+ch.charCodeAt(0))>>>0;const pool=MPOOL.slice(),ids=[];while(ids.length<3){ids.push(pool.splice(h%pool.length,1)[0].id);h=Math.floor(h/3)+17}R.mis={d,ids,p:{},cl:[],kinds:[],bonus:false}}return R.mis}
function bumpMissions(ev){const M=missions();if(!M.kinds.includes(ev.game))M.kinds.push(ev.game);
  for(const id of M.ids){const m=MP[id];let v=M.p[id]||0;
    if(m.m==='right')v+=ev.right;if(m.m==='weak')v+=ev.weak;if(m.m==='over')v+=ev.over;if(m.m==='games')v+=1;if(m.m==='kinds')v=M.kinds.length;
    if(m.m==='acc'&&ev.total>=5&&ev.right/ev.total>=.8)v=1;if(m.m==='type'&&ev.game==='type')v+=ev.right;if(m.m==='flash'&&ev.game==='flash'&&ev.done)v=1;M.p[id]=Math.min(m.goal,v)}}
const Cloud={on:false,tm:0,
  write(){if(!this.on)return;clearTimeout(this.tm);this.tm=setTimeout(()=>this.flush(),1200)},
  async flush(){clearTimeout(this.tm);this.tm=0;if(!this.on)return;try{await PCA.writeSave(SLUG,{v:1,decks:DECKS,rec:recBody(),wt:lget('sa-wt'+LK,Date.now())});setSync('cloud')}catch(e){setSync('err')}}};
addEventListener('pagehide',()=>{if(Cloud.tm)Cloud.flush()});
const deckBody=d=>({kind:'deck',title:d.title,desc:d.desc||'',cards:d.cards,updated:d.updated||Date.now()});
const recBody=()=>({data:R.data,hist:R.hist,miss:R.miss,tot:R.tot,days:R.days,coins:R.coins,ledger:R.ledger,inv:R.inv,earn:R.earn,mis:R.mis,wt:R.wt});
function saveLocal(){lset('sa-decks'+LK,DECKS);lset('sa-rec2'+LK,R);lset('sa-wt'+LK,Date.now())}
function saveDeck(d){d.updated=Date.now();const i=DECKS.findIndex(x=>x.id===d.id);if(i<0)DECKS.unshift(d);else DECKS[i]=d;saveLocal();Cloud.write()}
function removeDeck(id){DECKS=DECKS.filter(d=>d.id!==id);delete R.miss[id];saveLocal();Cloud.write()}
function saveRec(){saveLocal();Cloud.write()}
function setSync(s){$('#sync').textContent={cloud:'● Saved to your account',local:'Saved on this device',err:'Not saved yet, will retry'}[s]||''}
const cleanCards=a=>(Array.isArray(a)?a:[]).map(c=>({t:String(c&&c.t||'').trim(),d:String(c&&c.d||'').trim(),w:Array.isArray(c&&c.w)?c.w.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]})).filter(c=>c.t&&c.d);
function mergeRec(c){
  const d=c.data&&typeof c.data==='object'?c.data:{};
  for(const k in d){if(typeof d[k]!=='number')continue;const m=k.split(':').pop(),lo=RECDEF[m]&&RECDEF[m].lo,a=R.data[k];if(a==null||(lo?d[k]<a:d[k]>a))R.data[k]=d[k]}
  const hs=(Array.isArray(c.hist)?c.hist:[]).filter(h=>h&&typeof h.at==='number').map(h=>({d:String(h.d),t:String(h.t),g:String(h.g),s:String(h.s),at:h.at}));
  const seen=new Set();R.hist=[...R.hist,...hs].sort((a,b)=>b.at-a.at).filter(h=>{const k=h.at+h.g;if(seen.has(k))return false;seen.add(k);return true}).slice(0,30);
  if(c.miss&&typeof c.miss==='object')for(const dk in c.miss){const src=c.miss[dk];if(!src||typeof src!=='object')continue;const dst=R.miss[dk]||(R.miss[dk]={});for(const k in src)if(typeof src[k]==='number')dst[k]=Math.max(dst[k]||0,src[k])}
  if(c.tot&&typeof c.tot==='object')for(const k of ['games','ans','right'])if(typeof c.tot[k]==='number')R.tot[k]=Math.max(R.tot[k]||0,c.tot[k]);
  if(Array.isArray(c.days))R.days=uniq([...R.days,...c.days.map(String)]).sort().slice(-90);
  if(typeof c.wt==='number'&&c.wt>(R.wt||0)&&typeof c.coins==='number'){R.coins=Math.max(0,Math.floor(c.coins));R.ledger=(Array.isArray(c.ledger)?c.ledger:[]).filter(x=>x&&typeof x.n==='number').map(x=>({at:+x.at||0,n:x.n,why:String(x.why||'')})).slice(0,40);R.inv=c.inv&&typeof c.inv==='object'?c.inv:R.inv;R.earn=c.earn&&typeof c.earn==='object'?{d:String(c.earn.d||''),n:+c.earn.n||0}:R.earn;R.mis=c.mis&&typeof c.mis==='object'?c.mis:R.mis;R.wt=c.wt}
  wallet();
}
async function initCloud(){
  if(!PCA){setSync('local');return}
  for(let i=0;i<50&&!PCA.ready;i++)await timeout(100);
  const me=myId();LK=me?':'+me:'';loadLocal();setMascot();renderCoin();route(true);
  if(!me){setSync('local');return}
  try{
    refreshGameTime();
    PCA.learnWallet&&PCA.learnWallet().then(w=>{if(w&&w.math_grade&&w.math_grade!==MGRADE){MGRADE=w.math_grade;MCARDS=null;route(true)}}).catch(()=>{});
    const sv=await Promise.race([PCA.loadSave(SLUG),timeout(10000,'slow')]);
    if(sv==='slow'){setSync('local');return}
    const c=sv&&sv.data;Cloud.on=true;
    if(c&&typeof c==='object'){
      const cd=(Array.isArray(c.decks)?c.decks:[]).filter(d=>d&&d.id).map(d=>({id:String(d.id),title:String(d.title||'Untitled').slice(0,60),desc:String(d.desc||'').slice(0,120),cards:cleanCards(d.cards),updated:+d.updated||0}));
      if((+c.wt||0)>=lget('sa-wt'+LK,0))DECKS=cd;
      else{const map=new Map(cd.map(d=>[d.id,d]));for(const d of DECKS){const x=map.get(d.id);if(!x||(d.updated||0)>x.updated)map.set(d.id,d)}DECKS=[...map.values()].sort((a,b)=>(b.updated||0)-(a.updated||0))}
      if(c.rec&&typeof c.rec==='object')mergeRec(c.rec);
      saveLocal();Cloud.write();
    }else if(DECKS.length||R.tot.games){saveLocal();Cloud.write()}
    setSync('cloud');setMascot();renderCoin();route(true);
  }catch(e){setSync('local')}
}
/* Zanycade leaderboard: total right answers. Shared table game_kv; the server adds data.nick. Players see nicknames only. */
async function pushRank(){if(!PCA||!Cloud.on)return;try{if(PCA.limited)return;const me=myId();if(!me)return;await PCA.kvSet(SLUG,'rank',me,{s:R.tot.right|0,g:R.tot.games|0,t:Date.now()})}catch(e){}}
async function renderLb(){const el=$('#stLb');if(!el)return;if(!PCA){$('#lbCard').classList.add('hide');return}
  let rows=[];try{rows=(await PCA.kvList(SLUG,'rank',300)).map(r=>({id:r.doc_id,nk:(r.data&&r.data.nick)||'Player',s:+(r.data&&r.data.s)||0})).filter(r=>r.s>0).sort((a,b)=>b.s-a.s)}catch(e){}
  const me=myId(),mi=rows.findIndex(r=>r.id===me),row=(r,k)=>`<li${r.id===me?' class="me"':''}><span>${k<3?['🥇','🥈','🥉'][k]:(k+1)+'.'} ${esc(String(r.nk).slice(0,16))}</span><b>${fmt(r.s)}</b></li>`;
  let h=rows.length?rows.slice(0,10).map(row).join(''):'<li class="hint">No scores yet. Be the first!</li>';if(mi>=10)h+=row(rows[mi],mi);
  if(PCA.limited)h+='<li class="hint">Your score will join the board once a parent says OK.</li>';
  el.innerHTML=h}
const allDecks=()=>[...DECKS,...SAMPLES];
const findDeck=id=>DECKS.find(d=>d.id===id)||SAMPLES.find(d=>d.id===id);

/* ---------- views ---------- */
const VIEWS=['vHome','vDecks','vDeck','vEdit','vGames','vSetup','vPlay','vResult','vStats','vShop','vPacks'];
let G=null,CUR=null,LAST=null,SET={game:'gr',deck:null},CAT='all',WRONG=[];
const last=lget('sa-last',{});
function show(v,tab){VIEWS.forEach(x=>$('#'+x).classList.toggle('hide',x!==v));document.body.classList.toggle('playing',v==='vPlay');if(tab)$$('.ntab').forEach(a=>a.classList.toggle('on',a.dataset.tab===tab));window.scrollTo(0,0)}
let CD=0;
function stopGame(){CD++;if(G){try{G.stop()}catch(e){}G=null}}
const TABS={home:'vHome',decks:'vDecks',games:'vGames',packs:'vPacks',shop:'vShop',stats:'vStats'};
let curView='home';
function route(soft){
  const h=(location.hash||'#home').slice(1),t=TABS[h]?h:'home';
  if(soft===true){if(['home','decks','games','packs','shop','stats'].includes(curView)&&curView===t){render(t)}return}
  stopGame();curView=t;render(t);show(TABS[t],t);
}
function render(t){({home:renderHome,decks:renderDecks,games:renderGames,shop:renderShop,packs:renderPacks,stats:renderStats})[t]()}
function go(t){if(location.hash!=='#'+t)location.hash=t;else route()}
window.addEventListener('hashchange',route);

/* ---------- card UI pieces ---------- */
const gameCard=g=>`<button class="gcard" data-game="${g.k}" style="--c:${g.color}"><span class="gart" aria-hidden="true">${ART[g.k]}</span><span class="gtxt"><span class="gcat">${CATS[g.cat]}</span><b>${g.name}</b><span class="gd">${g.short}</span></span></button>`;
const deckCard=d=>`<article class="deck"><h3>${esc(d.title)}</h3><p>${esc(d.desc||'')}</p><div class="dm">${d.cards.length} cards${d.sample?' · Starter deck':''}</div><div class="row"><button class="btn sm" data-open="${esc(d.id)}">Open</button><button class="btn ghost sm" data-quick="${esc(d.id)}">Play</button></div></article>`;
function ago(t){const s=(Date.now()-t)/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';return Math.floor(s/86400)+' d ago'}
const today=()=>new Date().toLocaleDateString('en-CA');
function streakDays(){const set=new Set(R.days);let n=0,d=new Date();if(!set.has(today()))d.setDate(d.getDate()-1);while(set.has(d.toLocaleDateString('en-CA'))){n++;d.setDate(d.getDate()-1)}return n}

/* ---------- home ---------- */
const missionDone=()=>{const M=missions();return M.ids.some(id=>(M.p[id]||0)>=MP[id].goal&&!M.cl.includes(id))};
function renderMissions(){const M=missions(),all=M.ids.every(id=>M.cl.includes(id));
  $('#missions').innerHTML=M.ids.map(id=>{const m=MP[id],v=M.p[id]||0,done=v>=m.goal,cl=M.cl.includes(id);
    return `<div class="mis ${cl?'cl':''}"><div class="mt"><b>${m.txt}</b><span class="mrw"><i class="cico"></i> ${m.rw}</span></div><div class="mbar"><i style="width:${v/m.goal*100}%"></i></div><div class="mf"><span>${v} / ${m.goal}</span>${cl?'<span class="okc">Claimed</span>':`<button class="btn sm" data-claim="${id}" ${done?'':'disabled'}>${done?'Claim':'In progress'}</button>`}</div></div>`}).join('')
  +`<p class="hint" style="grid-column:1/-1;margin:0">${all?(M.bonus?'All missions done for today! New ones come tomorrow.':''):'Finish all three for a 50-coin bonus'}</p>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-claim]');if(!b)return;const M=missions(),id=b.dataset.claim,m=MP[id];if(M.cl.includes(id)||(M.p[id]||0)<m.goal)return;
  M.cl.push(id);let n=m.rw;addCoins(m.rw,'Daily mission: '+m.txt);if(M.ids.every(x=>M.cl.includes(x))&&!M.bonus){M.bonus=true;addCoins(50,'All daily missions done');n+=50;setTimeout(()=>{FX.confetti(80);SFX.play('win')},500)}
  SFX.init();flyCoins(b,n);saveRec();renderMissions()});
function renderHome(){
  const st=streakDays(),todayN=R.hist.filter(h=>new Date(h.at).toLocaleDateString('en-CA')===today()).length,acc=R.tot.ans?Math.round(R.tot.right/R.tot.ans*100):null;
  renderMissions();setMascot();
  $('#homeChips').innerHTML=[`Coins <b>${fmt(R.coins)}</b>`,`Streak <b>${st} day${st===1?'':'s'}</b>`,`Today <b>${todayN} game${todayN===1?'':'s'}</b>`,acc==null?'No games yet':`Accuracy <b>${acc}%</b>`].map(x=>`<span class="schip">${x}</span>`).join('');
  const h=R.hist[0],hd=h&&findDeck(h.d),hg=h&&GM[h.g];
  if(hd&&hg)$('#cont').innerHTML=`<span class="gart" style="--c:${hg.color}" aria-hidden="true">${ART[hg.k]}</span><div><span class="gcat">Keep going · ${ago(h.at)}</span><h3>${hg.name}</h3><p class="hint" style="margin:0 0 10px;font-size:14px">${esc(hd.title)} · last time: ${esc(h.s)}</p><button class="btn sm" data-setup="${hg.k}" data-deck="${esc(hd.id)}">Play now</button></div>`;
  else $('#cont').innerHTML=`<span class="gart" style="--c:${GM.gr.color}" aria-hidden="true">${ART.gr}</span><div><span class="gcat">New here?</span><h3>Gold Rush with a starter deck</h3><p class="hint" style="margin:0 0 10px;font-size:14px">Try it now with the Word League Words deck. You can make your own deck later.</p><button class="btn sm" data-setup="gr" data-deck="s-words">Start</button></div>`;
  const played=uniq(R.hist.map(x=>x.g)).filter(k=>GM[k]);
  const feat=uniq([...played,'obby','boss','shoot','run','snake','gr']).slice(0,4);
  $('#homeGames').innerHTML=feat.map(k=>gameCard(GM[k])).join('');
  const ds=DECKS.slice(0,6);
  $('#homeDecks').innerHTML=ds.length?ds.map(deckCard).join(''):SAMPLES.map(deckCard).join('');
}

/* ---------- deck list and details ---------- */
function renderDecks(){
  const q=$('#deckSearch').value.trim().toLowerCase(),f=d=>!q||d.title.toLowerCase().includes(q)||(d.desc||'').toLowerCase().includes(q);
  const mine=DECKS.filter(f);
  $('#myDecks').innerHTML=mine.length?mine.map(deckCard).join(''):`<div class="empty">${q?'No decks found.':'You have no decks yet. Tap <b>+ New deck</b>, or open a starter deck below and choose “Copy and edit”.'}</div>`;
  $('#sampleDecks').innerHTML=SAMPLES.filter(f).map(deckCard).join('');
}
function weakList(d,n){const m=R.miss[d.id]||{};return d.cards.map(c=>({c,n:m[ck(c)]||0})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,n)}
/* The Word League Words deck holds every Word League word with its meaning, so its card list and "Copy and edit"
   open only with the parent PIN (15 minutes, or until this tab is left). Playing games with it needs no PIN. */
const LOCKED_DECKS=new Set(['s-words']);let PIN_UNTIL=0;
const pinOpen=()=>Date.now()<PIN_UNTIL;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&PIN_UNTIL){PIN_UNTIL=0;if(CUR&&LOCKED_DECKS.has(CUR.id)&&!$('#vDeck').classList.contains('hide'))openDeck(CUR.id)}});
function askPin(onOk){
  const old=document.getElementById('pinOv');if(old)old.remove();
  const ov=document.createElement('div');ov.id='pinOv';ov.style.cssText='position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px';
  ov.innerHTML=`<div class="card" style="max-width:420px;width:100%"><h2 style="margin-top:0">Parent PIN</h2><p class="hint">This deck has every Word League word and its meaning, so the list opens only with the parent PIN. It locks again after 15 minutes or when you leave this tab.</p>
    <form class="row" id="pinF2"><input type="password" inputmode="numeric" maxlength="4" id="pinIn" placeholder="4 numbers" autocomplete="off" style="width:140px;font-size:18px;padding:8px"><button class="btn sm">Open</button><button type="button" class="btn ghost sm" id="pinNo">Cancel</button></form><p class="err" id="pinErr"></p></div>`;
  document.body.appendChild(ov);const esc0=e=>{if(e.key==='Escape')close()},close=()=>{ov.remove();document.removeEventListener('keydown',esc0)};document.addEventListener('keydown',esc0);ov.addEventListener('click',e=>{if(e.target===ov)close()});
  ov.querySelector('#pinNo').onclick=close;ov.querySelector('#pinIn').focus();
  ov.querySelector('#pinF2').onsubmit=async e=>{e.preventDefault();const out=ov.querySelector('#pinErr');
    if(!PCA||!PCA.checkParentPin){out.textContent='This opens only inside Zanycade.';return}
    let r='err';try{r=await PCA.checkParentPin(ov.querySelector('#pinIn').value.trim())}catch(x){}
    if(r==='ok'){PIN_UNTIL=Date.now()+15*60*1000;close();onOk();return}
    out.textContent=r==='wrong'?'Wrong PIN.':r==='locked'?'Too many wrong tries. Locked for 15 minutes.':r==='nopin'?'No parent PIN yet. In Zanycade, open My Games → Your account and press “Ask my parent”.':'Couldn’t check right now. Try again.'};
}
function openDeck(id){
  const d=findDeck(id);if(!d)return go('decks');CUR=d;SET.deck=d.id;
  $('#dTitle').textContent=d.title;$('#dMeta').textContent=`${d.cards.length} cards${d.desc?' · '+d.desc:''}${d.sample?' · Starter deck':''}`;
  $('#dEdit').textContent=d.sample?'Copy and edit':'Edit';
  $('#dGames').innerHTML=GAMES.map(g=>gameCard(g).replace('data-game=',`data-deck="${esc(d.id)}" data-game=`)).join('');
  const wk=weakList(d,5);
  $('#dWeak').innerHTML=wk.length?`<h2>Cards you often miss</h2><ul class="wl">${wk.map(x=>`<li><span>${esc(x.c.t)} → <em>${esc(x.c.d)}</em></span><small>missed ${x.n}×</small></li>`).join('')}</ul><div class="row" style="margin-top:10px"><button class="btn ghost sm" id="dWeakGo">Flashcards with these cards</button></div>`:'';
  if(wk.length)$('#dWeakGo').onclick=()=>start('flash',d,{dir:'f',weak:false},wk.map(x=>x.c));
  const locked=LOCKED_DECKS.has(d.id)&&!pinOpen();$('#dEdit').classList.toggle('hide',locked);
  $('#dCards').innerHTML=locked?`<tr><td colspan="3" style="padding:14px"><p class="hint" style="margin:0 0 8px">The card list is hidden so the answers stay a surprise. You can still play every game with this deck.</p><button class="btn ghost sm" id="dUnlock">📖 See all cards (parent PIN)</button></td></tr>`
    :d.cards.map((c,i)=>`<tr><td class="n">${i+1}</td><td>${esc(c.t)}</td><td>${esc(c.d)}</td></tr>`).join('');
  if(locked)$('#dUnlock').onclick=()=>askPin(()=>openDeck(d.id));
  show('vDeck','decks');
}
$('#dEdit').addEventListener('click',()=>{const d=CUR;if(LOCKED_DECKS.has(d.id)&&!pinOpen())return askPin(()=>openDeck(d.id));if(d.sample)openEditor({id:newId(),title:d.title+' (my copy)',desc:d.desc,cards:JSON.parse(JSON.stringify(d.cards))});else openEditor(d)});
$('#deckSearch').addEventListener('input',renderDecks);
$('#openImport').addEventListener('click',()=>{$('#importBox').classList.remove('hide');$('#impName').focus()});
$('#closeImport').addEventListener('click',()=>$('#importBox').classList.add('hide'));
function parseLines(t){return t.split('\n').map(l=>l.includes('\t')?l.split('\t'):l.split('|')).map(p=>p.map(s=>s.trim())).filter(p=>p[0]&&p[1]).map(p=>({t:p[0],d:p[1],w:p.slice(2).filter(Boolean)}))}
$('#doImport').addEventListener('click',()=>{
  const raw=$('#impText').value.trim();let deck=null;
  if(raw.startsWith('{')){try{const o=JSON.parse(raw);deck={id:newId(),title:String(o.title||'Imported deck').slice(0,60),desc:String(o.desc||'').slice(0,120),cards:cleanCards(o.cards)}}catch(e){}}
  if(!deck)deck={id:newId(),title:$('#impName').value.trim()||'Imported deck',desc:'',cards:parseLines(raw)};
  if(!deck.cards.length){$('#impErr').textContent='No cards found. Put one card on each line like this: front | back';return}
  $('#impErr').textContent='';$('#impText').value='';$('#impName').value='';$('#importBox').classList.add('hide');openEditor(deck);
});

/* ---------- file import (CSV · TSV · TXT) ---------- */
const DP=new DOMParser();
function cleanField(s){s=String(s||'').replace(/\[sound:[^\]]*\]/g,'').replace(/<br\s*\/?>|<\/div>|<\/p>/gi,' ');if(/[<&]/.test(s))s=DP.parseFromString(s,'text/html').body.textContent||'';return s.replace(/\s+/g,' ').trim()}
function clozeCard(raw){const txt=cleanField(raw);if(!/\{\{c\d+::/.test(txt))return null;const ans=[];const q=txt.replace(/\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g,(m,a,h)=>{ans.push(a);return h?`[${h}]`:'____'});return{t:q,d:ans.join(', ')}}
function decodeText(buf){try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){try{return new TextDecoder('euc-kr').decode(buf)}catch(e2){return new TextDecoder().decode(buf)}}}
function parseDelimited(text){
  text=text.replace(/^﻿/,'');const skip=new Set();let delim=null;
  for(const l of text.split(/\r?\n/)){if(!l.startsWith('#'))break;const m=l.match(/^#(guid|notetype|deck|tags) column:(\d+)/i);if(m)skip.add(+m[2]-1);const s=l.match(/^#separator:(\w+)/i);if(s)delim={tab:'\t',comma:',',semicolon:';',pipe:'|',space:' '}[s[1].toLowerCase()]||null}
  const body=text.split(/\r?\n/).filter(l=>!l.startsWith('#')).join('\n');
  if(!delim){const sm=body.split('\n').slice(0,20).join('\n'),cnt=ch=>sm.split(ch).length-1;const opts=[['\t',cnt('\t')],[',',cnt(',')],[';',cnt(';')],['|',cnt('|')]].sort((a,b)=>b[1]-a[1]);delim=opts[0][1]?opts[0][0]:'\t'}
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<body.length;i++){const ch=body[i];
    if(q){if(ch==='"'){if(body[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
    else if(ch==='"'&&f.trim()===''){q=true;f=''}else if(ch===delim){row.push(f);f=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&body[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=ch}
  if(f!==''||row.length){row.push(f);rows.push(row)}
  let rs=rows.map(r=>r.filter((_,i)=>!skip.has(i))).filter(r=>r.some(x=>x.trim()));
  const H=/^(front|back|term|terms|definition|definitions|word|meaning|question|answer|q|a|front side|back side|term|clue|english)$/i;
  if(rs.length&&rs[0].length>=2&&H.test(rs[0][0].trim())&&H.test(rs[0][1].trim()))rs=rs.slice(1);
  const out=[];let bad=0;for(const r of rs){const cz=r.length===1||!cleanField(r[1])?clozeCard(r[0]):null;if(cz){out.push({...cz,w:[]});continue}const t=cleanField(r[0]),d=cleanField(r[1]);if(t&&d)out.push({t,d,w:r.slice(2).map(cleanField).filter(Boolean).slice(0,5)});else bad++}
  return{cards:out,bad};
}
async function importFile(file){
  const err=$('#impErr'),name=file.name.replace(/\.[^.]+$/,'').slice(0,60);err.textContent='';$('#impStatus').textContent=`Reading “${file.name}”…`;$('#importBox').classList.remove('hide');
  try{const buf=await file.arrayBuffer();const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!['csv','tsv','txt'].includes(ext))throw new Error('Please choose a .csv, .tsv or .txt file.');const r=parseDelimited(decodeText(buf));
    if(!r.cards.length)throw new Error('No cards found. Check that each line has a front and a back, split by a comma or a tab.');
    let cards=r.cards,extra='';if(cards.length>1500){extra=` That was a lot, so only the first 1500 cards came in.`;cards=cards.slice(0,1500)}
    $('#impStatus').textContent='';const deck={id:newId(),title:$('#impName').value.trim()||name||'Imported deck',desc:`From ${file.name}`,cards};
    openEditor(deck);$('#edErr').textContent=`Imported ${cards.length} cards.${r.bad?` Left out ${r.bad} with an empty side.`:''}${extra} Check them, then tap Save.`;$('#edErr').style.color='var(--ok)';
  }catch(e){$('#impStatus').textContent='';err.textContent=(e&&e.message)||'Could not read that file.'}
}
$('#impFile').addEventListener('change',e=>{const f=e.target.files[0];if(f)importFile(f);e.target.value=''});
$('#impFile2').addEventListener('change',e=>{const f=e.target.files[0];if(f)importFile(f);e.target.value=''});
{const dz=$('#dropZone');['dragenter','dragover'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add('over')}));['dragleave','drop'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove('over')}));dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)importFile(f)})}

/* ---------- deck editor ---------- */
let ED=null;const blank=()=>({t:'',d:'',w:[]});
function openEditor(d){
  stopGame();ED=d?JSON.parse(JSON.stringify(d)):{id:newId(),title:'',desc:'',cards:[]};
  while(ED.cards.length<4)ED.cards.push(blank());
  const exists=DECKS.some(x=>x.id===ED.id);
  $('#edHead').textContent=exists?'Edit deck':'New deck';$('#edTitle').value=ED.title;$('#edDesc').value=ED.desc||'';
  $('#delDeck').classList.toggle('hide',!exists);$('#delConfirm').classList.add('hide');$('#edErr').textContent='';$('#edErr').style.color='';
  renderRows();show('vEdit','decks');if(!ED.title)$('#edTitle').focus();
}
function renderRows(){
  $('#rows').innerHTML=ED.cards.map((c,i)=>`<div class="erow" data-i="${i}"><span class="num">${i+1}</span><input data-f="t" value="${esc(c.t)}" placeholder="Front" aria-label="Card ${i+1} front"><input data-f="d" value="${esc(c.d)}" placeholder="Back" aria-label="Card ${i+1} back"><input data-f="w" value="${esc((c.w||[]).join('; '))}" placeholder="Wrong answers (optional)" aria-label="Card ${i+1} wrong answers"><button class="x" data-del="${i}" aria-label="Delete card ${i+1}">×</button></div>`).join('');
  countRows();
}
function countRows(){const n=ED.cards.filter(c=>c.t.trim()&&c.d.trim()).length;$('#edCount').textContent=`${n} card${n===1?'':'s'} ready`}
$('#rows').addEventListener('input',e=>{const r=e.target.closest('.erow');if(!r)return;const c=ED.cards[+r.dataset.i],f=e.target.dataset.f;if(f==='w')c.w=e.target.value.split(';').map(s=>s.trim()).filter(Boolean);else c[f]=e.target.value;countRows()});
$('#rows').addEventListener('click',e=>{const b=e.target.closest('[data-del]');if(!b)return;ED.cards.splice(+b.dataset.del,1);if(!ED.cards.length)ED.cards.push(blank());renderRows()});
$('#rows').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.f){e.preventDefault();const row=e.target.closest('.erow'),i=+row.dataset.i;if(e.target.dataset.f==='t'){row.querySelector('[data-f="d"]').focus();return}if(i===ED.cards.length-1){ED.cards.push(blank());renderRows()}const n=$(`.erow[data-i="${i+1}"] input`);if(n)n.focus()}});
$('#addRow').addEventListener('click',()=>{ED.cards.push(blank());renderRows();$(`.erow[data-i="${ED.cards.length-1}"] input`).focus()});
$('#addBulk').addEventListener('click',()=>{const add=parseLines($('#bulk').value);if(!add.length)return;ED.cards=ED.cards.filter(c=>c.t.trim()||c.d.trim()).concat(add);$('#bulk').value='';renderRows()});
$('#saveDeck').addEventListener('click',()=>{
  const title=$('#edTitle').value.trim(),cards=cleanCards(ED.cards);
  if(!title){$('#edErr').textContent='Give your deck a name.';$('#edTitle').focus();return}
  if(!cards.length){$('#edErr').textContent='You need at least one card with both a front and a back.';return}
  const d={id:ED.id,title,desc:$('#edDesc').value.trim(),cards};saveDeck(d);openDeck(d.id);
});
$('#cancelEdit').addEventListener('click',()=>{if(findDeck(ED.id))openDeck(ED.id);else go('decks')});
$('#delDeck').addEventListener('click',()=>$('#delConfirm').classList.remove('hide'));
$('#delNo').addEventListener('click',()=>$('#delConfirm').classList.add('hide'));
$('#delYes').addEventListener('click',()=>{removeDeck(ED.id);go('decks')});

/* ---------- game list and setup ---------- */
function renderGames(){
  $('#catChips').innerHTML=[['all','All '+GAMES.length],...Object.entries(CATS)].map(([k,v])=>`<button class="chip ${CAT===k?'on':''}" data-cat="${k}">${v}</button>`).join('');
  $('#allGames').innerHTML=GAMES.filter(g=>CAT==='all'||g.cat===CAT).map(gameCard).join('');
}
$('#catChips').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b){CAT=b.dataset.cat;renderGames()}});
const distinctMin=d=>Math.min(uniq(d.cards.map(c=>c.t)).length,uniq(d.cards.map(c=>c.d)).length);
function openSetup(k,deckId){
  stopGame();const g=GM[k];SET.game=k;
  SET.deck=deckId||SET.deck||last.deck||'s-words';if(!findDeck(SET.deck))SET.deck='s-words';
  $('#sGame').innerHTML=`<div class="sart" style="--c:${g.color}" aria-hidden="true">${ART[k]}</div><span class="gcat">${CATS[g.cat]}</span><h1>${g.name}</h1><p style="margin:0">${g.desc}</p><h2 class="ctlh">Controls</h2>${ctlHTML(g.ctl)}<ol class="how">${g.how.map(x=>`<li>${x}</li>`).join('')}</ol>`;
  $('#sDeck').innerHTML=(DECKS.length?`<optgroup label="My decks">${DECKS.map(d=>`<option value="${esc(d.id)}">${esc(d.title)} (${d.cards.length})</option>`).join('')}</optgroup>`:'')+`<optgroup label="Starter decks">${SAMPLES.map(d=>`<option value="${d.id}">${esc(d.title)}</option>`).join('')}</optgroup>`;
  $('#sDeck').value=SET.deck;
  const saved=lget('sa-opt-'+k,{});
  $('#sOpts').innerHTML=g.opts.map(o=>`<label class="lab" for="so-${o.id}">${o.label}</label><select id="so-${o.id}" data-o="${o.id}">${o.ch.map(([v,l,d])=>`<option value="${v}" ${(saved[o.id]?saved[o.id]===v:d)?'selected':''}>${l}</option>`).join('')}</select>`).join('');
  $('#sDir').value=last.dir||'f';
  updateSetup();show('vSetup','games');
}
function updateSetup(){
  const d=findDeck($('#sDeck').value),g=GM[SET.game];if(!d)return;SET.deck=d.id;
  const weak=weakList(d,999).length;
  $('#sDeckInfo').textContent=`${d.cards.length} cards${weak?` · ${weak} often missed`:''}`;
  let err='';if(d.cards.length<g.min)err=`This game needs at least ${g.min} cards.`;else if(g.k==='bingo'&&distinctMin(d)<9)err='Bingo needs at least 9 different answers.';
  $('#sErr').textContent=err;$('#sStart').disabled=!!err;
  const rs=g.recs.map(rk=>[RECDEF[rk].n,R.data[d.id+':'+rk]]).filter(x=>x[1]!=null);
  $('#sRec').innerHTML=g.recs.length?`<div class="recs">${rs.length?rs.map(([n,v],i)=>`<div><span>${n} best</span><b>${RECDEF[g.recs.find(r=>RECDEF[r].n===n)].f(v)}</b></div>`).join(''):'<div><span>Your best with this deck</span><b>None yet</b></div>'}</div>`:'';
}
$('#sDeck').addEventListener('change',updateSetup);
$('#sStart').addEventListener('click',()=>{
  const d=findDeck($('#sDeck').value),g=GM[SET.game],opts={dir:$('#sDir').value,weak:$('#sWeak').checked},sv={};
  $$('#sOpts select').forEach(s=>{opts[s.dataset.o]=s.value;sv[s.dataset.o]=s.value});lset('sa-opt-'+g.k,sv);
  last.deck=d.id;last.dir=opts.dir;lset('sa-last',last);start(g.k,d,opts);
});


/* ---------- sound and effects ---------- */
const SFX={ac:null,on:lget('sa-sound',true),
  init(){try{if(!this.ac)this.ac=new (window.AudioContext||window.webkitAudioContext)();if(this.ac.state==='suspended')this.ac.resume().catch(()=>{})}catch(e){}},
  ok(){return this.on&&this.ac&&this.ac.state==='running'},
  t(f,d,type,vol,at,f2){if(!this.ok())return;try{const a=this.ac,o=a.createOscillator(),g=a.createGain(),s=a.currentTime+(at||0);o.type=type||'sine';o.frequency.setValueAtTime(f,s);if(f2)o.frequency.exponentialRampToValueAtTime(f2,s+d);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(vol||.12,s+.01);g.gain.exponentialRampToValueAtTime(.0001,s+d);o.connect(g);g.connect(a.destination);o.start(s);o.stop(s+d+.03)}catch(e){}},
  noise(d,vol){if(!this.ok())return;try{const a=this.ac,n=Math.floor(a.sampleRate*d),b=a.createBuffer(1,n,a.sampleRate),ch=b.getChannelData(0);for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);const s=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=900;s.buffer=b;g.gain.value=vol||.25;s.connect(f);f.connect(g);g.connect(a.destination);s.start()}catch(e){}},
  play(k,n){const T=(...a)=>this.t(...a);switch(k){
    case'good':T(660,.1,'triangle',.14);T(990,.16,'triangle',.14,.08);break;
    case'bad':T(240,.16,'sawtooth',.06);T(170,.24,'sawtooth',.06,.1);break;
    case'coin':T(1320,.07,'square',.04);T(1760,.12,'square',.04,.06);break;
    case'combo':T(520+Math.min(n,12)*70,.09,'triangle',.12);T(780+Math.min(n,12)*70,.15,'triangle',.12,.07);break;
    case'tick':T(700,.08,'sine',.16);break;
    case'go':T(1046,.3,'triangle',.16);T(1568,.3,'sine',.07);break;
    case'win':[523,659,784,1046].forEach((f,i)=>T(f,.2,'triangle',.13,i*.11));break;
    case'lose':[392,330,262].forEach((f,i)=>T(f,.24,'triangle',.11,i*.15));break;
    case'star':T(880+(n||0)*220,.16,'triangle',.13);break;
    case'laser':T(1400,.14,'square',.035,0,300);break;
    case'boom':this.noise(.35,.3);break;
    case'hit':this.noise(.15,.25);T(140,.15,'square',.07);break;
    case'flip':T(420,.06,'sine',.08,0,640);break;
    case'jump':T(360,.12,'square',.045,0,820);break;
    case'buy':T(880,.07,'square',.045);T(1175,.07,'square',.045,.06);T(1568,.12,'square',.045,.12);break;
  }}};
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const CONF=['#e9503f','#2f74e0','#f2b632','#11897c','#ff8fa3','#ffffff'];
const FX={ps:[],raf:0,
  init(){this.cv=$('#fx');this.g=this.cv.getContext('2d');const fit=()=>{this.d=Math.min(2,devicePixelRatio||1);this.cv.width=innerWidth*this.d;this.cv.height=innerHeight*this.d};fit();addEventListener('resize',fit)},
  add(p){if(RM||!this.g)return;p.age=0;this.ps.push(p);if(!this.raf){this.last=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t))}},
  loop(t){const dt=Math.min(.05,(t-this.last)/1000);this.last=t;const g=this.g;g.setTransform(this.d,0,0,this.d,0,0);g.clearRect(0,0,innerWidth,innerHeight);
    for(const p of this.ps){p.age+=dt;p.life-=dt;
      if(p.tx!=null){if(p.age>p.delay){p.x+=(p.tx-p.x)*Math.min(1,dt*9);p.y+=(p.ty-p.y)*Math.min(1,dt*9);if(Math.hypot(p.tx-p.x,p.ty-p.y)<14)p.life=0}else{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.9;p.vy*=.9}}
      else{p.vy+=p.gr*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
      p.r+=p.vr*dt;g.save();g.globalAlpha=Math.max(0,Math.min(1,p.life/p.max*2.5));g.translate(p.x,p.y);g.rotate(p.r);g.fillStyle=p.c;
      if(p.k==='coin'){g.beginPath();g.ellipse(0,0,8,8*Math.max(.15,Math.abs(Math.cos(p.age*9))),0,0,6.3);g.fill();g.strokeStyle='#b97c06';g.lineWidth=1.6;g.stroke()}
      else if(p.k==='star'){g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5,rr=i%2?p.s*.45:p.s;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}g.closePath();g.fill()}
      else g.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);g.restore()}
    this.ps=this.ps.filter(p=>p.life>0);if(this.ps.length)this.raf=requestAnimationFrame(t=>this.loop(t));else{this.raf=0;g.clearRect(0,0,innerWidth,innerHeight)}},
  confetti(n){for(let i=0;i<(n||140);i++)this.add({x:innerWidth*Math.random(),y:-20-Math.random()*innerHeight*.4,vx:(Math.random()-.5)*140,vy:120+Math.random()*220,gr:160,r:Math.random()*6,vr:(Math.random()-.5)*10,s:9+Math.random()*7,c:CONF[i%CONF.length],life:2.6+Math.random()*1.2,max:3.8})},
  burst(x,y,n){for(let i=0;i<(n||20);i++){const a=Math.random()*6.28,s=140+Math.random()*260;this.add({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-90,gr:520,r:0,vr:(Math.random()-.5)*12,s:Math.random()<.45?7:9,k:Math.random()<.45?'star':'',c:CONF[i%5],life:.75,max:.75})}},
  coins(x,y,tx,ty,n){for(let i=0;i<(n||8);i++)this.add({x:x+(Math.random()-.5)*40,y:y+(Math.random()-.5)*20,vx:(Math.random()-.5)*420,vy:-160-Math.random()*240,gr:0,r:0,vr:0,c:'#ffd76a',k:'coin',life:1.6,max:1.6,tx,ty,delay:.28+i*.035})}};
const SHOP=[
  {id:'c-coral',t:'c',name:'Coral',price:0,col:'#ff6b57'},{id:'c-sky',t:'c',name:'Sky',price:60,col:'#3d8fe8'},{id:'c-lemon',t:'c',name:'Lemon',price:60,col:'#f2b632'},
  {id:'c-mint',t:'c',name:'Mint',price:60,col:'#1fae86'},{id:'c-grape',t:'c',name:'Grape',price:120,col:'#8b6cf0'},{id:'c-night',t:'c',name:'Midnight',price:150,col:'#33406e'},{id:'c-gold',t:'c',name:'Gold',price:400,col:'#e0a800',shine:1},
  {id:'a-none',t:'a',name:'None',price:0},{id:'a-glass',t:'a',name:'Glasses',price:80},{id:'a-ribbon',t:'a',name:'Bow',price:80},{id:'a-phones',t:'a',name:'Headphones',price:120},{id:'a-cap',t:'a',name:'Grad Cap',price:150},{id:'a-crown',t:'a',name:'Crown',price:300},
  {id:'i-boost',t:'i',name:'Coin Booster',desc:'Double coins for your next 3 games',price:150},{id:'i-shield',t:'i',name:'Streak Saver',desc:'Keeps your streak if you miss a day (hold up to 3)',price:80},
];
const SI=Object.fromEntries(SHOP.map(s=>[s.id,s]));
const dark=(h,k)=>{const n=parseInt(h.slice(1),16),f=x=>Math.max(0,Math.round(x*(1-k)));return'#'+[n>>16,(n>>8)&255,n&255].map(f).map(x=>x.toString(16).padStart(2,'0')).join('')};
const ACC={
  'a-glass':`<g fill="rgba(255,255,255,.35)" stroke="#1b1b1b" stroke-width="1.8"><circle cx="24.5" cy="20" r="5"/><circle cx="35.5" cy="20" r="5"/></g><path d="M29.5 20h1" stroke="#1b1b1b" stroke-width="1.8"/>`,
  'a-ribbon':`<g fill="#ff8fb1"><path d="M38 9l-8-5v10z"/><path d="M38 9l8-5v10z"/><circle cx="38" cy="9" r="2.6" fill="#e9608c"/></g>`,
  'a-phones':`<path d="M16.5 21A13.5 13.5 0 0 1 43.5 21" fill="none" stroke="#1b2a25" stroke-width="3.2"/><rect x="12.5" y="17" width="6" height="10" rx="2.5" fill="#1b2a25"/><rect x="41.5" y="17" width="6" height="10" rx="2.5" fill="#1b2a25"/>`,
  'a-cap':`<path d="M14 9l16-6 16 6-16 6z" fill="#1b2a25"/><path d="M21 11.5v4.5c5 3 13 3 18 0v-4.5l-9 3.4z" fill="#26332e"/><path d="M44 9v8" stroke="#f2b632" stroke-width="1.6"/><circle cx="44" cy="17.5" r="1.8" fill="#f2b632"/>`,
  'a-crown':`<path d="M19 11L21 1l5 6 4-7 4 7 5-6 2 10z" fill="#f2b632" stroke="#b97c06" stroke-width="1.2" stroke-linejoin="round"/><circle cx="30" cy="7" r="1.5" fill="#e9503f"/>`};
function mascotSVG(cid,aid){const inv=R.inv||{equip:{}};if(!cid&&inv.avatar&&typeof CH!=='undefined'&&CH[inv.avatar])return charSVG(CH[inv.avatar],aid||inv.equip.a);const s=SI[cid||inv.equip.c]||SI['c-coral'],a=aid||inv.equip.a||'a-none',col=s.col,dk=dark(col,.2);
  return `<svg viewBox="0 0 60 64" aria-hidden="true"><ellipse cx="30" cy="61" rx="15" ry="2.5" fill="#000" opacity=".2"/><path d="M15 40 L4 32 L12 48Z" fill="${dk}"/><path d="M45 40 L56 32 L48 48Z" fill="${dk}"/><path d="M30 26 L47 58 L13 58Z" fill="${col}"/><circle cx="30" cy="22" r="14" fill="${col}"/>${s.shine?'<path d="M21 14a10 10 0 0 1 8-5" stroke="#fff6cf" stroke-width="2.5" fill="none" stroke-linecap="round"/>':''}<circle cx="25" cy="20" r="2.4" fill="#1b1b1b"/><circle cx="35" cy="20" r="2.4" fill="#1b1b1b"/><path d="M27 25 L33 25 L30 30Z" fill="#f2b632"/><path d="M30 41l1.8 3.6 4 .6-2.9 2.8.7 4L30 50.1l-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff"/>${ACC[a]||''}</svg>`}
function setMascot(){const m=$('#mascot');if(m){const old=m.querySelector('svg');if(old)old.remove();m.insertAdjacentHTML('afterbegin',mascotSVG())}const h=$('#heroMas');if(h)h.innerHTML=mascotSVG()}
const pickOne=a=>a[rnd(a.length)];
const Mascot={tm:0,say(state,text){const el=$('#mascot'),b=$('#bub');if(!el)return;el.className='mascot '+(state||'');void el.offsetWidth;b.textContent=text;b.classList.add('on');clearTimeout(this.tm);this.tm=setTimeout(()=>{b.classList.remove('on');el.className='mascot'},1400)}};
const LINES={good:['Nice!','Correct!','Awesome!','Perfect!','Great job!','Keep it up!'],bad:['No worries!','So close!','You will get it next time','Try again!','Remember this one!']};
const elC=el=>{if(el&&el.x!=null)return el;if(!el||!el.getBoundingClientRect)return{x:innerWidth/2,y:innerHeight*.45};const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}};
function shake(){const s=$('#stage');s.classList.remove('shk');void s.offsetWidth;s.classList.add('shk')}
function popup(t,cls){const p=document.createElement('div');p.className='combo '+(cls||'');p.textContent=t;document.body.appendChild(p);setTimeout(()=>p.remove(),1000)}
const fx={sfx:(k,n)=>SFX.play(k,n),shake,popup,confetti:n=>FX.confetti(n),
  good(el){SFX.play('good');const p=elC(el);FX.burst(p.x,p.y);if(Math.random()<.45)Mascot.say('happy',pickOne(LINES.good))},
  bad(el){SFX.play('bad');shake();Mascot.say('sad',pickOne(LINES.bad))},
  combo(n){if(n<3)return;setTimeout(()=>SFX.play('combo',n),120);popup(n+' in a row!');if(n%5===0)FX.confetti(50);Mascot.say('happy',n>=5?`${n} in a row! On fire!`:`${n} in a row!`)},
  coins(from,to){const a=elC(from),b=elC(to);FX.coins(a.x,a.y,b.x,b.y);SFX.play('coin');setTimeout(()=>SFX.play('coin'),320)}};

/* ---------- running a game ---------- */
const IMPL={};
function drawAns(box,q){const qe=document.getElementById('q');if(qe){qe.classList.remove('qin');void qe.offsetWidth;qe.classList.add('qin')}box.classList.remove('lock');box.innerHTML=q.opts.map((o,i)=>`<button class="c${i}" data-i="${i}"><kbd>${i+1}</kbd><span>${esc(o)}</span></button>`).join('')}
function floatTxt(el,t,c){const f=document.createElement('div');f.className='float';f.style.color=c;f.textContent=t;el.appendChild(f);setTimeout(()=>f.remove(),1000)}
function mkCanvas(parent,LW,LH){
  const wrap=document.createElement('div');wrap.className='cvwrap';wrap.style.maxWidth=`calc(58vh * ${LW/LH})`;const cv=document.createElement('canvas');wrap.appendChild(cv);parent.appendChild(wrap);
  const g=cv.getContext('2d');
  const o={cv,g,wrap,LW,LH,s:1,fit(){const w=wrap.clientWidth||LW,dpr=Math.min(2,window.devicePixelRatio||1);cv.style.height=w*LH/LW+'px';cv.width=Math.max(1,Math.round(w*dpr));cv.height=Math.max(1,Math.round(w*LH/LW*dpr));o.s=w/LW*dpr},
    begin(){g.setTransform(o.s,0,0,o.s,0,0)},
    pt(e){const r=cv.getBoundingClientRect(),p=e.touches&&e.touches[0]||e.changedTouches&&e.changedTouches[0]||e;return{x:(p.clientX-r.left)/r.width*LW,y:(p.clientY-r.top)/r.height*LH}}};
  o.ro=new ResizeObserver(()=>o.fit());o.ro.observe(wrap);o.fit();return o;
}
function wrapText(g,text,maxW,maxLines,size,weight){
  const toks=[];for(const w of String(text).split(/(\s+)/)){if(!w)continue;toks.push(w)}
  for(let s=size;s>=10;s--){
    g.font=`${weight||700} ${s}px "Noto Sans KR",sans-serif`;const lines=[];let line='';
    const push=t=>{const nx=line+t;if(g.measureText(nx).width>maxW&&line.trim()){lines.push(line.trim());line=t.trimStart()}else line=nx};
    for(const t of toks){if(g.measureText(t).width>maxW){for(const ch of t)push(ch)}else push(t)}
    if(line.trim())lines.push(line.trim());
    if(lines.length<=maxLines||s===10){
      // even lines: narrow the box while the line count stays the same, so the last line is not one lone word
      if(lines.length>1&&lines.length<=maxLines&&toks.every(t=>g.measureText(t).width<=maxW)){const fit=mw=>{const ls=[];let ln='';for(const t of toks){const nx=ln+t;if(g.measureText(nx).width>mw&&ln.trim()){ls.push(ln.trim());ln=t.trimStart()}else ln=nx}if(ln.trim())ls.push(ln.trim());return ls};
        let lo=0,hi=maxW;for(let k=0;k<12;k++){const mid=(lo+hi)/2,ls=fit(mid);if(ls.length===lines.length&&ls.every(l=>g.measureText(l).width<=maxW))hi=mid;else lo=mid}
        const best=fit(hi);if(best.length===lines.length)return{lines:best,size:s}}
      return{lines:lines.slice(0,maxLines),size:s}}
  }
}
function drawLines(g,w,cx,cy,color,weight){g.font=`${weight||700} ${w.size}px "Noto Sans KR",sans-serif`;g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';const lh=w.size*1.2,top=cy-(w.lines.length-1)*lh/2;w.lines.forEach((l,i)=>g.fillText(l,cx,top+i*lh))}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}

let SESSION={hits:new Map()};
function makeCtx(deck,opts,cards){
  const list=cards&&cards.length?cards:deck.cards;
  const dir=()=>opts.dir==='mix'?(rnd(2)?'f':'b'):opts.dir;
  return{$,esc,fmt,rnd,shuf,uniq,mmss,stage:$('#stage'),opts,deck,cards:list,dir,
    setStats:h=>{$('#pStats').innerHTML=h},
    makeQ(card,d){d=d||dir();const q=d==='f'?card.t:card.d,a=d==='f'?card.d:card.t;let w=d==='f'?(card.w||[]).filter(x=>x!==a):[];
      const pool=shuf(uniq(deck.cards.map(c=>d==='f'?c.d:c.t)).filter(x=>x!==a&&!w.includes(x)));w=uniq(w).slice(0,3).concat(pool).slice(0,3);
      return{card,q,a,dir:d,opts:shuf([a,...w]),tag:d==='f'?'Front → Back':'Back → Front'}},
    // games that pick their own set of cards: with "often miss" on, missed cards (most missed first) come before the rest
    weakFirst(l){if(!opts.weak)return shuf(l);const m=R.miss[deck.id]||{};return l.map(x=>[x,(m[ck(x)]?1-Math.min(3,m[ck(x)])/4:1)+Math.random()*.2]).sort((a,b)=>a[1]-b[1]).map(x=>x[0])},
    dealer(l){l=l||list;const m=R.miss[deck.id]||{};let bag=[],lastC=null;
      const fill=()=>{const b=[];for(const c of l){b.push(c);if(opts.weak){const n=Math.min(3,m[ck(c)]||0);for(let i=0;i<n;i++)b.push(c)}}bag=shuf(b)};
      return()=>{if(!bag.length)fill();if(bag.length>1&&bag[0]===lastC){const j=bag.findIndex(c=>c!==lastC);if(j>0)[bag[0],bag[j]]=[bag[j],bag[0]]}return lastC=bag.shift()}},
    drawAns,floatTxt,mkCanvas,wrapText,drawLines,rr,finish,fx,avatar:()=>mascotSVG(),hit:card=>{if(card)SESSION.hits.set(ck(card),card)}};
}
function start(k,deck,opts,cards){window.SA_OVR=0;
  stopGame();CUR=deck;LAST={k,deck,opts,cards};SESSION={hits:new Map()};
  $('#pTitle').textContent=`${GM[k].name} · ${deck.title}`;$('#stage').innerHTML='';$('#pStats').innerHTML='';show('vPlay');
  SFX.init();const tok=++CD;
  const run=()=>{if(tok!==CD)return;try{const cx=makeCtx(deck,opts,cards);cx.ctl=()=>ctlHTML(GM[k].ctl,1);G=IMPL[k](cx);Mascot.say('happy',pickOne(["Let's go!",'Ready!','You got this!']))}catch(e){console.error(e);$('#stage').innerHTML='<p class="err">The game could not start.</p>'}};
  if(k==='flash')return run();
  const ov=document.createElement('div');ov.className='cd';$('#stage').appendChild(ov);let n=3;
  const step=()=>{if(tok!==CD){ov.remove();return}
    if(n>0){ov.innerHTML=`<b>${n}</b><span>${esc(GM[k].name)} · ${esc(deck.title)}</span>`;SFX.play('tick');n--;setTimeout(step,650)}
    else{ov.innerHTML='<b>GO!</b><span>&nbsp;</span>';SFX.play('go');setTimeout(()=>{ov.remove();run()},420)}};
  step();
}
$('#exitPlay').addEventListener('click',()=>{stopGame();openSetup(LAST.k,LAST.deck.id)});
$('#endPlay').addEventListener('click',()=>{if(G&&G.end)G.end()});
document.addEventListener('keydown',e=>{if(!G||!G.key||$('#vPlay').classList.contains('hide')||(e.target.matches&&e.target.matches('input,textarea,select')))return;G.key(e)});

/* Zanycade learning mode: a finished round on a starter deck earns Zanycade game time (shared daily limit with Math Space War).
   Every 10 questions with 80%+ right = 1 minute. Not for your own decks, Flashcards or Yes or No; "Count it as right" doesn't count. */
// Learning mode: show the Zanycade game time next to the coins, so nobody mixes them up (coins stay in Study Arcade).
function showGameTime(min,cap){const c=$('#gtChip'),box=$('#gtInfo');if(!c)return;if(min==null){c.hidden=true;if(box)box.hidden=true;return}$('#gtN').textContent=fmt(min);c.hidden=false;if(box){box.hidden=false;$('#gtHave').textContent=fmt(min);if(cap!=null)$('#gtCap').textContent=cap}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGameTime()});
function refreshGameTime(){try{if(!PCA||!PCA.learnWallet||!PCA.profile||!PCA.profile.learn_mode)return showGameTime(null);
  PCA.learnWallet().then(w=>showGameTime(w?w.math_min:null,w&&w.math_cap)).catch(()=>{})}catch(e){}}
function pcLearn(r,deck,k){try{
  if(!PCA||!PCA.learnRound||!PCA.profile||!PCA.profile.learn_mode||!r.total)return;
  const box=document.createElement('div');box.className='pcl';
  const say=(t,good)=>{box.textContent='🎮 '+t;box.classList.toggle('good',!!good);$('#rCoins').appendChild(box)};
  if(!deck||!deck.sample)return say('Your own decks are for practice. Play a starter deck to earn Zanycade game time.');
  if(k==='flash'||k==='ox')return say(`${GM[k].name} doesn’t earn Zanycade game time. Try a quiz or action game.`);
  const n=r.total,good=Math.max(0,(r.right||0)-(window.SA_OVR||0));
  if(n<10)return say('Answer at least 10 questions to earn Zanycade game time.');
  const lvOf=deck.id==='s-math'?(()=>{const g=mathGrade();return ()=>g})():()=>99;
  const levels=Array.from({length:Math.min(good,n)},()=>lvOf());
  PCA.learnRound(SLUG,n,levels).then(x=>{if(!x||x.why==='off'||x.why==='signin')return;
    if(x.math_min!=null)showGameTime(x.math_min,x.math_cap);
    if(x.ok)say(`+${x.got} minute${x.got>1?'s':''} of Zanycade game time! (today ${x.math_today} of ${x.math_cap})`,true);
    else if(x.why==='score')say(`Get 8 out of 10 right (80%) to earn Zanycade game time. This round: ${Math.round(good/n*100)}%.`);
    else if(x.why==='fast')say('Game time comes at most once a minute. Keep going!');
    else if(x.why==='cap')say(`You’ve earned today’s game time from learning games (${x.math_cap} min). You can keep practicing!`)}).catch(()=>{});
}catch(e){}}
/* ---------- results ---------- */
function finish(r){
  stopGame();const deck=CUR,k=LAST.k,wr=r.wrongs||[];let note=r.sub||'';
  if(r.rec&&r.rec.val!=null&&isFinite(r.rec.val)&&(RECDEF[r.rec.key].lo||r.rec.val>0)){const key=deck.id+':'+r.rec.key,old=R.data[key],def=RECDEF[r.rec.key];
    if(old==null||(def.lo?r.rec.val<old:r.rec.val>old)){R.data[key]=r.rec.val;note=old==null?'First record saved.':'New personal best!'}else note=note||'Personal best: '+def.f(old)}
  const seen=new Set();WRONG=wr.filter(c=>c&&!seen.has(ck(c))&&seen.add(ck(c)));
  const m0=R.miss[deck.id]||{},wrongK=new Set(WRONG.map(ck));let weakHit=0,over=0;
  for(const [key] of SESSION.hits){if(m0[key]>0&&!wrongK.has(key)){weakHit++;m0[key]--;if(m0[key]<=0){delete m0[key];over++}}}
  if(WRONG.length){const m=R.miss[deck.id]||(R.miss[deck.id]={});for(const c of WRONG)m[ck(c)]=(m[ck(c)]||0)+1;const ks=Object.keys(m);if(ks.length>150)ks.sort((a,b)=>m[a]-m[b]).slice(0,ks.length-150).forEach(x=>delete m[x])}
  const lines=[];let firstToday=false;wallet();
  if(r.total){
    if(!R.days.includes(today())){firstToday=true;const dd=n=>{const x=new Date();x.setDate(x.getDate()-n);return x.toLocaleDateString('en-CA')};
      if(!R.days.includes(dd(1))&&R.days.includes(dd(2))&&R.inv.shield>0){R.inv.shield--;R.days.push(dd(1));R.days.sort();lines.push(['Streak Saver used: your streak is safe',0])}}
    R.tot.games++;R.tot.ans+=r.total;R.tot.right+=r.right||0;if(!R.days.includes(today()))R.days.push(today());R.days=R.days.slice(-90);
    R.hist.unshift({d:deck.id,t:deck.title,g:k,s:r.score||r.title,at:Date.now()});R.hist=R.hist.slice(0,30)}
  let gain=0;
  if(r.total){const right=r.right||0,acc=right/r.total;
    if(right)lines.push([`${right} right answer${right===1?'':'s'}`,right]);
    if(weakHit)lines.push([`Got ${weakHit} often-missed card${weakHit===1?'':'s'} right`,weakHit*2]);
    if(over)lines.push([`Beat ${over} weak card${over===1?'':'s'}`,over*5]);
    if(r.total>=5&&acc>=.9)lines.push(['90% or better',10]);else if(r.total>=5&&acc>=.7)lines.push(['70% or better',5]);
    if(/New personal best/.test(note))lines.push(['New personal best',15]);
    if(firstToday){lines.push(['First game today',20]);const st=streakDays();if(st>1)lines.push([`Day ${st} of your streak`,5*Math.min(st,7)])}
    gain=lines.reduce((s,x)=>s+x[1],0);
    if(R.earn.d!==today())R.earn={d:today(),n:0};
    if(gain&&R.inv.boost>0){R.inv.boost--;lines.push([`Coin Booster ×2 (${R.inv.boost} left)`,gain]);gain*=2}
    if(gain&&R.earn.n>=400){const h=Math.ceil(gain/2);lines.push(['Over 400 coins today: half coins now (time for a break!)',h-gain]);gain=h}
    if(gain){R.earn.n+=gain;addCoins(gain,`${GM[k].name} · ${deck.title}`)}
    bumpMissions({game:k,right,total:r.total,weak:weakHit,over,done:!!r.done});
  }
  $('#rCoins').innerHTML=r.total?`<div class="coinbox"><div class="cbh"><span>Coins earned</span><b><i class="cico"></i> +${fmt(gain)}</b></div><ul>${lines.map(([l,v])=>`<li><span>${esc(l)}</span><b>${v>0?'+':''}${v?fmt(v):''}</b></li>`).join('')}</ul>${missionDone()?'<p class="hint">You finished a daily mission! Claim it on the Home page.</p>':''}</div>`:'';
  if(gain)setTimeout(()=>flyCoins($('#rCoins .cbh b'),gain),900);
  pcLearn(r,deck,k);
  saveRec();pushRank();
  const pct=r.total?Math.min(1,(r.right||0)/r.total):0,stars=r.total?(pct>=.9?3:pct>=.7?2:pct>=.4?1:0):0,isRec=/New personal best/.test(note);
  $('#rStars').innerHTML=r.total?[0,1,2].map(i=>`<svg class="st ${i<stars?'on':''}" style="animation-delay:${.25+i*.28}s" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/></svg>`).join('')+`<span class="sr">${stars} stars</span>`:'';
  for(let i=0;i<stars;i++)setTimeout(()=>SFX.play('star',i),250+i*280);
  setTimeout(()=>SFX.play(stars>=1||isRec?'win':'lose'),stars*280+300);
  if(isRec||stars===3)setTimeout(()=>FX.confetti(),350);
  $('#rMas').innerHTML=mascotSVG()+`<span class="rbub">${isRec?'New record! Amazing!':stars===3?'Perfect! Three stars!':stars===2?'Nice! Almost there!':stars===1?'Good start!':'Let us review the missed cards!'}</span>`;
  $('#rGame').textContent=`${GM[k].name} · ${deck.title}`;$('#rTitle').textContent=r.title;$('#rSub').textContent=note;
  $('#rStats').innerHTML=(r.stats||[]).map(([l,v])=>`<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('');
  $('#rWrong').innerHTML=WRONG.length?`<h2 style="margin-top:8px">Cards to review</h2><ul class="wl">${WRONG.map(c=>`<li><span>${esc(c.t)} → <em>${esc(c.d)}</em></span></li>`).join('')}</ul>`:(r.total?'<p class="hint" style="font-size:16px">No missed cards. Perfect!</p>':'');
  $('#rFlash').classList.toggle('hide',!WRONG.length);show('vResult','games');
}
$('#rAgain').addEventListener('click',()=>start(LAST.k,LAST.deck,LAST.opts,LAST.cards));
$('#rFlash').addEventListener('click',()=>start('flash',CUR,{...LAST.opts,weak:false},WRONG.slice()));
$('#rOther').addEventListener('click',()=>{SET.deck=CUR.id;go('games')});
$('#rDeck').addEventListener('click',()=>openDeck(CUR.id));

/* ---------- packs and character collection ---------- */
const RAR={c:{n:'Common',col:'#8f9b96',w:60,dup:5},r:{n:'Rare',col:'#2f74e0',w:28,dup:15},e:{n:'Epic',col:'#8b5cf6',w:9,dup:40},l:{n:'Legendary',col:'#e0a800',w:3,dup:120}};
const PACKS=[{id:'forest',name:'Grove Basket',price:60,col:'#2f8f4e',col2:'#1d6b37'},{id:'sea',name:'Tide Chest',price:60,col:'#1f7fc4',col2:'#145d93'},{id:'space',name:'Star Crate',price:80,col:'#2a2f6b',col2:'#141739'}];
const PK=Object.fromEntries(PACKS.map(p=>[p.id,p]));
const CHARS=[
 {id:'squirrel',p:'forest',r:'c',name:'Squirrel',col:'#c27a3a',b:'tri',e:'point',m:'nose',x:['tail','belly','muzzle']},
 {id:'bunny',p:'forest',r:'c',name:'Bunny',col:'#efe7dc',b:'round',e:'long',m:'nose',x:['cheek','muzzle']},
 {id:'hedgehog',p:'forest',r:'c',name:'Hedgehog',col:'#a07856',b:'round',e:'none',m:'nose',x:['spikes','muzzle','belly']},
 {id:'bear',p:'forest',r:'c',name:'Bear',col:'#8a5a3c',b:'round',e:'round',m:'nose',x:['muzzle','belly']},
 {id:'raccoon',p:'forest',r:'r',name:'Raccoon',col:'#868892',b:'round',e:'round',m:'nose',x:['tail','mask','belly']},
 {id:'fox',p:'forest',r:'r',name:'Fox',col:'#f07a2b',b:'tri',e:'point',m:'nose',x:['tail','belly','muzzle']},
 {id:'owl',p:'forest',r:'r',name:'Owl',col:'#8b5e3c',b:'tri',e:'tuft',eye:'big',m:'beak',x:['wings','belly']},
 {id:'deer',p:'forest',r:'e',name:'Spotted Deer',col:'#c98d5a',b:'tri',e:'antler',m:'nose',x:['spots','muzzle','cheek']},
 {id:'spirit',p:'forest',r:'l',name:'Forest Spirit',col:'#3fbf6f',b:'tri',e:'leaf',eye:'big',m:'smile',x:['aura','sparkle','cheek']},
 {id:'fish',p:'sea',r:'c',name:'Orange Fish',col:'#ff8a3d',b:'round',e:'fin',m:'smile',x:['fins','belly']},
 {id:'crab',p:'sea',r:'c',name:'Crab',col:'#e9503f',b:'round',e:'antenna',m:'smile',x:['claws']},
 {id:'jelly',p:'sea',r:'c',name:'Jellyfish',col:'#ff9ec1',b:'tent',e:'none',m:'smile',x:['cheek']},
 {id:'turtle',p:'sea',r:'c',name:'Sea Turtle',col:'#5aa86b',b:'round',e:'none',m:'smile',x:['shell']},
 {id:'octo',p:'sea',r:'r',name:'Octopus',col:'#a35de5',b:'tent',e:'none',eye:'big',m:'none',x:['cheek']},
 {id:'penguin',p:'sea',r:'r',name:'Penguin',col:'#26303d',b:'tri',e:'none',m:'beak',x:['wings','belly','faceW']},
 {id:'shark',p:'sea',r:'r',name:'Shark',col:'#6c8ea8',b:'tri',e:'fin',m:'teeth',x:['fins','belly']},
 {id:'whale',p:'sea',r:'e',name:'Whale',col:'#2f74e0',b:'round',e:'none',m:'smile',x:['belly','spout','cheek']},
 {id:'seadragon',p:'sea',r:'l',name:'Deep Sea Dragon',col:'#13b5c9',b:'tri',e:'horn',eye:'big',m:'teeth',x:['aura','fins','sparkle']},
 {id:'alien',p:'space',r:'c',name:'Alien',col:'#7bd66b',b:'tri',e:'antenna',eye:'three',m:'smile',x:[]},
 {id:'robot',p:'space',r:'c',name:'Robot',col:'#9aa6b2',b:'tri',e:'ant1',eye:'visor',m:'none',x:['bolt']},
 {id:'moonbunny',p:'space',r:'c',name:'Moon Bunny',col:'#e3defa',b:'round',e:'long',m:'nose',x:['cheek','muzzle']},
 {id:'comet',p:'space',r:'c',name:'Comet',col:'#f2b632',b:'tri',e:'none',m:'smile',x:['sparkle','cheek','belly']},
 {id:'spacecat',p:'space',r:'r',name:'Space Cat',col:'#3b4290',b:'tri',e:'point',eye:'big',m:'nose',x:['whisker','helmet']},
 {id:'ufo',p:'space',r:'r',name:'UFO Octopus',col:'#55d6be',b:'tent',e:'ant1',eye:'three',m:'none',x:[]},
 {id:'planetbear',p:'space',r:'r',name:'Saturn Bear',col:'#ff9e6b',b:'round',e:'round',m:'nose',x:['muzzle','ring']},
 {id:'galaxyowl',p:'space',r:'e',name:'Galaxy Owl',col:'#5a3d8a',b:'tri',e:'tuft',eye:'big',m:'beak',x:['wings','belly','sparkle']},
 {id:'phoenix',p:'space',r:'l',name:'Galaxy Phoenix',col:'#ff5d4a',b:'tri',e:'flame',eye:'big',m:'beak',x:['aura','wings','sparkle']},
];
const CH=Object.fromEntries(CHARS.map(x=>[x.id,x]));
const star4=(x,y,s,f)=>`<path d="M${x} ${y-s}Q${x} ${y} ${x+s} ${y}Q${x} ${y} ${x} ${y+s}Q${x} ${y} ${x-s} ${y}Q${x} ${y} ${x} ${y-s}Z" fill="${f}"/>`;
function charSVG(d,acc){const c=d.col,dk=dark(c,.24),bl='#fff8ec',X=k=>d.x.includes(k),tent=d.b==='tent',hy=tent?24:22,hr=tent?17:14;let s='';
  if(X('aura'))s+=`<circle cx="30" cy="32" r="31" fill="#ffd76a" opacity=".22"/><circle cx="30" cy="32" r="24" fill="#ffd76a" opacity=".22"/>`;
  s+=`<ellipse cx="30" cy="62" rx="15" ry="2.5" fill="#000" opacity=".2"/>`;
  if(X('tail'))s+=`<ellipse cx="46" cy="46" rx="8" ry="11" fill="${dk}" transform="rotate(25 46 46)"/><ellipse cx="48" cy="40" rx="5" ry="6" fill="${X('mask')?'#3a3a40':c}"/>`;
  if(X('spikes')){let p='';for(let i=0;i<=16;i++){const a=Math.PI*(.95+i/16*1.1),r=i%2?14:21;p+=`${30+Math.cos(a)*r},${hy+4+Math.sin(a)*r} `}s+=`<polygon points="${p}" fill="${dk}"/>`}
  s+=({round:`<circle cx="19" cy="11" r="5.5" fill="${dk}"/><circle cx="41" cy="11" r="5.5" fill="${dk}"/>`,
    point:`<path d="M17 17L19 3 28 10Z" fill="${c}"/><path d="M43 17L41 3 32 10Z" fill="${c}"/><path d="M19.5 13L20.5 7 25 10Z" fill="${dk}"/><path d="M40.5 13L39.5 7 35 10Z" fill="${dk}"/>`,
    long:`<ellipse cx="24" cy="4" rx="3.8" ry="11" fill="${c}"/><ellipse cx="36" cy="4" rx="3.8" ry="11" fill="${c}"/><ellipse cx="24" cy="5" rx="1.7" ry="7.5" fill="#ffb3c6"/><ellipse cx="36" cy="5" rx="1.7" ry="7.5" fill="#ffb3c6"/>`,
    tuft:`<path d="M18 13L16 3 25 9Z" fill="${dk}"/><path d="M42 13L44 3 35 9Z" fill="${dk}"/>`,
    antler:`<path d="M23 10L19 0M20.5 4L15 2M37 10L41 0M39.5 4L45 2" stroke="#8a5a2b" stroke-width="2.6" stroke-linecap="round" fill="none"/>`,
    antenna:`<path d="M25 10L21 1M35 10L39 1" stroke="${dk}" stroke-width="2.2"/><circle cx="21" cy="1" r="2.8" fill="#f2b632"/><circle cx="39" cy="1" r="2.8" fill="#f2b632"/>`,
    ant1:`<path d="M30 ${hy-hr}V-1" stroke="${dk}" stroke-width="2.2"/><circle cx="30" cy="-1" r="2.8" fill="#e9503f"/>`,
    fin:`<path d="M23 11L33 -2 37 11Z" fill="${dk}"/>`,
    leaf:`<path d="M20 12Q11 1 22 -2Q25 7 20 12Z" fill="#9be89a"/><path d="M40 12Q49 1 38 -2Q35 7 40 12Z" fill="#9be89a"/>`,
    horn:`<path d="M22 11L18 -1 27 8ZM38 11L42 -1 33 8Z" fill="#f2d16b"/>`,
    flame:`<path d="M23 11Q24 0 30 -3Q29 4 33 1Q39 5 37 11Z" fill="#f2b632"/><path d="M27 11Q28 4 31 2Q31 7 34 6Q35 9 34 11Z" fill="#ffe08a"/>`}[d.e]||'');
  if(X('wings'))s+=`<path d="M15 40L4 32 12 48Z" fill="${dk}"/><path d="M45 40L56 32 48 48Z" fill="${dk}"/>`;
  if(X('fins'))s+=`<path d="M15 44L7 40 12 52Z" fill="${dk}"/><path d="M45 44L53 40 48 52Z" fill="${dk}"/>`;
  if(X('claws'))s+=`<path d="M14 44L8 40" stroke="${c}" stroke-width="4"/><path d="M46 44L52 40" stroke="${c}" stroke-width="4"/><path d="M3 35a5 5 0 1 0 8 0l-4 3z" fill="${c}"/><path d="M57 35a5 5 0 1 1-8 0l4 3z" fill="${c}"/>`;
  if(d.b==='tri')s+=`<path d="M30 26L47 58 13 58Z" fill="${c}"/>`;
  else if(d.b==='round')s+=`<path d="M13 58Q13 30 30 30Q47 30 47 58Z" fill="${c}"/>`;
  else s+=[14,22,30,38,46].map((x,i)=>`<path d="M${x} 34q${i%2?3:-3} 8 0 14q${i%2?-3:3} 6 ${i<2?-1:1} 10" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('');
  if(X('belly'))s+=d.b==='tri'?`<path d="M30 36L40 56 20 56Z" fill="${bl}"/>`:`<ellipse cx="30" cy="48" rx="10" ry="8.5" fill="${bl}"/>`;
  if(X('spots'))s+=`<circle cx="25" cy="46" r="1.8" fill="#fff"/><circle cx="34" cy="42" r="1.8" fill="#fff"/><circle cx="33" cy="52" r="1.8" fill="#fff"/>`;
  if(X('shell'))s+=`<path d="M17 56Q17 36 30 36Q43 36 43 56Z" fill="${dk}"/><path d="M30 39v17M21 47h18M24 41l12 13M36 41L24 54" stroke="${c}" stroke-width="1.6"/>`;
  if(X('bolt'))s+=`<rect x="24" y="40" width="12" height="9" rx="2" fill="${dk}"/><circle cx="27" cy="44.5" r="1.4" fill="#7bf0ff"/><circle cx="33" cy="44.5" r="1.4" fill="#f2b632"/>`;
  s+=`<circle cx="30" cy="${hy}" r="${hr}" fill="${c}"/>`;
  if(X('faceW'))s+=`<ellipse cx="30" cy="${hy+2}" rx="10" ry="9" fill="#fff"/>`;
  if(X('mask'))s+=`<path d="M17 ${hy-3}Q30 ${hy-9} 43 ${hy-3}Q43 ${hy+3} 36 ${hy+1}Q30 ${hy-2} 24 ${hy+1}Q17 ${hy+3} 17 ${hy-3}Z" fill="#3a3a40"/>`;
  if(X('muzzle'))s+=`<ellipse cx="30" cy="${hy+5}" rx="6.5" ry="4.5" fill="${bl}"/>`;
  const ey=hy-2,eyeD=X('mask')||X('faceW')?'#1b1b1b':'#1b1b1b';
  s+=({big:`<circle cx="24.5" cy="${ey}" r="5" fill="#fff"/><circle cx="35.5" cy="${ey}" r="5" fill="#fff"/><circle cx="25" cy="${ey+.5}" r="2.6" fill="#1b1b1b"/><circle cx="36" cy="${ey+.5}" r="2.6" fill="#1b1b1b"/><circle cx="26" cy="${ey-.6}" r=".9" fill="#fff"/><circle cx="37" cy="${ey-.6}" r=".9" fill="#fff"/>`,
    three:`<circle cx="22.5" cy="${ey}" r="3.6" fill="#fff"/><circle cx="30" cy="${ey-4}" r="3.6" fill="#fff"/><circle cx="37.5" cy="${ey}" r="3.6" fill="#fff"/><circle cx="22.5" cy="${ey}" r="1.8" fill="#1b1b1b"/><circle cx="30" cy="${ey-4}" r="1.8" fill="#1b1b1b"/><circle cx="37.5" cy="${ey}" r="1.8" fill="#1b1b1b"/>`,
    visor:`<rect x="18.5" y="${ey-5}" width="23" height="10" rx="5" fill="#1b2a3a"/><circle cx="25" cy="${ey}" r="2.2" fill="#7bf0ff"/><circle cx="35" cy="${ey}" r="2.2" fill="#7bf0ff"/>`}[d.eye]||`<circle cx="25" cy="${ey}" r="2.4" fill="${eyeD}"/><circle cx="35" cy="${ey}" r="2.4" fill="${eyeD}"/><circle cx="25.7" cy="${ey-.8}" r=".7" fill="#fff"/><circle cx="35.7" cy="${ey-.8}" r=".7" fill="#fff"/>`);
  const my=hy+4;
  s+=({beak:`<path d="M27 ${my-1}L33 ${my-1} 30 ${my+4}Z" fill="#f2b632"/>`,nose:`<path d="M28.3 ${my}h3.4L30 ${my+2}Z" fill="#3a2a22"/><path d="M27.5 ${my+3}q2.5 2 5 0" stroke="#3a2a22" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
    smile:`<path d="M26 ${my+1}q4 3.5 8 0" stroke="#1b1b1b" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,teeth:`<path d="M24 ${my+1}h12l-2 3-2-3-2 3-2-3-2 3z" fill="#fff" stroke="#1b1b1b" stroke-width=".8"/>`}[d.m]||'');
  if(X('whisker'))s+=`<path d="M22 ${my+1}h-7M22 ${my+3}l-6 2M38 ${my+1}h7M38 ${my+3}l6 2" stroke="#d8dcff" stroke-width="1" stroke-linecap="round"/>`;
  if(X('cheek'))s+=`<circle cx="21" cy="${hy+3}" r="2.4" fill="#ff8fa3" opacity=".7"/><circle cx="39" cy="${hy+3}" r="2.4" fill="#ff8fa3" opacity=".7"/>`;
  if(X('helmet'))s+=`<circle cx="30" cy="${hy}" r="18" fill="rgba(190,230,255,.22)" stroke="#bfe6ff" stroke-width="1.6"/><path d="M19 ${hy-8}a13 13 0 0 1 8-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`;
  if(X('ring'))s+=`<ellipse cx="30" cy="${hy+2}" rx="23" ry="5" fill="none" stroke="#f2d16b" stroke-width="2.6" transform="rotate(-14 30 ${hy+2})"/>`;
  if(X('spout'))s+=`<path d="M30 ${hy-hr}q-1-5 -6-8M30 ${hy-hr}q1-5 6-8M30 ${hy-hr}v-8" stroke="#7fd1ff" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if(X('sparkle'))s+=star4(7,12,4,'#ffe08a')+star4(53,16,3,'#ffffff')+star4(52,48,3.5,'#ffe08a');
  return `<svg viewBox="0 -4 60 68" aria-hidden="true">${s}${acc&&ACC[acc]&&!tent?ACC[acc]:''}</svg>`;
}
function packArt(p){return `<svg viewBox="0 0 120 160" aria-hidden="true"><defs><linearGradient id="pg-${p.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.col}"/><stop offset="1" stop-color="${p.col2}"/></linearGradient></defs><rect x="4" y="4" width="112" height="152" rx="14" fill="url(#pg-${p.id})"/><path d="M4 18h112M4 142h112" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 4"/><path d="M-10 120L90 -10H120L10 150Z" fill="#fff" opacity=".1"/><circle cx="60" cy="74" r="34" fill="#fff" opacity=".14"/><g transform="translate(30 42) scale(1)" opacity=".95">${charSVG(CHARS.find(x=>x.p===p.id&&x.r==='l')).replace('<svg viewBox="0 -4 60 68" aria-hidden="true">','<svg viewBox="0 -4 60 68" width="60" height="68" style="filter:brightness(0)" opacity=".55">')}</g><text x="60" y="132" text-anchor="middle" font-family="Black Han Sans,Noto Sans KR,sans-serif" font-size="17" fill="#fff">${p.name}</text></svg>`}
function rollPack(pid){const v=R.inv;v.pity=+v.pity||0;let r;const x=Math.random()*100;r=x<3?'l':x<12?'e':x<40?'r':'c';
  if(v.pity>=9&&(r==='c'||r==='r'))r='e';v.pity=(r==='e'||r==='l')?0:v.pity+1;
  const pool=CHARS.filter(ch=>ch.p===pid&&ch.r===r);return pool[rnd(pool.length)]}
function openPack(pid){wallet();const p=PK[pid],v=R.inv;if(R.coins<p.price)return;SFX.init();
  addCoins(-p.price,'Pack: '+p.name);const ch=rollPack(pid);v.chars=v.chars&&typeof v.chars==='object'?v.chars:{};const isNew=!v.chars[ch.id];v.chars[ch.id]=(v.chars[ch.id]||0)+1;
  const ref=isNew?0:RAR[ch.r].dup;if(ref)addCoins(ref,'Duplicate: '+ch.name);R.wt=Date.now();saveRec();renderCoin();
  const ov=$('#packOv'),pin=$('#packIn');ov.classList.remove('hide');document.body.style.overflow='hidden';
  pin.innerHTML=`<div class="pshake" id="pshake">${packArt(p)}</div><p class="ptap">Tap to open</p>`;SFX.play('flip');
  let done=false;const reveal=()=>{if(done)return;done=true;const rr=RAR[ch.r];
    pin.innerHTML=`<div class="reveal r-${ch.r}"><div class="rays"></div><div class="rcard" style="--rc:${rr.col}"><span class="rtag">${rr.n}</span><div class="rpic">${charSVG(ch)}</div><b>${ch.name}</b><span class="rpack">${p.name}</span><p class="rnew">${isNew?'New character!':`Already have it → <i class="cico"></i> +${ref} back`}</p></div>
    <div class="row center"><button class="btn" id="pAgain" ${R.coins<p.price?'disabled':''}>Again · <i class="cico"></i> ${p.price}</button>${isNew?`<button class="btn ghost" id="pEquip">Make main</button>`:''}<button class="btn ghost" id="pClose">Close</button></div></div>`;
    ({c:()=>SFX.play('good'),r:()=>{SFX.play('combo',5)},e:()=>{SFX.play('win');FX.confetti(70)},l:()=>{SFX.play('win');setTimeout(()=>SFX.play('win'),450);FX.confetti(180)}})[ch.r]();
    const q=elC($('.rpic'));FX.burst(q.x,q.y,ch.r==='c'?14:30);
    $('#pAgain').onclick=e=>{e.stopPropagation();openPack(pid)};$('#pClose').onclick=e=>{e.stopPropagation();closePack()};
    if(isNew)$('#pEquip').onclick=e=>{e.stopPropagation();v.avatar=ch.id;R.wt=Date.now();saveRec();setMascot();closePack()}};
  pin.onclick=()=>{if(!done){const ps=$('#pshake');if(ps)ps.classList.add('popen');SFX.play('boom');setTimeout(reveal,260)}};
  setTimeout(()=>{if(!done&&$('#pshake')){$('#pshake').classList.add('popen');SFX.play('boom');setTimeout(reveal,260)}},2200);
}
function closePack(){$('#packOv').classList.add('hide');document.body.style.overflow='';renderPacks()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#packOv').classList.contains('hide'))closePack()});
function renderPacks(){wallet();const v=R.inv;v.chars=v.chars&&typeof v.chars==='object'?v.chars:{};
  $('#pkCoins').textContent=fmt(R.coins);
  $('#packList').innerHTML=PACKS.map(p=>{const own=CHARS.filter(x=>x.p===p.id&&v.chars[x.id]).length;return `<div class="pack"><div class="part">${packArt(p)}</div><div class="pinfo"><b>${p.name}</b><span class="hint" style="margin:0">Collected ${own} / 9</span><button class="btn" data-pack="${p.id}" ${R.coins<p.price?'disabled':''}>Open · <i class="cico"></i> ${p.price}</button>${R.coins<p.price?`<span class="hint" style="margin:0">Need ${fmt(p.price-R.coins)} more</span>`:''}</div></div>`}).join('');
  $('#pity').textContent=`Epic or better guaranteed within ${10-(+v.pity||0)}`;
  const total=CHARS.filter(x=>v.chars[x.id]).length;$('#dexCount').textContent=`${total} / ${CHARS.length} collected`;
  const cell=(id,d,own,cnt)=>`<button class="dcell ${own?'own':''} ${v.avatar===id||(!v.avatar&&id==='bird')?'av':''}" ${own?`data-av="${id}"`:'disabled'} style="--rc:${d?RAR[d.r].col:'var(--gold)'}"><span class="dpic">${id==='bird'?mascotSVG(v.equip.c,'a-none'):own?charSVG(d):charSVG(d).replace('aria-hidden="true">','aria-hidden="true" class="sil">')}</span><b>${own?(d?d.name:'Rocket Bird'):'???'}</b><small>${d?RAR[d.r].n:'Starter'}${cnt>1?` · ×${cnt}`:''}</small></button>`;
  $('#dex').innerHTML=`<h3>Starter</h3><div class="dgrid">${cell('bird',null,true,1)}</div>`+PACKS.map(p=>`<h3>${p.name} <span class="hint">${CHARS.filter(x=>x.p===p.id&&v.chars[x.id]).length} / 9</span></h3><div class="dgrid">${CHARS.filter(x=>x.p===p.id).map(d=>cell(d.id,d,!!v.chars[d.id],v.chars[d.id]||0)).join('')}</div>`).join('');
}
$('#vPacks').addEventListener('click',e=>{const b=e.target.closest('[data-pack]');if(b)return openPack(b.dataset.pack);const a=e.target.closest('[data-av]');if(a){R.inv.avatar=a.dataset.av==='bird'?null:a.dataset.av;R.wt=Date.now();saveRec();setMascot();SFX.init();SFX.play('flip');Mascot.say&&0;renderPacks()}});

/* ---------- shop ---------- */
let PREV=null;
function renderShop(){wallet();const v=R.inv;
  $('#shPrev').innerHTML=mascotSVG(PREV&&PREV.t==='c'?PREV.id:null,PREV&&PREV.t==='a'?PREV.id:null);
  $('#shCoins').textContent=fmt(R.coins);$('#shInv').textContent=`Coin Booster: ${v.boost} games left · Streak Savers: ${v.shield}`;
  const card=s=>{const own=v.owned.includes(s.id),eq=v.equip[s.t]===s.id,can=R.coins>=s.price;let btn;
    if(s.t==='i'){const full=s.id==='i-shield'&&v.shield>=3;btn=`<button class="btn sm" data-buy="${s.id}" ${!can||full?'disabled':''}>${full?'Max':`<i class="cico"></i> ${s.price}`}</button>`}
    else if(eq)btn='<button class="btn ghost sm" disabled>Wearing</button>';else if(own)btn=`<button class="btn sm" data-equip="${s.id}">Wear</button>`;
    else btn=`<button class="btn sm" data-buy="${s.id}" ${can?'':'disabled'}><i class="cico"></i> ${s.price}</button>${can?'':`<span class="hint" style="margin:0">Need ${fmt(s.price-R.coins)} more</span>`}`;
    const pic=s.t==='i'?(s.id==='i-boost'?'<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="20" fill="#f2b632" stroke="#b97c06" stroke-width="3"/><text x="30" y="37" text-anchor="middle" font-family="Black Han Sans,sans-serif" font-size="20" fill="#7a5000">×2</text></svg>':'<svg viewBox="0 0 60 60"><path d="M30 8l18 7v14c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="#2f74e0"/><path d="M22 30l6 6 11-12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'):mascotSVG(s.t==='c'?s.id:null,s.t==='a'?s.id:null);
    return `<div class="sitem ${eq?'eq':''}" data-prev="${s.id}"><div class="sp">${pic}</div><b>${s.name}</b>${s.desc?`<span class="hint" style="margin:0">${s.desc}</span>`:''}${btn}</div>`};
  $('#shC').innerHTML=SHOP.filter(s=>s.t==='c').map(card).join('');$('#shA').innerHTML=SHOP.filter(s=>s.t==='a').map(card).join('');$('#shI').innerHTML=SHOP.filter(s=>s.t==='i').map(card).join('');
}
$('#vShop').addEventListener('click',e=>{const b=e.target.closest('[data-buy],[data-equip]');const it=e.target.closest('[data-prev]');
  if(!b){if(it&&SI[it.dataset.prev].t!=='i'){PREV=SI[it.dataset.prev];renderShop()}return}
  SFX.init();const v=R.inv;
  if(b.dataset.equip){const s=SI[b.dataset.equip];v.equip[s.t]=s.id;R.wt=Date.now();PREV=null;SFX.play('flip');saveRec();setMascot();renderShop();return}
  const s=SI[b.dataset.buy];if(!s||R.coins<s.price)return;
  addCoins(-s.price,'Shop: '+s.name);if(s.t==='i'){if(s.id==='i-boost')v.boost+=3;else v.shield=Math.min(3,v.shield+1)}else{v.owned.push(s.id);v.equip[s.t]=s.id;PREV=null}
  SFX.play('buy');const p=elC(b);FX.burst(p.x,p.y);saveRec();setMascot();renderCoin();renderShop()});

/* ---------- records ---------- */
function renderStats(){
  const acc=R.tot.ans?Math.round(R.tot.right/R.tot.ans*100)+'%':'—';
  $('#stTiles').innerHTML=[['Coins',fmt(R.coins)],['Streak',(n=>n+(n===1?' day':' days'))(streakDays())],['Games played',fmt(R.tot.games)],['Questions answered',fmt(R.tot.ans)],['Accuracy',acc]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('#stHist').innerHTML=R.hist.length?R.hist.map(h=>`<li><span><b>${esc(GM[h.g]?GM[h.g].name:h.g)}</b> · ${esc(h.t)}<br><span class="hint">${esc(h.s)}</span></span><small>${ago(h.at)}</small></li>`).join(''):'<li class="hint">No games played yet.</li>';
  $('#stLedger').innerHTML=R.ledger.length?R.ledger.slice(0,20).map(x=>`<li><span>${esc(x.why)}<br><small>${ago(x.at)}</small></span><b class="${x.n<0?'noc':'okc'}">${x.n>0?'+':''}${fmt(x.n)}</b></li>`).join(''):'<li class="hint">No coin history yet.</li>';
  const ds=allDecks(),cur=$('#stDeck').value||(R.hist[0]&&findDeck(R.hist[0].d)?R.hist[0].d:ds[0].id);
  $('#stDeck').innerHTML=ds.map(d=>`<option value="${esc(d.id)}">${esc(d.title)}</option>`).join('');$('#stDeck').value=findDeck(cur)?cur:ds[0].id;
  statDeck();renderLb();
}
function statDeck(){
  const d=findDeck($('#stDeck').value);if(!d)return;
  const rs=Object.keys(RECDEF).map(k=>[k,R.data[d.id+':'+k]]).filter(x=>x[1]!=null);
  $('#stRecs').innerHTML=rs.length?rs.map(([k,v])=>`<div><span>${RECDEF[k].n}</span><b>${RECDEF[k].f(v)}</b></div>`).join(''):'<div><span>No records with this deck yet</span></div>';
  const wk=weakList(d,10);
  $('#stWeak').innerHTML=wk.length?wk.map(x=>`<li><span>${esc(x.c.t)} → <em>${esc(x.c.d)}</em></span><small>${x.n}×</small></li>`).join(''):'<li class="hint">No missed cards yet.</li>';
  $('#stPractice').classList.toggle('hide',!wk.length);$('#stPractice').onclick=()=>start('flash',d,{dir:'f',weak:false},wk.map(x=>x.c));
}
$('#stDeck').addEventListener('change',statDeck);

/* ---------- shared clicks ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-go],[data-open],[data-quick],[data-game],[data-setup],.ntab');if(!t)return;
  if(t.classList.contains('ntab')||t.dataset.go){e.preventDefault();go(t.dataset.tab||t.dataset.go);return}
  if(t.dataset.open)return openDeck(t.dataset.open);
  if(t.dataset.quick)return openSetup(last.game&&GM[last.game]?last.game:'gr',t.dataset.quick);
  if(t.dataset.setup)return openSetup(t.dataset.setup,t.dataset.deck);
  if(t.dataset.game){last.game=t.dataset.game;lset('sa-last',last);return openSetup(t.dataset.game,t.dataset.deck)}
});
$('#logo').addEventListener('click',()=>go('home'));
$('#coinChip').addEventListener('click',()=>go('shop'));
$('#navNew').addEventListener('click',()=>openEditor(null));
$('#newDeck').addEventListener('click',()=>openEditor(null));

function boot(){FX.init();if(!PCA)loadLocal();wallet();setMascot();renderCoin();const sb=$('#sound'),upd=()=>{sb.innerHTML=SFX.on?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';sb.setAttribute('aria-label',SFX.on?'Sound off':'Sound on')};upd();sb.onclick=()=>{SFX.on=!SFX.on;lset('sa-sound',SFX.on);SFX.init();upd();SFX.play('good')};setSync('local');route();setTimeout(initCloud,0)}
return{IMPL,boot,GM};
})();
