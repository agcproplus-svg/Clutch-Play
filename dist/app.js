
async function loadJSON(url){ const r=await fetch(url); return r.json(); }

// Data
const teamMeta = await loadJSON('./data/team-meta.json');
let teams = await loadJSON('./data/sample-teams.json');
let cards = await loadJSON('./data/sample-cards.json');

// Apply admin overrides from localStorage if present
const saved = localStorage.getItem('cardsOverride');
if(saved){
  try{
    const over = JSON.parse(saved);
    // merge by id
    const byId = Object.fromEntries(cards.map(c=>[c.id,c]));
    over.forEach(o=>{ byId[o.id] = o; });
    cards = Object.values(byId);
  }catch(e){ console.warn('Override parse error', e); }
}

const cardById = Object.fromEntries(cards.map(c=>[c.id,c]));

// --- BEGIN FALLBACK HELPERS ---
function makeFallbackCard(teamId, pos){
  // Try to find a team-specific card with prefix TEAM-pos. If none, use generic.
  const idCandidates = [`${teamId}-`+pos, `${teamId.toUpperCase()}-`+pos, `${teamId}-${pos.toUpperCase()}`, `${teamId.toUpperCase()}-${pos.toUpperCase()}`];
  for(const id of idCandidates){
    if(cardById[id]) return cardById[id];
  }
  // else return generic
  return cardById[pos==='QB' ? 'GEN-QB' : 'GEN-RB'];
}
function getCardForOffense(offenseObj, playType){
  if(!offenseObj) return null;
  const isPass = (playType==='shortPass' || playType==='longPass');
  if(isPass){
    return offenseObj.QB || makeFallbackCard(offenseObj.id, 'QB');
  }else{
    return offenseObj.RB || makeFallbackCard(offenseObj.id, 'RB');
  }
}
// --- END FALLBACK HELPERS ---


// UI elements
const homeSel = document.getElementById('homeSelect');
const awaySel = document.getElementById('awaySelect');
const startBtn = document.getElementById('startBtn');
const setup = document.getElementById('setup');
const game = document.getElementById('game');
const logEl = document.getElementById('log');
const ballMarker = document.getElementById('ballMarker');
const adminBtn = document.getElementById('adminBtn');

const homeLogo = document.getElementById('homeLogo');
const awayLogo = document.getElementById('awayLogo');
const hLogo = document.getElementById('hLogo');
const aLogo = document.getElementById('aLogo');
const hAbbr = document.getElementById('hAbbr');
const aAbbr = document.getElementById('aAbbr');
const hScore = document.getElementById('hScore');
const aScore = document.getElementById('aScore');
const qtrEl = document.getElementById('qtr');
const clockEl = document.getElementById('clock');
const possEl = document.getElementById('poss');
const downEl = document.getElementById('down');
const yardEl = document.getElementById('yard');
const qbName = document.getElementById('qbName');
const rbName = document.getElementById('rbName');

const kickPatBtn = document.getElementById('kickPat');
const twoPtBtn = document.getElementById('goForTwo');

// Card Modal
const cardModal = document.getElementById('cardModal');
const closeCard = document.getElementById('closeCard');
const cardPlayerName = document.getElementById('cardPlayerName');
const cardPlayType = document.getElementById('cardPlayType');
const cardGrid = document.getElementById('cardGrid');

// Admin Modal
const adminModal = document.getElementById('adminModal');
const closeAdmin = document.getElementById('closeAdmin');
const adminLogin = document.getElementById('adminLogin');
const adminPanel = document.getElementById('adminPanel');
const adminUser = document.getElementById('adminUser');
const adminPass = document.getElementById('adminPass');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminPlayer = document.getElementById('adminPlayer');
const adminPlayerName = document.getElementById('adminPlayerName');
const adminTables = document.getElementById('adminTables');
const adminSave = document.getElementById('adminSave');
const adminExport = document.getElementById('adminExport');

// Populate dropdowns
teamMeta.forEach(t=>{
  const o1=document.createElement('option'); o1.value=t.id; o1.textContent=`${t.abbr} — ${t.name}`; homeSel.appendChild(o1);
  const o2=document.createElement('option'); o2.value=t.id; o2.textContent=`${t.abbr} — ${t.name}`; awaySel.appendChild(o2);
});
homeSel.value='NYG'; awaySel.value='DAL';

