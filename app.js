/* Orbit 5K (voorheen Loopcoach): planning + review. Opmaak: app.css. tools/make_ics.js draait alles boven "tabs + start" ook in Node: daar geen document/DOM gebruiken.
   Schema: data/schema.json · trainingen, reviews en export-gewicht: data/log.json (bijgewerkt via de chat).
   Op het apparaat (localStorage): eigen gewicht, ochtendcheck (pijn, rusthartslag), calorieën. */

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const iso=d=>d.toLocaleDateString('sv-SE');
const parse=s=>new Date(s+'T12:00:00');
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const days=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const DK=['zo','ma','di','wo','do','vr','za'],DAY=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const MON=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'],MONTH=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const nice=s=>{const d=parse(s);return `${DK[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`};
const longDate=s=>{const d=parse(s);return `${DAY[d.getDay()][0].toUpperCase()+DAY[d.getDay()].slice(1)} ${d.getDate()} ${MONTH[d.getMonth()]}`};
const nl=(x,d=1)=>x==null||isNaN(x)?'–':Number(x).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d});
const int=x=>x==null||isNaN(x)?'–':Math.round(x).toLocaleString('nl-NL');
const mmss=m=>{if(m==null||isNaN(m))return '–';const s=Math.round(m*60);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const num=v=>{if(v==null||v==='')return null;const x=parseFloat(String(v).replace(',','.'));return isNaN(x)?null:x};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&iso(parse(s))===s;
const weekStart=d=>addDays(d,-((parse(d).getDay()+6)%7));
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600)}
// ?today=2026-10-08 om een datum te testen (alleen lokaal)
const qToday=location.hostname==='localhost'?new URLSearchParams(location.search).get('today'):null;
let TODAY=validDate(qToday)?qToday:iso(new Date());

/* ---------- data ---------- */
let SCHEMA=null,LOG=null;
const LKEY='lc-local';
const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
let LOC=(()=>{try{const o=JSON.parse(localStorage.getItem(LKEY));return isObj(o)?o:{}}catch(e){return {}}})();
if(!isObj(LOC.weights))LOC.weights={};if(!isObj(LOC.morning))LOC.morning={};
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify(LOC));return true}catch(e){toast('Opslaan op dit apparaat mislukt');return false}}
const SET=()=>LOG.settings||{};
const NUT=()=>SCHEMA.config.nutrition||{};
const kcalState=()=>{const d={kcal:NUT().kcalStart||2500,setAt:SET().refDate||SCHEMA.config.startDate},k=isObj(LOC.kcal)?LOC.kcal:{};
  return {kcal:num(k.kcal)>=1000?Math.round(num(k.kcal)):d.kcal,setAt:validDate(k.setAt)?k.setAt:d.setAt}};