function logoFor(id){
  const t = teamMeta.find(x=>x.id===id);
  return t ? t.logo : `./assets/logos/${id}.svg`;
}
function syncLogos(){
  homeLogo.src = logoFor(homeSel.value);
  hLogo.src = logoFor(homeSel.value);
  hAbbr.textContent = (teamMeta.find(x=>x.id===homeSel.value)||{}).abbr || homeSel.value;
  awayLogo.src = logoFor(awaySel.value);
  aLogo.src = logoFor(awaySel.value);
  aAbbr.textContent = (teamMeta.find(x=>x.id===awaySel.value)||{}).abbr || awaySel.value;
}
homeSel.addEventListener('change', syncLogos);
awaySel.addEventListener('change', syncLogos);
syncLogos();

// Dice & helpers
function rollD6(){return Math.floor(Math.random()*6)+1;}
function roll3d6(){return rollD6()+rollD6()+rollD6();}
function lookup(table, roll){return table.find(r=> roll>=r.min && roll<=r.max)?.result || 'INC';}
function parseResult(res){
  if(res==='TD') return {yards:100, td:true};
  if(res==='INT') return {yards:0, turnover:'INT'};
  if(res==='FUM') return {yards:0, turnover:'FUM'};
  if(res==='INC') return {yards:0, incomplete:true};
  if(res.startsWith('SACK:')) return {yards:parseInt(res.split(':')[1],10)};
  if(res.startsWith('gain:')) return {yards:parseInt(res.split(':')[1],10)};
  return {yards:0};
}
function fmtTime(s){const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function pushLog(msg){ state.log.unshift(msg); renderLog(); }

// Kickoffs + returns
function kickoffDistance(){ const r=roll3d6(); if(r<=7)return 55; if(r<=10)return 60; if(r<=13)return 65; if(r<=15)return 70; return 75; }
function returnYards(){ const r=roll3d6(); if(r<=6)return 0; if(r<=8)return 5; if(r<=10)return 10; if(r<=12)return 15; if(r<=14)return 20; if(r<=16)return 30; return 50; }

// State
const state = {
  home:null, away:null, homeScore:0, awayScore:0,
  quarter:1, clock:15*60, possession:'home',
  down:1, distance:10, yardLine:25, log:[],
  pendingPAT:false, scoringTeam:null
};

function tick(secs){ state.clock=Math.max(0,state.clock-secs); if(state.clock===0){ if(state.quarter<4){ state.quarter+=1; state.clock=15*60; } } }
function firstDown(){ state.down=1; state.distance=10; }
function changePossession(){ state.possession = state.possession==='home'?'away':'home'; firstDown(); }
function renderBall(){
  const pct=(state.yardLine/99);
  ballMarker.style.left=(5+90*pct)+'%';
}
function render(){
  qtrEl.textContent = `Q${state.quarter}`;
  clockEl.textContent = fmtTime(state.clock);
  possEl.textContent = `Poss: ${state.possession}`;
  downEl.textContent = `${state.down} & ${state.distance}`;
  yardEl.textContent = `Ball: ${state.yardLine}`;
  hScore.textContent = state.homeScore;
  aScore.textContent = state.awayScore;
  kickPatBtn.disabled = !state.pendingPAT;
  twoPtBtn.disabled = !state.pendingPAT;
  renderBall();
}
function renderLog(){ logEl.innerHTML = state.log.map(x=>`<div>${x}</div>`).join(''); }

function startKickoff(kicking){
  const kick = kickoffDistance();
  const receiving = kicking==='home' ? 'away' : 'home';
  let spot = 35 + kick;
  state.possession = receiving;
  if(spot >= 100){
    state.yardLine = 25;
    pushLog(`${kicking} kickoff touchback`);
  }else{
    let yd = Math.max(1,100-spot);
    const ret=returnYards();
    yd = clamp(yd+ret,1,99);
    state.yardLine = yd;
    pushLog(`${kicking} kickoff to ${100-spot}, return ${ret} yds`);
  }
  firstDown();
  tick(6);
  render();
}

// Core play
function applyPlay(card, playType){
  // Penalty chance
  if(Math.random()<0.10 && (playType!=='punt' && playType!=='fieldGoal')){
    const pen=10;
    state.yardLine = clamp(state.yardLine-pen,1,99);
    pushLog(`Penalty on offense — Holding (-${pen})`);
    tick(10);
    render();
    return;
  }
  const roll = roll3d6();
  const table = card.tables?.[playType] || [];
  const res = parseResult(lookup(table, roll));
  let desc = `${card.name} ${playType} roll ${roll}`;

  tick(res.incomplete?0:30);

  if(playType==='punt'){
    const net=Math.max(30,res.yards||40);
    state.yardLine=clamp(state.yardLine-net,1,99);
    changePossession();
    pushLog(desc+` — punt ${net} yds`);
    render(); return;
  }
  if(playType==='fieldGoal'){
    const mod=(state.yardLine>60?-2:1);
    const made=(res.yards||0)+mod>=3;
    if(made){ if(state.possession==='home') state.homeScore+=3; else state.awayScore+=3; pushLog(desc+' — FG GOOD'); startKickoff(state.possession); }
    else { pushLog(desc+' — FG NO GOOD'); changePossession(); state.yardLine=25; }
    render(); return;
  }

  if(res.td){
    pushLog(desc+' — TOUCHDOWN!');
    if(state.possession==='home') state.homeScore+=6; else state.awayScore+=6;
    state.pendingPAT=true; state.scoringTeam=state.possession;
    render(); return;
  }
  if(res.turnover){
    pushLog(desc+` — ${res.turnover}`);
    changePossession(); render(); return;
  }
  if(res.incomplete){
    pushLog(desc+' — incomplete');
    if(state.down===4){ pushLog('Turnover on downs'); changePossession(); }
    else { state.down+=1; }
    render(); return;
  }

  const gain=res.yards||0;
  state.yardLine=clamp(state.yardLine+gain,1,99);
  if(gain>=state.distance){ pushLog(desc+` — gain ${gain} (First down)`); firstDown(); }
  else {
    state.distance-=Math.max(0,gain);
    if(state.down===4){ pushLog(desc+` — gain ${gain} (Turnover on downs)`); changePossession(); }
    else { state.down+=1; pushLog(desc+` — gain ${gain} (${state.down} & ${state.distance})`); }
  }
  render();
}

// Wire buttons
document.querySelectorAll('.btns button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(state.pendingPAT){ pushLog('Complete the Extra Point first.'); return; }
    const play=btn.dataset.play;
    const offense = state.possession==='home'?state.home:state.away;
    const card = (play==='shortPass'||play==='longPass') ? offense.QB : offense.RB;
    if(!card){ pushLog('No player card available for this play.'); return; }
    applyPlay(card, play);
  });
});

// Show player card modal when clicking names
[qbName, rbName].forEach(el=>{
  el.style.textDecoration='underline';
  el.style.cursor='pointer';
  el.addEventListener('click', ()=>{
    const isQB = el===qbName;
    const offense = state.possession==='home'?state.home:state.away;
    const card = isQB ? offense.QB : offense.RB;
    if(!card){ pushLog('No player card available.'); return; }
    openCardModal(card);
  });
});

function openCardModal(card){
  cardPlayerName.textContent = card.name;
  cardModal.classList.add('show');
  renderCardGrid(card, cardPlayType.value);
}
closeCard.addEventListener('click', ()=> cardModal.classList.remove('show'));
cardPlayType.addEventListener('change', ()=>{
  const offense = state.possession==='home'?state.home:state.away;
  const isPass = cardPlayType.value==='shortPass'||cardPlayType.value==='longPass';
  const card = isPass ? offense.QB : offense.RB;
  if(card) renderCardGrid(card, cardPlayType.value);
});

function renderCardGrid(card, playType){
  const table = (card.tables && card.tables[playType]) || [];
  // Build Strat-like 3-18 rows with min/max merged
  const rows = [];
  for(let total=3; total<=18; total++){
    const r = table.find(x=> total>=x.min && total<=x.max);
    rows.push({roll: total, result: r ? r.result : ''});
  }
  let html = '<thead><tr><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>14</th><th>15</th><th>16</th><th>17</th><th>18</th></tr></thead><tbody><tr>';
  html += rows.map(r=>`<td>${r.result||'—'}</td>`).join('');
  html += '</tr></tbody>';
  cardGrid.innerHTML = html;
}

// PAT
kickPatBtn.addEventListener('click', ()=>{
  if(!state.pendingPAT) return;
  const good=Math.random()<0.95;
  if(good){ if(state.scoringTeam==='home') state.homeScore+=1; else state.awayScore+=1; pushLog('PAT — GOOD'); }
  else pushLog('PAT — NO GOOD');
  state.pendingPAT=false;
  startKickoff(state.scoringTeam);
  render();
});
twoPtBtn.addEventListener('click', ()=>{
  if(!state.pendingPAT) return;
  const good=Math.random()<0.45;
  if(good){ if(state.scoringTeam==='home') state.homeScore+=2; else state.awayScore+=2; pushLog('Two-point try — SUCCESS'); }
  else pushLog('Two-point try — FAILED');
  state.pendingPAT=false;
  startKickoff(state.scoringTeam);
  render();
});