// Gewicht: eigen invoer + export. Beide op dezelfde dag en verschillend → middenweg.
function weights(){
  const m=new Map();
  const ok=kg=>Number.isFinite(kg)&&kg>40&&kg<250;
  for(const w of LOG.weights||[]){const kg=Number(w?.kg);if(validDate(w?.date)&&ok(kg)) m.set(w.date,{date:w.date,kg,exp:kg,src:'export'})}
  for(const [d,v] of Object.entries(LOC.weights)){ const kg=Number(v); if(!validDate(d)||!ok(kg))continue; const e=m.get(d);
    if(e){e.app=kg;if(Math.abs(e.exp-kg)>=0.05){e.kg=Math.round((e.exp+kg)/2*10)/10;e.src='middenweg'}else e.src='beide'} else m.set(d,{date:d,kg,app:kg,src:'app'}) }
  return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
const sessionsAll=()=>(LOG.sessions||[]).filter(s=>validDate(s.date)).sort((a,b)=>a.date.localeCompare(b.date));
const sessionOn=d=>(LOG.sessions||[]).find(s=>s.date===d);

/* ---------- schema ---------- */
const NW=()=>SCHEMA.weeks.length;
const clampW=w=>Math.min(Math.max(Math.round(w)||1,1),NW());
const weekOf=w=>SCHEMA.weeks[clampW(w)-1];
const phaseNr=w=>weekOf(w).phase;
const secTxt=s=>s%60?mmss(s/60):`${s/60} min`;
const minTxt=m=>m%1?`${mmss(m)} min`:`${m} min`;
function sessText(s){
  let t;
  if(s.format==='distance-intervals') t=`${s.reps} × ${s.jogMeters} m joggen, ${s.walkMetersBetween} m wandelen ertussen (${int(s.totalJogMeters)} m jog)`;
  else if(s.format==='time-intervals'&&s.blocks) t=s.blocks.map(b=>b.reps>1?`${b.reps} × ${secTxt(b.jogSec)} jog${b.walkSec?` / ${secTxt(b.walkSec)} wandelen`:''}`:`${secTxt(b.jogSec)} jog${b.walkSec?` + ${secTxt(b.walkSec)} wandelen`:''}`).join(' + ');
  else if(s.format==='time-intervals') t=`jog ${minTxt(s.jogMin)} in blokken van ${String(s.blockSec||'60-120').split('-').map(x=>x/60).join('–')} min`;
  else t=`${minTxt(s.jogMin)} aan één stuk joggen`;
  return `${t} · ${s.warmupWalkMin} min in- en ${s.cooldownWalkMin} min uitwandelen`;
}
function planFor(w,dow){ // dow: 0 zo .. 6 za
  const wk=weekOf(w),d=wk.days[DK[dow]],rec=wk.recoveryWeek?' (herstel)':'';
  if(d.type==='jog') return {kind:'jog',title:`Jog-sessie${d.name?' (licht)':''} · week ${clampW(w)}${rec}`,text:sessText(d.session),rules:true,day:d};
  if(d.type==='test') return {kind:'test',title:`Test · week ${clampW(w)}`,rules:true,day:d,
    text:(d.test.distanceKm?`${d.test.distanceKm} km aan één stuk joggen. `:`${sessText(d.test.session)}. `)+(d.rule||'').replace(/max HR <=/,'max hartslag ≤').replace(/^./,c=>c.toUpperCase())+'.'};
  if(d.type==='walk') return {kind:'walk',title:d.name,text:`${d.min} min wandelen in ${d.hrZone}. Geen jogs.`,day:d};
  return {kind:'rest',title:'Rustdag',text:'Geen training gepland.',day:d};
}
const isJog=s=>!!s&&(s.kind==='jog'||s.kind==='test');

/* ---------- dartswedstrijden (Pirates 7): trainingen eromheen plannen ---------- */
const DARTS_URL='https://basvanderlit1-commits.github.io/dv-the-pirates/pirates-7/pirates7.ics';
let DARTS={}; // 'JJJJ-MM-DD' → {summary, time}
function parseIcs(txt){
  const out={},lines=String(txt).replace(/\r?\n[ \t]/g,'').split(/\r?\n/);
  let ev=null;
  for(const l of lines){
    if(l==='BEGIN:VEVENT') ev={};
    else if(l==='END:VEVENT'){ if(ev?.date) out[ev.date]={summary:ev.summary||'Dartwedstrijd',time:ev.time||''}; ev=null }
    else if(ev&&l.startsWith('DTSTART')){const m=l.match(/:(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);if(m){ev.date=`${m[1]}-${m[2]}-${m[3]}`;if(m[4])ev.time=`${m[4]}:${m[5]}`}}
    else if(ev&&l.startsWith('SUMMARY')) ev.summary=l.slice(l.indexOf(':')+1).replace(/\\([,;\\])/g,'$1').replace(/\\n/g,' ');
  }
  return out;
}
async function loadDarts(){
  try{const r=await fetch(DARTS_URL,{cache:'no-cache'});if(!r.ok)throw 0;const t=await r.text();DARTS=parseIcs(t);try{localStorage.setItem('lc-darts',t)}catch(_){}}
  catch(_){try{DARTS=parseIcs(localStorage.getItem('lc-darts')||'')}catch(e){DARTS={}}} // offline: laatst bekende schema
}
// Weekindeling na verschuiven: een training op een wedstrijddag gaat naar een vrije rustdag in dezelfde week
// (bij jogs liefst niet direct naast een andere jog). Geen vrije dag: wandeling vervalt, jog ruilt met een wandeldag.
const LAYOUT=new Map();
function layoutWeek(ws,pw){
  const key=ws+'|'+pw+'|'+Object.keys(DARTS).length;
  if(LAYOUT.has(key))return LAYOUT.get(key);
  const wk=weekOf(pw),type=d=>wk.days[DK[d.src]].type,restDow=[3,5,0,1,2,4,6].find(x=>wk.days[DK[x]].type==='rest')??3;
  const L=[...Array(7)].map((_,i)=>{const date=addDays(ws,i);return {date,src:(i+1)%7,match:DARTS[date]||null}});
  const jogAt=i=>i>=0&&i<7&&['jog','test'].includes(type(L[i]));
  const todo=L.map((d,i)=>i).filter(i=>L[i].match&&type(L[i])!=='rest').sort((a,b)=>jogAt(b)-jogAt(a)); // jogs eerst
  for(const i of todo){
    const jog=jogAt(i),free=t=>L.map((d,j)=>j).filter(j=>!L[j].match&&type(L[j])===t);
    const score=j=>(jog&&(jogAt(j-1)&&j-1!==i||jogAt(j+1)&&j+1!==i)?10:0)+Math.abs(j-i)-(j>i?0.1:0);
    let cand=free('rest').sort((a,b)=>score(a)-score(b))[0],dropped=null;
    if(cand==null&&jog){cand=free('walk').sort((a,b)=>score(a)-score(b))[0];if(cand!=null)dropped=wk.days[DK[L[cand].src]].name}
    if(cand!=null){L[cand].movedFrom=L[i].date;if(dropped)L[cand].replaced=dropped;L[i].movedTo=L[cand].date;L[cand].src=L[i].src}
    else L[i].dropped=wk.days[DK[L[i].src]].name||'training';
    L[i].src=restDow;
  }
  LAYOUT.set(key,L);return L;
}
const slotOn=d=>layoutWeek(weekStart(d),pwOn(d))[(parse(d).getDay()+6)%7];
function dayPlan(d){
  const w=pwOn(d),s=slotOn(d),pl={...planFor(w,s.src),w,src:s.src};
  if(s.match) return {...pl,kind:'rest',rules:false,darts:true,title:'Dartwedstrijd',
    text:`${s.match.summary}${s.match.time?' · '+s.match.time:''}. Geen training vandaag.`+(s.movedTo?` Je training staat op ${nice(s.movedTo)}.`:'')+(s.dropped?` De ${s.dropped.toLowerCase()} vervalt deze week.`:'')};
  if(s.movedFrom){pl.title+=` · verplaatst (darts ${nice(s.movedFrom)})`;pl.moved=s.movedFrom;if(s.replaced)pl.text+=` (In plaats van de ${s.replaced.toLowerCase()}.)`}
  return pl;
}
function purposeOn(d){const p=dayPlan(d);return p.darts?'Wedstrijdavond: geen training. Je benen rusten, en de training van deze dag is naar een vrije dag in dezelfde week geschoven.':purpose(p.w,p.src)}
function phaseRules(w){
  const p=phaseNr(w),r=[];
  if(p===1) r.push('Jogtempo 7:00–7:30 /km of langzamer, korte passen','Hartslag 170 → direct wandelen','Pas weer joggen onder 135');
  else if(p===2) r.push('Praattempo: je kunt hele zinnen zeggen','Hartslag 170 → wandelen','Langzamer mag altijd');
  else r.push('Gemiddelde hartslag ≤ 160','Bij 170: wandelen tot 150, dan verder','Praattempo');
  r.push('Pijn op de borst, duizelig of benauwd? Stop en neem contact op met je huisarts.');
  return r;
}
const REST_OPTIONS=['20–30 min rustig wandelen, hartslag onder 125 (zone 1)','10–15 min stretchen of mobiliteit: kuiten, hamstrings, heupen','20–30 min rustig fietsen zonder te hijgen','Gewoon je stappen halen: ~9.000 stappen verspreid over de dag'];
function purpose(w,dow){
  const wk=weekOf(w),d=wk.days[DK[dow]],f=(d.session||d.test?.session||{}).format,out=[];
  if(d.type==='test') out.push(`Testmoment van fase ${wk.phase}: laat zien of je klaar bent voor de volgende fase (${wk.phaseGoal}). Start rustig; lukt het niet, dan herhaal je de laatste 2 weken en test je opnieuw.`);
  else if(d.type==='jog'&&d.name) out.push('Extra lichte jog-sessie: vaker joggen oefenen met een kleine belasting.');
  else if(d.type==='jog'&&f==='distance-intervals') out.push('Korte jogs laten je pezen, botten en gewrichten wennen aan de schokken van joggen, terwijl je hartslag laag blijft. Het tempo is bewust traag; het wandelen ertussen is herstel, geen pauze.');
  else if(d.type==='jog'&&f==='time-intervals') out.push(`Je bouwt de jogblokken op in tijd, op weg naar ${wk.phaseGoal}. Jog zo rustig dat je hele zinnen kunt praten.`);
  else if(d.type==='jog') out.push(`Aan één stuk doorlopen in praattempo; elke week iets langer, op weg naar ${wk.phaseGoal}.`);
  else if(d.type==='walk'&&/Duur/.test(d.name)) out.push('Conditie en vetverbranding opbouwen in zone 2, zonder de belasting van joggen. Vlot doorwandelen (≥ 6 km/u).');
  else if(d.type==='walk'&&/Lange/.test(d.name)) out.push('Langer bewegen op lage intensiteit: uithoudingsvermogen en extra calorieën, zonder je benen te belasten.');
  else if(d.type==='walk') out.push('Actief herstel: rustig bewegen met een lage hartslag, zodat je fris bent voor de volgende jog-sessie.');
  else out.push('Rust hoort bij het plan: je lichaam wordt sterker tijdens herstel. Licht bewegen mag, maar niet joggen en geen zware inspanning.');
  if(wk.recoveryWeek&&d.type!=='rest') out.push('Herstelweek: minder belasting, zodat je lichaam de vorige weken kan verwerken.');
  return out.join(' ');
}

/* ---------- beoordeling ---------- */
function evalSession(s,w){
  if(!isJog(s))return null;
  const ph=phaseNr(w),out=[];
  if(s.pace!=null&&(ph===1||s.kind==='test')) out.push({ok:s.pace>=7,t:`tempo ${mmss(s.pace)} /km`});
  if(s.maxHr!=null) out.push({ok:s.maxHr<=170,t:`max HS ${int(s.maxHr)}`});
  if(s.avgHr!=null&&ph>=3) out.push({ok:s.avgHr<=160,t:`gem. HS ${int(s.avgHr)}`});
  if(s.talkTestOk!=null&&ph>=2) out.push({ok:!!s.talkTestOk,t:'praattest'});
  if(s.kind==='test'&&s.testPassed!=null) out.push({ok:!!s.testPassed,t:'test'});
  if(s.pain!=null) out.push({ok:s.pain<=3,t:`pijn ${int(s.pain)}/10`});
  return out;
}
const sessionOk=(s,w)=>{const e=evalSession(s,w);return !!e&&e.every(x=>x.ok)};
// Automatische punten: plan vs. resultaat
function checks(s,w){
  const pl=dayPlan(s.date),day=pl.day,ph=phaseNr(w),out=[],add=(ok,t)=>out.push({ok,t});
  if(pl.darts) add(null,'Gepland was een wedstrijddag (darts).');
  else if(pl.kind==='rest') add(null,'Gepland was een rustdag.');
  else if(isJog(pl)!==isJog(s)) add(false,`Gepland was: ${pl.title}.`);
  if(s.kind==='walk'&&day.type==='walk'){
    if(s.durMin!=null) add(s.durMin>=day.min*0.9,`Duur ${nl(s.durMin,0)} van ${day.min} min.`);
    const z=(day.hrZone||'').match(/(\d+)-(\d+)/),u=(day.hrZone||'').match(/<(\d+)/);
    if(s.avgHr!=null&&z) add(s.avgHr>=+z[1]&&s.avgHr<=+z[2],`Gem. hartslag ${int(s.avgHr)} (doel ${z[1]}–${z[2]}).`);
    if(s.avgHr!=null&&u) add(s.avgHr<+u[1],`Gem. hartslag ${int(s.avgHr)} (doel onder ${u[1]}).`);
    if(s.km!=null&&s.durMin&&/Duur/.test(day.name)){const v=s.km/(s.durMin/60);add(v>=6,`Tempo ${nl(v,1)} km/u (doel ≥ 6,0).`)}
  }
  if(isJog(s)){
    const ses=day.session||day.test?.session;
    if(s.pace!=null&&(ph===1||s.kind==='test')) add(s.pace>=7,`Jogtempo ${mmss(s.pace)} /km (plan 7:00–7:30).`);
    if(s.maxHr!=null) add(s.maxHr<=170,`Max hartslag ${int(s.maxHr)} (grens 170).`);
    if(s.avgHr!=null&&ph>=3) add(s.avgHr<=160,`Gem. hartslag ${int(s.avgHr)} (grens 160).`);
    if(ses?.format==='distance-intervals'&&s.jogCount!=null) add(s.jogCount>=ses.reps*0.9&&s.jogCount<=ses.reps*1.2,`${s.jogCount} jogs, gepland ${ses.reps}.`);
    if(ses?.format==='distance-intervals'&&s.jogMeters!=null) add(s.jogMeters<=ses.totalJogMeters*1.25,`${int(s.jogMeters)} m gejogd, gepland ${int(ses.totalJogMeters)} m.`);
    if(s.kind==='test'&&s.testPassed!=null) add(!!s.testPassed,s.testPassed?'Test gehaald.':'Test niet gehaald.');
  }
  if(s.pain!=null) add(s.pain<=3,`Pijn ${int(s.pain)}/10 (grens 3).`);
  return out;
}
const VERDICT={'goed':['p-good','✓ goed'],'binnen':['p-good','✓ binnen grenzen'],'te hard':['p-warn','! te hard'],'te licht':['p-warn','te licht'],'gemist':['p-bad','gemist'],'aangepast':['p-mute','aangepast']};
function verdictPill(s,w){
  if(s.verdict&&VERDICT[s.verdict]) return `<span class="pill ${VERDICT[s.verdict][0]}">${VERDICT[s.verdict][1]}</span>`;
  if(!isJog(s)) return '<span class="pill p-good">✓ gedaan</span>';
  const e=evalSession(s,w);return !e.length?'<span class="pill p-mute">geen data</span>':e.every(x=>x.ok)?'<span class="pill p-good">✓ binnen grenzen</span>':'<span class="pill p-warn">! te hard</span>';
}
function factsLine(s){
  return [s.durMin!=null?`${nl(s.durMin,0)} min`:'',s.km!=null?`${nl(s.km,2)} km`:'',s.avgHr!=null?`gem. HS ${int(s.avgHr)}`:'',s.maxHr!=null?`max ${int(s.maxHr)}`:'',
    s.pace!=null?`jog ${mmss(s.pace)} /km`:'',s.jogCount!=null?`${int(s.jogCount)} jogs`:'',s.jogMeters!=null?`${int(s.jogMeters)} m jog`:''].filter(Boolean).join(' · ');
}
// Per jog een staafje: hoogte = meters, kleur = piekhartslag (groen ≤165, geel ≤170, rood >170)
function jogBars(s){
  const J=(s.jogs||[]).filter(j=>j&&j.m>0);if(!J.length)return '';
  const W=300,H=64,bw=Math.max(1,Math.min(22,(W-4)/J.length-4)),mx=Math.max(...J.map(j=>j.m),60);
  const col=p=>p==null?'var(--plan)':p<=165?'var(--good)':p<=170?'var(--warn)':'var(--bad)';
  const bars=J.map((j,i)=>{const h=Math.max(3,j.m/mx*(H-16)),x=2+i*(bw+4);
    return `<rect x="${x.toFixed(1)}" y="${(H-12-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${col(j.hrPeak)}"><title>Jog ${i+1}: ${int(j.m)} m · ${mmss(j.paceMinKm)} /km · piek ${int(j.hrPeak)}</title></rect>`+
      (J.length<=14?`<text x="${(x+bw/2).toFixed(1)}" y="${H-2}" text-anchor="middle">${i+1}</text>`:'')}).join('');
  return `<svg class="jogbars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${J.length} jogs met afstand en piekhartslag">${bars}</svg>
   <div class="legend"><span><i style="background:var(--good)"></i>piek ≤ 165</span><span><i style="background:var(--warn)"></i>166–170</span><span><i style="background:var(--bad)"></i>&gt; 170</span><span>hoogte = meters</span></div>`;
}
function resultHtml(s,w){
  const c=checks(s,w);
  return `<div class="muted">${esc(factsLine(s))||'Geen meetgegevens.'}</div>${jogBars(s)}
   ${s.review?`<div class="banner ${s.verdict==='goed'||s.verdict==='binnen'?'b-good':s.verdict?'b-warn':'b-mute'}"><b>Review:</b> ${esc(s.review)}</div>`:'<div class="banner b-mute">Review volgt zodra je de data in de chat deelt.</div>'}
   ${c.length?`<ul class="steps">${c.map(x=>`<li>${x.ok===true?'✓':x.ok===false?'!':'·'} ${esc(x.t)}</li>`).join('')}</ul>`:''}
   ${s.stats?`<div class="muted">${esc(s.stats)}</div>`:''}`;
}

/* ---------- dynamisch schema: planweek per kalenderweek ---------- */
// Loopt alle weken af vanaf de start. Weken met data (t/m dataThrough) worden beoordeeld volgens config.progression;
// de lopende en toekomstige weken zijn een verwachting (elke week een stap verder).
let TL=null;
function evalWeek(ws,pw){
  const wk=weekOf(pw),inWeek=sessionsAll().filter(s=>s.date>=ws&&s.date<=addDays(ws,6));
  // Verplichte jog-dagen volgens de (eventueel rond darts verschoven) weekindeling: ma + do, vanaf week 17 ook za
  const L=layoutWeek(ws,pw),jd=L.filter(x=>['jog','test'].includes(wk.days[DK[x.src]].type));
  const done=x=>sessionOn(x.date)||(x.movedFrom&&sessionOn(x.movedFrom)); // toch op de wedstrijddag getraind telt ook
  const req=jd.map(done),test=jd.find(x=>wk.days[DK[x.src]].type==='test');
  if(!inWeek.length) return {to:Math.max(1,pw-2),label:'gemist → 2 terug',why:'Hele week gemist: 2 weken terug.'};
  if(wk.testWeek&&!(test&&isJog(done(test))&&sessionOk(done(test),pw))) return {to:Math.max(1,pw-1),label:'test niet gehaald',why:'Test niet gehaald: laatste 2 weken van de fase herhalen, dan opnieuw testen.'};
  if(req.every(s=>isJog(s)&&sessionOk(s,pw))) return {to:Math.min(NW(),pw+1),label:'door',why:`Alle jog-sessies binnen de grenzen: door naar week ${Math.min(NW(),pw+1)}.`};
  const miss=req.filter(s=>!isJog(s)).length;
  return {to:pw,label:'herhalen',why:miss?`${miss} jog-sessie(s) niet gedaan: week ${pw} herhalen.`:`Niet alle jog-sessies binnen de grenzen: week ${pw} herhalen.`};
}
function timeline(){
  if(TL&&TL.key===TODAY)return TL;
  const start=weekStart(SCHEMA.config.startDate),cur=weekStart(TODAY),thru=LOG.dataThrough||'',ov=LOG.weekOverrides||{},weeks=[];
  let pw=1,done=false;
  for(let ws=start;ws<=addDays(cur,7*60)&&!done;ws=addDays(ws,7)){
    if(ov[ws]!=null) pw=clampW(ov[ws]);
    // Beoordeeld als de hele week achter de data ligt, of als alle verplichte jog-dagen van deze week al data hebben.
    const wkk=weekOf(pw),lastJog=layoutWeek(ws,pw).filter(x=>['jog','test'].includes(wkk.days[DK[x.src]].type)).at(-1)?.date||addDays(ws,6);
    const reqDone=lastJog<=thru&&sessionsAll().some(s=>s.date>=ws&&s.date<=addDays(ws,6));
    const e={ws,pw,override:ov[ws]!=null,past:ws<cur,complete:addDays(ws,6)<=thru||reqDone};
    weeks.push(e);
    if(e.complete){e.res=evalWeek(ws,pw);pw=e.res.to}
    else { if(pw>=NW()&&ws>=cur) done=true; pw=Math.min(NW(),pw+1) }
  }
  TL={key:TODAY,weeks,cur:weeks.find(w=>w.ws===cur)||weeks.at(-1)};
  return TL;
}
const weekEntry=d=>{const ws=weekStart(d);return timeline().weeks.find(w=>w.ws===ws)};
const pwOn=d=>{const t=timeline();return weekEntry(d)?.pw??(d>t.weeks.at(-1).ws?NW():1)};
const curPw=()=>timeline().cur.pw;
function finishDate(){const t=timeline(),last=t.weeks.find(w=>w.pw>=NW()&&w.ws>=t.cur.ws);return last?addDays(last.ws,3):null}

/* ---------- gewicht + calorieën ---------- */
function avg7(d){const w=weights().filter(x=>x.date<=d&&x.date>addDays(d,-7));return w.length?w.reduce((a,b)=>a+b.kg,0)/w.length:null}
const cnt7=d=>weights().filter(x=>x.date<=d&&x.date>addDays(d,-7)).length;
function trendPerWeek(){const W=weights();if(!W.length)return null;const l=W.at(-1).date,o=addDays(l,-14);if(cnt7(l)<3||cnt7(o)<3)return null;return (avg7(o)-avg7(l))/2}
function planKgAt(d){const s=SET();if(s.refKg==null||!validDate(s.refDate))return null;return Math.max(s.goalKg??0,s.refKg-(s.rateKg||0.6)*days(s.refDate,d)/7)}
function kcalAdvice(){
  const k=kcalState(),tr=trendPerWeek(),since=days(k.setAt,TODAY),every=NUT().adjustEveryDays||14,min=NUT().kcalFloor||2200;
  if(tr==null) return `<div class="banner b-mute">Nog te weinig metingen voor bijsturing. Weeg je dagelijks; na 3 weken stuurt de app je calorieën bij.</div>`;
  if(since<every) return `<div class="banner b-mute">Volgende check over ${every-since} dagen. Je valt nu ${nl(tr,2)} kg per week af (doel 0,4–1,0).</div>`;
  let nk=k.kcal,msg;
  if(tr<0.4){nk=Math.max(min,k.kcal-200);msg=`Je valt ${nl(tr,2)} kg per week af, minder dan 0,4.`}
  else if(tr>1.0){nk=k.kcal+200;msg=`Je valt ${nl(tr,2)} kg per week af, meer dan 1,0.`}
  else return `<div class="banner b-good">Je valt ${nl(tr,2)} kg per week af. Precies goed, je calorieën blijven gelijk.<div style="margin-top:6px"><button data-kcal="${k.kcal}">Check opslaan</button></div></div>`;
  if(nk===k.kcal) return `<div class="banner b-warn">${msg} Je zit al op de ondergrens van ${int(min)} kcal: meer bewegen in plaats van minder eten.<div style="margin-top:6px"><button data-kcal="${k.kcal}">Check opslaan</button></div></div>`;
  return `<div class="banner b-warn">${msg} Advies: ${int(nk)} kcal.<div style="margin-top:6px"><button class="primary" data-kcal="${nk}">Toepassen</button></div></div>`;
}
// Signalen uit de ochtendcheck (config.progression)
function signals(){
  const out=[],m=LOC.morning,y=addDays(TODAY,-1),pain=Math.max(m[TODAY]?.pain??0,m[y]?.pain??0),last=sessionsAll().filter(s=>s.date<TODAY).at(-1);
  if(pain>3||(last&&last.pain>3&&days(last.date,TODAY)<=2)) out.push(['b-warn',`Pijn boven 3: vandaag geen jogs, alleen rustig wandelen. Gebeurt dit een 2e keer, dan 1 week terug. Houdt de pijn langer dan een week aan: stoppen en naar huisarts of fysio.`]);
  const prev=Object.entries(m).filter(([d,v])=>d<TODAY&&d>=addDays(TODAY,-21)&&v?.rhr>30).map(([,v])=>v.rhr).sort((a,b)=>a-b);
  const rhr=m[TODAY]?.rhr;
  if(rhr&&prev.length>=5){const base=prev[Math.floor(prev.length/2)];if(rhr>=base+10)out.push(['b-warn',`Rusthartslag ${rhr} is ${rhr-base} hoger dan normaal (${base}). Alleen rustig wandelen; daarna de laatste week herhalen. Laat het me weten in de chat, dan pas ik de planning aan.`])}
  return out;
}

/* ---------- render: vandaag ---------- */
// Ring: buitenring = planweken, binnenring = trainingen deze week. Het draaiende bolletje is de baan naar 5 km.
function ringSvg(outer,inner,big,small){
  const arc=(r,f,col,w)=>{const C=+(2*Math.PI*r).toFixed(1),q=Math.min(1,Math.max(0,f||0)),off=(C*(1-Math.max(q,.02))).toFixed(1);
    return `<circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--grid)" stroke-width="${w}"/>`+(q>0?`<circle class="ring" cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${C} ${C}" style="--len:${C};stroke-dashoffset:${off}" transform="rotate(-90 60 60)"/>`:'')};
  return `<svg viewBox="0 0 120 120" role="img" aria-label="${esc(big+' '+small)}">${arc(52,outer,'var(--accent)',8)}${arc(41,inner,'var(--violet)',5)}
   <g class="spin"><circle cx="60" cy="8" r="4" fill="var(--violet)"/></g>
   <text x="60" y="61" text-anchor="middle" style="fill:var(--ink);font-size:20px;font-weight:600">${esc(big)}</text>
   <text x="60" y="77" text-anchor="middle" style="font-size:10px">${esc(small)}</text></svg>`;
}
const weekDays=ws=>[...Array(7)].map((_,i)=>addDays(ws,i)).filter(dt=>dayPlan(dt).kind!=='rest'||sessionOn(dt));
// Reeks: jogs op rij binnen de grenzen (beloont rustig blijven, niet hard lopen)
function jogStreak(){let run=0,best=0;for(const s of sessionsAll().filter(isJog)){run=sessionOk(s,pwOn(s.date))?run+1:0;best=Math.max(best,run)}return {cur:run,best}}
// Wanneer haal je je streefgewicht bij de huidige trend (7-daags gemiddelde, laatste 2 weken)?
function goalForecast(){
  const W=weights(),tr=trendPerWeek(),g=SET().goalKg;if(!W.length||tr==null||tr<0.05||g==null)return null;
  const l=W.at(-1).date,left=avg7(l)-g;return left<=0?l:addDays(l,Math.round(left/tr*7));
}
// Focuspunt: laatste zin van de meest recente review die een focus of "volgende keer" noemt
function focusPoint(){
  const last=s=>String(s.review).trim().replace(/\.$/,'').split(/\.\s+/).at(-1),R=sessionsAll().filter(s=>s.review).reverse();
  const f=R.find(s=>/focus|volgende/i.test(last(s)))||R[0];if(!f)return null;
  const t=last(f),txt=t.replace(/^[^:]{1,70}:\s+/,'').trim(); // alleen ": " telt als kop, niet 7:30
  return {date:f.date,text:txt.charAt(0).toUpperCase()+txt.slice(1)+'.'};
}
// Aangepaste training voor de Watch, met tempo-alarm per werkstuk
function watchTip(pl){
  if(!isJog(pl))return '';
  const d=pl.day,s=d.session||d.test?.session,pace=phaseNr(pl.w)===1||pl.kind==='test';let steps='';
  if(d.test?.distanceKm) steps=`werk ${d.test.distanceKm} km`;
  else if(s?.format==='distance-intervals') steps=`${s.reps}× (werk ${s.jogMeters} m · herstel ${s.walkMetersBetween} m)`;
  else if(s?.format==='time-intervals'&&s.blocks) steps=s.blocks.map(b=>`${b.reps}× (werk ${secTxt(b.jogSec)}${b.walkSec?` · herstel ${secTxt(b.walkSec)}`:''})`).join(' + ');
  else if(s) steps=`werk ${minTxt(s.jogMin)}${s.format==='time-intervals'?' in blokken':''}`;
  const plan=[s?.warmupWalkMin?`opwarmen ${s.warmupWalkMin} min`:'',steps,s?.cooldownWalkMin?`afkoelen ${s.cooldownWalkMin} min`:''].filter(Boolean).join(' · ');
  return `<details class="more"><summary>⌚ Tempo-alarm op je Watch</summary><ol class="steps">
   <li>Workout-app → ⋯ bij Buitenloop → maak een aangepaste training.</li>
   <li>${esc(plan.charAt(0).toUpperCase()+plan.slice(1))}.</li>
   <li>${pace?'Bij elk werkstuk een tempo-alarm, bereik 7:00–7:30 /km. ':''}Hartslagmelding boven 170.</li></ol>
   <p class="muted">Je Watch tikt dan zodra ${pace?'je te snel gaat of je hartslag boven 170 komt':'je hartslag boven 170 komt'}. Eén keer instellen; pas het aan als het schema verandert.</p></details>`;
}
function orbitCard(){
  const e=timeline().cur,w=e.pw,wk=weekOf(w),td=weekDays(e.ws),done=td.filter(d=>sessionOn(d)).length,st=jogStreak(),fc=goalForecast(),fin=finishDate();
  return `<div class="card"><div class="orbit">${ringSvg(w/NW(),td.length?done/td.length:0,'wk '+w,'van '+NW())}
   <div class="orbit-stats"><span class="eyebrow">Fase ${wk.phase} · ${esc(wk.phaseName)}</span>
    <div class="sub">Deze week <b class="m" style="color:var(--violet)">${done}/${td.length}</b> trainingen</div>
    <div class="sub">5 km verwacht <b class="m" style="color:var(--accent)">${fin?`${MON[parse(fin).getMonth()]} ${fin.slice(0,4)}`:'–'}</b></div>
    ${fc?`<div class="sub">${nl(SET().goalKg,0)} kg verwacht <b class="m" style="color:var(--accent)">${MON[parse(fc).getMonth()]} ${fc.slice(0,4)}</b></div>`:''}
    <div class="muted">${st.cur?`Reeks: <b style="color:var(--good)">${st.cur}</b> jog${st.cur>1?'s':''} op rij binnen de grenzen${st.best>st.cur?` (record ${st.best})`:''}`:`Reeks: begint bij je volgende rustige jog${st.best?` (record ${st.best})`:''}`}</div>
   </div></div></div>`;
}
function dayCard(date){
  const pl=dayPlan(date),w=pl.w,s=sessionOn(date),rest=pl.kind==='rest'&&!pl.darts;
  let h=`<div class="card hero"><div class="row between"><span class="eyebrow">Vandaag${pl.darts?'':' · '+esc(SCHEMA.config.sessionTime||'19:00')}</span>${s?verdictPill(s,w):pl.darts?'<span class="pill p-warn">◎ darts</span>':pl.kind==='rest'?'<span class="pill p-mute">rust</span>':'<span class="pill p-acc">gepland</span>'}</div>
    <h2>${esc(pl.title)}</h2><p class="sub">${esc(pl.text)}</p>`;
  h+=signals().map(x=>`<div class="banner ${x[0]}">${esc(x[1])}</div>`).join('');
  if(pl.rules&&!s) h+=`<ul class="steps">${phaseRules(w).map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`;
  if(s) h+=resultHtml(s,w);
  else if(pl.kind!=='rest') h+=`<p class="muted">Klaar? Deel je Watch-data in de chat; dan komt hier je review.</p>`+watchTip(pl);
  h+=`<details class="more"><summary>${rest?'Wat mag wel op een rustdag?':'Waarom deze training?'}</summary><p class="muted">${esc(purposeOn(date))}</p>${rest?`<ul class="steps">${REST_OPTIONS.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p class="muted">Niet joggen en geen lange of zware inspanning: rust is waar je sterker wordt.</p>`:''}</details>`;
  return h+'</div>';
}
// Zondag: de week in cijfers, wat de app ervan vindt en wat er volgende week verandert
function weekReview(){
  const e=timeline().cur,ws=e.ws,S=sessionsAll().filter(s=>s.date>=ws&&s.date<=addDays(ws,6)),td=weekDays(ws),adv=evalWeek(ws,e.pw);
  const a=avg7(TODAY),b=avg7(addDays(TODAY,-7)),npw=clampW((LOG.weekOverrides||{})[addDays(ws,7)]??adv.to),mon=planFor(npw,1);
  return `<div class="card violet"><div class="row between"><span class="eyebrow">Weekoverzicht · planweek ${e.pw}</span><span class="pill p-vio">zondag</span></div>
   <div class="tiles"><div class="tile"><span class="eyebrow">Gedaan</span><span class="v">${S.length}/${td.length}</span><span class="d">trainingen</span></div>
   <div class="tile"><span class="eyebrow">Beweging</span><span class="v">${int(S.reduce((x,s)=>x+(s.durMin||0),0))}</span><span class="d">min · ${nl(S.reduce((x,s)=>x+(s.km||0),0),1)} km</span></div>
   <div class="tile"><span class="eyebrow">Gewicht</span><span class="v">${a!=null&&b!=null?(a<=b?'−':'+')+nl(Math.abs(a-b),1):'–'}</span><span class="d">kg, 7-daags</span></div></div>
   <p class="sub">${esc(adv.why)}</p>
   <p class="muted"><b>Volgende week (planweek ${npw}), maandag:</b> ${esc(mon.text)}</p></div>`;
}
function renderToday(){
  const k=kcalState(),W=weights(),a7=avg7(TODAY)??(W.length?avg7(W.at(-1).date):null),tr=trendPerWeek(),pk=planKgAt(TODAY),m=LOC.morning[TODAY]||{};
  const fp=focusPoint(),nx=upcoming(3),todayJog=isJog(dayPlan(TODAY));
  let h=orbitCard()+dayCard(TODAY);
  if(fp) h+=`<div class="card focus"><div class="row between"><span class="eyebrow" style="color:var(--warn)">Focus</span><span class="muted">uit de review van ${nice(fp.date)}</span></div><p class="sub" style="color:var(--ink)">${esc(fp.text)}</p></div>`;
  h+=`<div class="card"><span class="eyebrow">Ochtendcheck · wegen na toilet, vóór ontbijt</span>
    <div class="weigh"><label class="f">Gewicht (kg)<input id="m-kg" inputmode="decimal" placeholder="122,4" value="${LOC.weights[TODAY]!=null?nl(LOC.weights[TODAY],1):''}"></label>
    <label class="f">Pijn (0–10)<input id="m-pain" inputmode="numeric" placeholder="0" value="${esc(m.pain??'')}"></label>
    <label class="f">Rusthartslag<input id="m-rhr" inputmode="numeric" placeholder="bijv. 62" value="${esc(m.rhr??'')}"></label></div>
    <button class="primary" id="m-save">Opslaan</button>
    <div class="tiles"><div class="tile"><span class="eyebrow">7-daags</span><span class="v">${nl(a7,1)}</span><span class="d">kg gemiddeld</span></div>
    <div class="tile"><span class="eyebrow">Tempo</span><span class="v">${tr!=null?(tr>=0?'−':'+')+nl(Math.abs(tr),2):'–'}</span><span class="d">kg per week</span></div>
    <div class="tile"><span class="eyebrow">Plan</span><span class="v">${nl(pk,1)}</span><span class="d">kg verwacht</span></div></div></div>`;
  if(parse(TODAY).getDay()===0) h+=weekReview();
  if(nx.length) h+=`<div class="card"><div class="row between"><span class="eyebrow">Volgende training</span><span class="pill p-mute">${nx[0].in===1?'morgen':`over ${nx[0].in} dagen`}</span></div>
    <h2>${esc(nx[0].pl.title)}</h2><p class="sub">${longDate(nx[0].date)} · ${esc(SCHEMA.config.sessionTime||'19:00')} — ${esc(nx[0].pl.text)}</p>
    ${todayJog&&!sessionOn(TODAY)?'':watchTip(nx[0].pl)}
    <details class="more"><summary>Waarom deze training?</summary><p class="muted">${esc(purposeOn(nx[0].date))}</p></details>
    ${nx.slice(1).map(u=>`<div class="muted">${nice(u.date)}: ${esc(u.pl.title)}</div>`).join('')}</div>`;
  h+=`<div class="card"><span class="eyebrow">Eten vandaag</span><div class="row between"><div><div class="big">${int(k.kcal)}</div><div class="muted">kcal · nooit onder ${int(NUT().kcalFloor||2200)}</div></div><div style="text-align:right"><div class="big">${int(NUT().proteinG||130)} g</div><div class="muted">eiwit</div></div></div>${kcalAdvice()}</div>`;
  h+=weekCard();
  $('#v-today').innerHTML=h;
  $('#m-save').onclick=saveMorning;
  document.querySelectorAll('[data-kcal]').forEach(b=>b.onclick=()=>{LOC.kcal={kcal:+b.dataset.kcal,setAt:TODAY};if(saveLocal()){toast('Opgeslagen');render()}});
}
function upcoming(n){
  const out=[],fd=finishDate();
  for(let i=1;out.length<n&&i<15;i++){const d=addDays(TODAY,i);if(fd&&d>fd)break;const pl=dayPlan(d);if(pl.kind!=='rest')out.push({date:d,pl,in:i})}
  return out;
}
function weekCard(){
  const e=timeline().cur,ws=e.ws,w=e.pw,inWeek=sessionsAll().filter(s=>s.date>=ws&&s.date<=addDays(ws,6)),jogs=inWeek.filter(isJog);
  const tdays=weekDays(ws);
  const dots=tdays.map(dt=>{const s=sessionOn(dt);
    const c=s?(isJog(s)?(sessionOk(s,w)?'var(--good)':'var(--warn)'):'var(--good)'):dt<TODAY&&dt<=(LOG.dataThrough||'')?'var(--bad)':'var(--grid)';
    return `<span style="display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px;color:var(--muted)"><span class="dot" style="background:${c};width:14px;height:14px"></span>${DK[parse(dt).getDay()]}</span>`}).join('');
  const adv=evalWeek(ws,w),nMatch=[...Array(7)].filter((_,i)=>DARTS[addDays(ws,i)]).length;
  return `<div class="card"><div class="row between"><span class="eyebrow">Deze week · planweek ${w}${nMatch?` · ${nMatch}× darts`:''}</span><span class="muted">${inWeek.length} van ${tdays.length} · ${jogs.filter(s=>sessionOk(s,w)).length}/${jogs.length} jogs binnen grenzen</span></div>
   <div class="row" style="justify-content:space-around">${dots}</div>
   ${inWeek.length?`<p class="muted">Stand nu: ${esc(adv.why)} De week wordt automatisch beoordeeld als alle data binnen is.</p>`:'<p class="muted">Nog geen trainingen met data deze week.</p>'}</div>`;
}
function saveMorning(){
  const kg=num($('#m-kg').value),pain=num($('#m-pain').value),rhr=num($('#m-rhr').value);
  if(kg!=null&&!(kg>40&&kg<250)){toast('Gewicht in kg, bijv. 122,4');return}
  if(pain!=null&&!(pain>=0&&pain<=10)){toast('Pijn is 0 tot 10');return}
  if(rhr!=null&&!(rhr>30&&rhr<130)){toast('Rusthartslag tussen 30 en 130');return}
  if(kg!=null) LOC.weights[TODAY]=Math.round(kg*10)/10; else delete LOC.weights[TODAY];
  LOC.morning[TODAY]={...(pain!=null?{pain:Math.round(pain)}:{}),...(rhr!=null?{rhr:Math.round(rhr)}:{})};
  if(!Object.keys(LOC.morning[TODAY]).length) delete LOC.morning[TODAY];
  if(saveLocal()){document.activeElement?.blur();toast('Opgeslagen');render();$('#m-save')?.classList.add('pulse')}
}

/* ---------- render: agenda ---------- */
function renderAgenda(){
  const t=timeline(),show=t.weeks.filter(w=>w.ws<=addDays(t.cur.ws,7*5));
  const h=show.map(e=>{
    const wk=weekOf(e.pw),tag=e.override?'<span class="pill p-mute">aangepast</span>':e.res?`<span class="pill ${e.res.to>e.pw?'p-good':'p-warn'}">${esc(e.res.label)}</span>`:e.ws===t.cur.ws?'<span class="pill p-acc">deze week</span>':e.past?'<span class="pill p-mute">data volgt</span>':'<span class="pill p-mute">verwacht</span>';
    const rows=[0,1,2,3,4,5,6].map(i=>{const d=addDays(e.ws,i),pl=dayPlan(d),s=sessionOn(d),isT=d===TODAY;
      const st=s?verdictPill(s,e.pw):pl.darts?'<span class="pill p-warn">◎ darts</span>':pl.kind==='rest'?'':d<TODAY&&d<=(LOG.dataThrough||'')?'<span class="pill p-bad">geen data</span>':d<TODAY?'<span class="pill p-mute">data volgt</span>':pl.moved?'<span class="pill p-vio">⇄ verplaatst</span>':'';
      return `<details class="day${isT?' today':''}${pl.kind==='rest'?' rest':''}" ${isT?'id="agenda-today" open':''}><summary><span class="when">${nice(d)}${isT?'<br><span class="pill p-acc">vandaag</span>':''}</span><span class="t">${esc(pl.title)}</span>${st}</summary>
        <div class="body"><div class="sub">${esc(pl.text)}</div><div class="muted"><b>Idee:</b> ${esc(purposeOn(d))}</div>${s?resultHtml(s,e.pw):''}${pl.kind==='rest'&&!pl.darts?`<div class="muted">Mag: ${esc(REST_OPTIONS.slice(0,3).join(' · '))}</div>`:''}</div></details>`}).join('');
    return `<div class="card"><div class="row between"><div><span class="eyebrow">Week van ${nice(e.ws)}</span><h2>Planweek ${e.pw} · fase ${wk.phase}${wk.recoveryWeek?' · herstel':''}${wk.testWeek?' · test':''}</h2></div>${tag}</div>${e.res?`<p class="muted">${esc(e.res.why)}</p>`:''}${rows}</div>`;
  }).join('');
  $('#v-agenda').innerHTML=`<p class="muted">Tik op een dag voor de planning en (achteraf) de review. Weken na vandaag zijn een verwachting: de app schuift ze op als een week herhaald moet worden.</p>`+h;
  $('#agenda-today')?.scrollIntoView({block:'center'});
}

/* ---------- render: voortgang (gewicht + trainingen) ---------- */
function weightHtml(){
  const W=weights(),last=W.at(-1),tr=trendPerWeek(),s=SET(),a7=last?avg7(last.date):null,fc=goalForecast();
  const srcTxt=x=>x.src==='middenweg'?`middenweg (app ${nl(x.app,1)} · export ${nl(x.exp,1)})`:x.src==='beide'?'app + export':x.src;
  return `<div class="card hero"><div class="row between"><span class="eyebrow">Gewicht</span><span class="muted">${last?nice(last.date):'nog niets'}</span></div>
   <div class="row" style="align-items:baseline"><span class="big">${last?nl(last.kg,1):'–'}</span><span class="muted">kg</span>${last&&s.startKg&&validDate(s.startDate)?`<span class="pill p-acc">${last.kg<=s.startKg?'−':'+'}${nl(Math.abs(s.startKg-last.kg),1)} kg sinds ${MON[parse(s.startDate).getMonth()]}</span>`:''}</div>
   ${weightChart()}
   <div class="legend"><span><i style="background:var(--accent)"></i>7-daags gemiddelde</span><span><i style="background:var(--muted);height:6px;width:6px;border-radius:50%"></i>Dagmeting</span><span><i style="background:var(--plan)"></i>Plan ${nl(s.rateKg||0.6,1)} kg/week</span><span><i style="background:var(--goal)"></i>Doel</span></div>
   <div class="tiles"><div class="tile"><span class="eyebrow">7-daags</span><span class="v">${nl(a7,1)}</span><span class="d">${tr!=null?`${tr>=0?'−':'+'}${nl(Math.abs(tr),2)} kg/week`:'kg'}</span></div>
   <div class="tile"><span class="eyebrow">Nog te gaan</span><span class="v">${a7!=null&&s.goalKg!=null?nl(Math.max(0,a7-s.goalKg),1):'–'}</span><span class="d">kg tot ${nl(s.goalKg,0)}</span></div>
   <div class="tile"><span class="eyebrow">${nl(s.goalKg,0)} kg</span><span class="v">${fc?`${MON[parse(fc).getMonth()]} ${fc.slice(2,4)}`:'–'}</span><span class="d">${fc?'bij dit tempo':'nog geen trend'}</span></div></div>
   <details class="more"><summary>Alle metingen</summary><div class="tw"><table><thead><tr><th>Datum</th><th>kg</th><th>7-daags</th><th>Bron</th></tr></thead><tbody>${W.slice().reverse().slice(0,90).map(x=>`<tr><td>${nice(x.date)}</td><td class="n">${nl(x.kg,1)}</td><td class="n">${nl(avg7(x.date),1)}</td><td class="muted">${esc(srcTxt(x))}${x.app!=null?` <button data-delw="${esc(x.date)}" aria-label="Eigen meting verwijderen" style="min-height:0;padding:0 6px;border:0">✕</button>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">Nog geen metingen.</td></tr>'}</tbody></table></div></details></div>`;
}
function trainHtml(){
  const L=sessionsAll().reverse(),jogs=L.filter(isJog),ok=jogs.filter(s=>sessionOk(s,pwOn(s.date))).length,km=L.reduce((a,s)=>a+(s.km||0),0),st=jogStreak();
  let h=`<div class="card"><span class="eyebrow">Trainingen</span><div class="tiles">
    <div class="tile"><span class="eyebrow">Gedaan</span><span class="v">${L.length}</span><span class="d">${nl(km,1)} km totaal</span></div>
    <div class="tile"><span class="eyebrow">Jogs ok</span><span class="v">${ok}/${jogs.length}</span><span class="d">binnen grenzen</span></div>
    <div class="tile"><span class="eyebrow">Reeks</span><span class="v">${st.cur}</span><span class="d">record ${st.best}</span></div></div>
    <p class="muted">Data bijgewerkt tot ${validDate(LOG.dataThrough)?nice(LOG.dataThrough):'–'}. Deel nieuwe trainingen in de chat voor een review.</p></div>`;
  h+=L.map(s=>{const w=pwOn(s.date),pl=dayPlan(s.date);
    return `<div class="card"><div class="row between"><span class="eyebrow">${longDate(s.date)} · planweek ${w}</span>${verdictPill(s,w)}</div><h2>${esc(pl.title)}</h2><div class="muted">Plan: ${esc(pl.text)}</div>${resultHtml(s,w)}</div>`}).join('')
    ||'<div class="card"><p class="muted">Nog geen trainingen met data.</p></div>';
  return h;
}
function renderProgress(){
  $('#v-progress').innerHTML=weightHtml()+trainHtml();
  document.querySelectorAll('[data-delw]').forEach(b=>b.onclick=()=>{if(confirm(`Eigen meting van ${nice(b.dataset.delw)} verwijderen?`)){delete LOC.weights[b.dataset.delw];if(saveLocal())render()}});
}
function weightChart(){
  const W=weights(),s=SET();if(W.length<2)return '<p class="muted">De grafiek verschijnt na 2 metingen.</p>';
  const from=W[0].date,to=addDays(TODAY,21),n=Math.max(1,days(from,to)),Wd=600,H=230,m={l:34,r:8,t:10,b:22};
  const xs=d=>m.l+days(from,d)/n*(Wd-m.l-m.r);
  const vals=W.map(x=>x.kg).concat(s.goalKg!=null?[s.goalKg]:[]).concat(planKgAt(to)!=null?[planKgAt(to)]:[]);
  const lo=Math.floor(Math.min(...vals)-2),hi=Math.ceil(Math.max(...vals)+1),ys=v=>m.t+(hi-v)/(hi-lo)*(H-m.t-m.b);
  let g='';const step=hi-lo>20?5:2;
  for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step) g+=`<line x1="${m.l}" x2="${Wd-m.r}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--grid)"/><text x="${m.l-5}" y="${ys(v)+3.5}" text-anchor="end">${v}</text>`;
  for(let d=parse(from);iso(d)<=to;d.setDate(d.getDate()+1)) if(d.getDate()===1) g+=`<text x="${xs(iso(d))}" y="${H-6}" text-anchor="middle">1 ${MON[d.getMonth()]}</text>`;
  if(s.goalKg!=null) g+=`<line x1="${m.l}" x2="${Wd-m.r}" y1="${ys(s.goalKg)}" y2="${ys(s.goalKg)}" stroke="var(--goal)" stroke-width="1.5"/>`;
  if(planKgAt(to)!=null){const a=from<s.refDate?s.refDate:from;g+=`<line x1="${xs(a)}" y1="${ys(planKgAt(a))}" x2="${xs(to)}" y2="${ys(planKgAt(to))}" stroke="var(--plan)" stroke-width="2" stroke-dasharray="6 5"/>`}
  W.forEach(x=>g+=`<circle cx="${xs(x.date)}" cy="${ys(x.kg)}" r="2.5" fill="var(--muted)"><title>${nice(x.date)}: ${nl(x.kg,1)} kg</title></circle>`);
  const a=W.map(x=>[x.date,avg7(x.date)]);
  g+=`<path d="${a.map((q,i)=>(i?'L':'M')+xs(q[0]).toFixed(1)+','+ys(q[1]).toFixed(1)).join('')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const l=a.at(-1);g+=`<circle cx="${xs(l[0])}" cy="${ys(l[1])}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
  return `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Gewicht met 7-daags gemiddelde, plan en doel">${g}</svg>`;
}

/* ---------- render: plan ---------- */
// Onderbouwing van het plan: waarom deze opbouw, in gewone taal.
const PHASE_WHY={
  1:'Je pezen, botten en gewrichten wennen aan joggen. Spieren en conditie gaan in weken vooruit, pezen en botten hebben maanden nodig. Daarom heel korte jogs, ook als het makkelijk voelt.',
  2:'Van losse stukjes naar 1 km aan één stuk. De jogblokken worden langer in tijd; het wandelen ertussen wordt korter.',
  3:'Van 1 naar 2 km. Vanaf week 17 komt er een derde, lichte jog bij: vaker kleine prikkels zijn beter dan één zware.',
  4:'Van 2 naar 3 km. Langer aan één stuk in praattempo bouwt je basisconditie, waar de hele 5 km op rust.',
  5:'Van 3 naar 4 km. De stappen zijn klein (een paar minuten per week), zodat je lichaam de extra afstand bijhoudt.',
  6:'Van 4 naar 5 km, met de eindtest. Ook hier: rustig tempo. Het doel is 5 km uitlopen, niet snel lopen.'};
function whyCard(p){
  const c=SCHEMA.config,n=c.nutrition||{},R=[
   ['Langzaam opbouwen','Bij joggen vangt je lichaam bij elke pas 2 à 3 keer je gewicht op. Pezen en botten passen zich trager aan dan je conditie. Het grootste risico is dus niet te weinig conditie, maar een blessure door te snel opbouwen. Daarom begint het plan met jogs van 60 m.'],
   ['Ruim de tijd',`${NW()} weken plus ${c.goals.bufferWeeks||'4–6'} weken buffer tot ${nice(c.goals.finalRunTargetDate)}. Een week herhalen hoort erbij en brengt het doel niet in gevaar. Daardoor hoef je nooit door te drukken.`],
   ['Jogdagen ma en do (later ook za)','Nooit twee jogdagen achter elkaar: pezen hebben 48 tot 72 uur nodig om te herstellen. De rustdagen (wo en vr) liggen er precies tussen.'],
   ['Wandelen op di, za en zo','Zone 2-wandelen bouwt conditie op en verbrandt calorieën zonder de schokken van joggen. Zo train je je hart vaker dan je pezen.'],
   ['Langzaam tempo en hartslaggrens','Minstens 7:00 /km, praattempo en bij 170 wandelen. Langzaam lopen traint je basisconditie (vetverbranding, hart) het best en belast je lichaam het minst. Te hard lopen is de meest gemaakte fout bij beginners.'],
   ['Elke 4e week een herstelweek','Je wordt sterker in de rust na de training, niet tijdens de training. Een lichtere week zorgt dat je lichaam de vorige weken kan verwerken. Daarna checken we ook je data.'],
   ['Een test aan het eind van elke fase','Zo bepaalt een meetbaar moment wanneer je verder gaat, niet je gevoel of de kalender. Haal je de test niet, dan herhaal je 2 weken en is er niets verloren.'],
   ['Alleen door als het goed ging','Je gaat pas een week verder als alle jogs binnen de grenzen bleven. Een gemiste sessie haal je niet in: dubbel trainen is dubbele belasting. Het plan volgt je lichaam, niet de agenda.'],
   ['Eten',`${n.kcalStart||2500} kcal, nooit onder ${n.kcalFloor||2200}, met ${n.proteinG||130} g eiwit. Dat geeft 0,4 tot 1 kg verlies per week: snel genoeg om de belasting op je benen te verlagen, maar niet zo streng dat je slecht herstelt. Eiwit beschermt je spieren. Watch-calorieën eet je niet terug, want die worden vaak overschat.`],
   ['Dagelijks wegen, 7-daags gemiddelde','Je gewicht schommelt per dag 1 à 2 kg door vocht en zout. Alleen het weekgemiddelde laat de echte trend zien. Daarom stuurt de app pas na 14 dagen bij.']];
  return `<div class="card"><span class="eyebrow">Waarom dit plan</span><p class="sub"><b>Nu, fase ${p}:</b> ${esc(PHASE_WHY[p]||'')}</p>
   ${R.map(([t,x])=>`<details class="day why"><summary><span class="t">${esc(t)}</span></summary><div class="body"><div class="muted">${esc(x)}</div></div></details>`).join('')}</div>`;
}
// Banen: per fase een ring (fase 1 buiten, fase 6 binnen), de kern is 5 km
function phaseRings(ph,w){
  const n=ph.length,g=ph.map((f,i)=>{const r=54-i*(40/Math.max(1,n-1)),C=+(2*Math.PI*r).toFixed(1),q=w<f.from?0:Math.min(1,(w-f.from+1)/(f.to-f.from+1)),off=(C*(1-q)).toFixed(1);
    return `<circle cx="60" cy="60" r="${r.toFixed(1)}" fill="none" stroke="var(--grid)" stroke-width="4"/>`+(q>0?`<circle class="ring" cx="60" cy="60" r="${r.toFixed(1)}" fill="none" stroke="${w>f.to?'var(--good)':'var(--accent)'}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C} ${C}" style="--len:${C};stroke-dashoffset:${off}" transform="rotate(-90 60 60)"/>`:'')}).join('');
  return `<svg viewBox="0 0 120 120" role="img" aria-label="Fase ${phaseNr(w)} van ${n}, week ${w}">${g}<circle cx="60" cy="60" r="9" fill="var(--violet)"/><text x="60" y="63.5" text-anchor="middle" style="fill:var(--bg);font-size:8.5px;font-weight:700">5K</text></svg>`;
}
function renderPlan(){
  const t=timeline(),w=t.cur.pw,wk=weekOf(w),c=SCHEMA.config,fin=finishDate(),target=c.goals.finalRunTargetDate,late=fin&&target?days(target,fin):null;
  const ph=[...new Map(SCHEMA.weeks.map(x=>[x.phase,{nr:x.phase,name:x.phaseName,goal:x.phaseGoal,from:SCHEMA.weeks.find(y=>y.phase===x.phase).week,to:x.week}])).values()];
  let h=`<div class="card hero"><span class="eyebrow">Op weg naar ${esc(c.goals.finalRun)}</span><h2>Planweek ${w} van ${NW()} · fase ${wk.phase} · ${esc(wk.phaseName)}</h2>
   <p class="sub">Doel van deze fase: ${esc(wk.phaseGoal)}.</p>
   <div class="tiles"><div class="tile"><span class="eyebrow">Verwacht</span><span class="v">${fin?nice(fin):'–'}</span><span class="d">5 km-test${fin?' '+fin.slice(0,4):''}</span></div>
   <div class="tile"><span class="eyebrow">Doel</span><span class="v">${nice(target)}</span><span class="d">${target.slice(0,4)}</span></div>
   <div class="tile"><span class="eyebrow">Marge</span><span class="v">${late==null?'–':`${Math.round(Math.abs(late)/7)} wk`}</span><span class="d">${late==null?'':late<=0?'voor op doel':'later dan doel'}</span></div></div>
   <div class="orbit">${phaseRings(ph,w)}<div class="orbit-stats">${ph.map(f=>`<div class="row between" style="font-size:13px;${w>=f.from&&w<=f.to?'color:var(--accent)':w>f.to?'color:var(--good)':'color:var(--muted)'}"><span>F${f.nr} · ${esc(f.name)}</span><span class="m">${w>f.to?'✓':`wk ${f.from}–${f.to}`}</span></div>`).join('')}</div></div>
   <p class="muted">Het schema past zich automatisch aan: een herhaalde week schuift alles een week op. Buffer in het plan: ${esc(c.goals.bufferWeeks||'4–6')} weken.</p>
   <p class="muted">Darts: ${(()=>{const up=Object.keys(DARTS).filter(d=>d>=TODAY).sort();return up.length?`${up.length} wedstrijden van Pirates 7 staan nog op het programma (volgende: ${nice(up[0])}). Trainingen op die dagen schuiven naar een vrije dag in dezelfde week.`:'geen komende wedstrijden van Pirates 7 gevonden.'})()}</p></div>`;
  h+=whyCard(wk.phase);
  const ics=location.host+location.pathname.replace(/[^/]*$/,'')+'loopcoach.ics';
  h+=`<div class="card"><span class="eyebrow">Herinneringen</span><p class="sub">Abonneer je één keer in de Agenda-app van je iPhone: elke dag staat erin wat er gepland is (training met uitleg en grenzen, rustdag of darts), met een seintje om 18:30, en elke ochtend om 07:30 voor wegen en de ochtendcheck.</p>
   <div class="row"><a class="btn" href="webcal://${esc(ics)}">Toevoegen aan Agenda</a></div>
   <p class="muted">Werkt het niet? Agenda → Agenda's → Voeg agenda toe → Voeg agenda-abonnement toe → plak: https://${esc(ics)}</p></div>`;
  const pr=c.progression||{};
  h+=`<div class="card"><span class="eyebrow">Regels</span><ul class="steps">
   <li><b>Door:</b> ${esc(pr.advanceIf)}. Anders: ${esc(pr.else)}.</li><li><b>Sessie gemist:</b> ${esc(pr.missedSession)}. <b>Hele week gemist:</b> ${esc(pr.missedWeek)}.</li>
   <li><b>Test niet gehaald:</b> ${esc(pr.testFailed)}.</li><li><b>Ziek of rusthartslag +10:</b> ${esc(pr.sick_or_restingHrPlus10)}.</li>
   <li><b>Pijn &gt; 3 of de ochtend erna:</b> ${esc(pr.pain_gt3_or_nextMorning)}.</li><li><b>Pijn langer dan 1 week:</b> ${esc(pr.pain_gt_1week)}.</li></ul></div>`;
  h+=`<div class="card"><span class="eyebrow">Back-up van dit apparaat</span><p class="muted">Je eigen gewicht, ochtendcheck en calorieën staan alleen op deze telefoon. Trainingen en reviews staan in de app zelf.</p>
   <div class="row"><button id="b-exp">Exporteren</button><button id="b-imp">Terugzetten</button><input type="file" id="b-file" accept=".json,application/json" hidden></div></div>`;
  $('#v-plan').innerHTML=h;
  $('#b-exp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(LOC,null,1)],{type:'application/json'}));a.download=`orbit5k-backup-${TODAY}.json`;a.click()};
  $('#b-imp').onclick=()=>$('#b-file').click();
  $('#b-file').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());
      const w=Object.fromEntries(Object.entries(isObj(d.weights)?d.weights:{}).map(([k,v])=>[k,Number(v)]).filter(([k,v])=>validDate(k)&&Number.isFinite(v)&&v>40&&v<250));
      const m=Object.fromEntries(Object.entries(d.morning||{}).filter(([k,v])=>validDate(k)&&v&&typeof v==='object').map(([k,v])=>[k,{...(num(v.pain)!=null?{pain:num(v.pain)}:{}),...(num(v.rhr)!=null?{rhr:num(v.rhr)}:{})}]));
      if(confirm(`Back-up terugzetten (${Object.keys(w).length} metingen)?`)){LOC={weights:w,morning:m,...(d.kcal&&num(d.kcal.kcal)>=2200&&validDate(d.kcal.setAt)?{kcal:{kcal:num(d.kcal.kcal),setAt:d.kcal.setAt}}:{})};if(saveLocal()){toast('Teruggezet');render()}}
    }catch(_){toast('Geen geldig back-upbestand')} e.target.value=''};
}

/* ---------- tabs + start ---------- */
const VIEWS={today:renderToday,agenda:renderAgenda,progress:renderProgress,plan:renderPlan};
let view='today';
function render(){
  if(!SCHEMA)return;
  $('#hdr-date').textContent=longDate(TODAY);$('#hdr-week').textContent=`Week ${curPw()} · fase ${phaseNr(curPw())}`;
  VIEWS[view]();
}
function show(v){
  view=VIEWS[v]?v:'today';
  document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',x.dataset.v===view));
  Object.keys(VIEWS).forEach(k=>$('#v-'+k).hidden=k!==view);
  try{localStorage.setItem('lc-tab',view)}catch(e){}
  scrollTo(0,0);render();
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>show(b.dataset.v));
async function load(){
  const [s,l]=await Promise.all(['data/schema.json','data/log.json'].map(u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(u);return r.json()})));
  await loadDarts(); // vóór de tijdlijn: weekindeling hangt van de wedstrijden af
  SCHEMA=s;LOG=Object.assign({sessions:[],weights:[],settings:{},weekOverrides:{}},l);TL=null;LAYOUT.clear();
}
// App weer geopend: nieuwe datum en nieuwste reviews ophalen
document.addEventListener('visibilitychange',async()=>{if(document.hidden||!SCHEMA)return;if(!qToday)TODAY=iso(new Date());try{await load()}catch(e){}TL=null;render()});
async function start(){
  try{await load()}catch(e){const c=$('#conn');c.hidden=false;c.textContent='Het schema kon niet geladen worden. Controleer je verbinding en probeer opnieuw.';return}
  // vandaag openen staat altijd voorop
  show('today');
}
start();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