// Start game
startBtn.addEventListener('click', ()=>{
  const h=homeSel.value, a=awaySel.value;
  state.home = { id:h, roster: teams[h] || null };
  state.away = { id:a, roster: teams[a] || null };
  state.homeScore=0; state.awayScore=0;
  state.quarter=1; state.clock=15*60; state.possession='home';
  state.down=1; state.distance=10; state.yardLine=25; state.log=[];
  state.pendingPAT=false; state.scoringTeam=null;
  // Map players
  const hQB=state.home.roster?.offense?.QB, hRB=state.home.roster?.offense?.RB;
  const aQB=state.away.roster?.offense?.QB, aRB=state.away.roster?.offense?.RB;
  state.home.QB = hQB? (cardById[hQB]||makeFallbackCard(h,'QB')) : makeFallbackCard(h,'QB');
  state.home.RB = hRB? (cardById[hRB]||makeFallbackCard(h,'RB')) : makeFallbackCard(h,'RB');
  state.away.QB = aQB? (cardById[aQB]||makeFallbackCard(a,'QB')) : makeFallbackCard(a,'QB');
  state.away.RB = aRB? (cardById[aRB]||makeFallbackCard(a,'RB')) : makeFallbackCard(a,'RB');
  qbName.textContent = (state.home.QB?.name || '—') + ' / ' + (state.away.QB?.name || '—');
  rbName.textContent = (state.home.RB?.name || '—') + ' / ' + (state.away.RB?.name || '—');
  setup.classList.add('hidden'); game.classList.remove('hidden');
  render();
});


// Attach hover handlers to show card on hover
try{
  [qbName, rbName].forEach(el=>{
    el.style.textDecoration='underline'; el.style.cursor='pointer';
    el.addEventListener('mouseenter', (ev)=>{
      const isQB = el===qbName;
      const offense = state.possession==='home'?state.home:state.away;
      const card = isQB ? (offense.QB||makeFallbackCard(offense.id,'QB')) : (offense.RB||makeFallbackCard(offense.id,'RB'));
      if(!card) return;
      openCardModal(card);
      const rect = el.getBoundingClientRect(); const modal = document.getElementById('cardModal');
      modal.style.top = (rect.top + window.scrollY + 10) + 'px';
      modal.style.left = (rect.left + window.scrollX + (isQB?50:-350)) + 'px';
      modal.classList.add('show');
    });
    el.addEventListener('mouseleave', ()=>{ const modal = document.getElementById('cardModal'); if(modal) modal.classList.remove('show'); });
  });
}catch(e){ console.warn('Hover attach failed', e); }
// Admin modal
adminBtn.addEventListener('click', ()=> adminModal.classList.add('show'));
closeAdmin.addEventListener('click', ()=> adminModal.classList.remove('show'));

adminLoginBtn.addEventListener('click', ()=>{
  const user=adminUser.value.trim();
  const pass=adminPass.value;
  if(user==='JNWILLIS' && pass==='Duke2010!'){
    adminLogin.style.display='none';
    adminPanel.style.display='block';
    // Populate players
    adminPlayer.innerHTML = cards.map(c=>`<option value="${c.id}">${c.id} — ${c.name}</option>`).join('');
    const first = cards[0];
    adminPlayerName.value = first.name;
    adminTables.value = JSON.stringify(first.tables, null, 2);
  }else{
    alert('Invalid credentials');
  }
});

adminPlayer.addEventListener('change', ()=>{
  const id=adminPlayer.value;
  const c = cards.find(x=>x.id===id);
  if(!c) return;
  adminPlayerName.value = c.name;
  adminTables.value = JSON.stringify(c.tables, null, 2);
});

adminSave.addEventListener('click', ()=>{
  try{
    const id=adminPlayer.value;
    const c = cards.find(x=>x.id===id);
    if(!c) return;
    c.name = adminPlayerName.value.trim() || c.name;
    c.tables = JSON.parse(adminTables.value);
    // persist override set
    localStorage.setItem('cardsOverride', JSON.stringify(cards));
    alert('Saved locally (this browser). Re-export to commit changes.');
    // refresh runtime map
    Object.assign(cardById, Object.fromEntries(cards.map(c=>[c.id,c])));
  }catch(e){
    alert('Invalid JSON in tables: '+e.message);
  }
});

adminExport.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(cards, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sample-cards.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
