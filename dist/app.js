
async function loadJSON(url){ const r = await fetch(url); return r.json(); }
const teamMeta = await loadJSON('./data/team-meta.json');
const teams = await loadJSON('./data/sample-teams.json');
const cards = await loadJSON('./data/sample-cards.json');
const cardById = Object.fromEntries(cards.map(c=>[c.id,c]));

// DOM
const homeSel = document.getElementById('homeSelect');
const awaySel = document.getElementById('awaySelect');
const startBtn = document.getElementById('startBtn');
const setup = document.getElementById('setup');
const game = document.getElementById('game');
const logEl = document.getElementById('log');
const ballMarker = document.getElementById('ballMarker');

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

// Populate dropdowns (all 32 teams)
teamMeta.forEach(t=>{
  const o1 = document.createElement('option'); o1.value = t.id; o1.textContent = `${t.abbr} — ${t.name}`; homeSel.appendChild(o1);
  const o2 = document.createElement('option'); o2.value = t.id; o2.textContent = `${t.abbr} — ${t.name}`; awaySel.appendChild(o2);
});
homeSel.value = 'NYG'; awaySel.value = 'DAL';
function syncLogos(){
  const h = teamMeta.find(x=>x.id===homeSel.value); const a = teamMeta.find(x=>x.id===awaySel.value);
  if(h){ homeLogo.src = h.logo; hLogo.src = h.logo; hAbbr.textContent = h.abbr; }
  if(a){ awayLogo.src = a.logo; aLogo.src = a.logo; aAbbr.textContent = a.abbr; }
}
homeSel.addEventListener('change', syncLogos);
awaySel.addEventListener('change', syncLogos);
syncLogos();

// Dice + helpers
function rollD6(){ return Math.floor(Math.random()*6)+1; }
function roll3d6(){ return rollD6()+rollD6()+rollD6(); }
function lookup(table, roll){ return table.find(r => roll>=r.min && roll<=r.max)?.result || 'INC'; }
function parseResult(res){
  if(res==='TD') return {yards:100, td:true};
  if(res==='INT') return {yards:0, turnover:'INT'};
  if(res==='FUM') return {yards:0, turnover:'FUM'};
  if(res==='INC') return {yards:0, incomplete:true};
  if(res.startsWith('SACK:')) return {yards:parseInt(res.split(':')[1],10)};
  if(res.startsWith('gain:')) return {yards:parseInt(res.split(':')[1],10)};
  return {yards:0};
}
function fmtTime(s){ const m = String(Math.floor(s/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return `${m}:${ss}`; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function pushLog(msg){ state.log.unshift(msg); renderLog(); }

// Kickoff/return simple tables
function kickoffDistance(){ // typical 60-75 yd
  const r = roll3d6();
  if(r<=7) return 55;
  if(r<=10) return 60;
  if(r<=13) return 65;
  if(r<=15) return 70;
  return 75;
}
function returnYards(){ // 0-35 with occasional break
  const r = roll3d6();
  if(r<=6) return 0;
  if(r<=8) return 5;
  if(r<=10) return 10;
  if(r<=12) return 15;
  if(r<=14) return 20;
  if(r<=16) return 30;
  return 50; // big return
}

// State
const state = {
  home:null, away:null, homeScore:0, awayScore:0,
  quarter:1, clock:15*60, possession:'home',
  down:1, distance:10, yardLine:25, log:[],
  pendingPAT:false, scoringTeam:null
};

function tick(secs){ state.clock = Math.max(0, state.clock - secs); if(state.clock===0){ if(state.quarter<4){ state.quarter+=1; state.clock=15*60; } } }
function firstDown(){ state.down=1; state.distance=10; }
function changePossession(){ state.possession = state.possession==='home'?'away':'home'; firstDown(); }
function renderBallMarker(){
  // Field image is 900x? inside card; position using percentage along inner rect; rough scale using yardLine 1..99
  const pct = (state.yardLine/99); // 0..1
  ballMarker.style.left = (5 + 90*pct) + '%'; // approximate lane inside white border
}
function render(){
  qtrEl.textContent = `Q${state.quarter}`;
  clockEl.textContent = fmtTime(state.clock);
  possEl.textContent = `Poss: ${state.possession}`;
  downEl.textContent = `${state.down} & ${state.distance}`;
  yardEl.textContent = `Ball: ${state.yardLine}`;
  hScore.textContent = state.homeScore;
  aScore.textContent = state.awayScore;
  renderBallMarker();
  // PAT buttons
  kickPatBtn.disabled = !state.pendingPAT;
  twoPtBtn.disabled = !state.pendingPAT;
}
function renderLog(){ logEl.innerHTML = state.log.map(x=>`<div>${x}</div>`).join(''); }

function startKickoff(kicking){ // kicking: 'home' | 'away'
  // Ball at 35, kick downfield
  const kick = kickoffDistance();
  const receiving = kicking==='home' ? 'away' : 'home';
  let spot = 35 + kick; // from kicking team's 35 going towards opponent goal
  // Convert to offense perspective: start new drive for receiving team
  state.possession = receiving;
  // Compute starting yardLine from receiving offense perspective:
  // kickoff that goes into EZ (>= 100) becomes touchback at 25
  if(spot >= 100){
    state.yardLine = 25;
    pushLog(`${kicking} kickoff touchback`);
  } else {
    // Return from spot: translate to receiving perspective yardLine ~ (100 - spot)
    let yd = Math.max(1, 100 - spot);
    const ret = returnYards();
    yd = clamp(yd + ret, 1, 99);
    state.yardLine = yd;
    pushLog(`${kicking} kickoff to ${100-spot}, return ${ret} yds`);
  }
  firstDown();
  tick(6);
  render();
}

// Core play application
function applyPlay(card, playType){
  // 10% penalty chance (5 yd offensive holding on run/pass, auto 1st down for defense not modeled)
  if(Math.random() < 0.10 && (playType!=='punt' && playType!=='fieldGoal')){
    const penYds = 10;
    state.yardLine = clamp(state.yardLine - penYds, 1, 99);
    // Repeat down unless it was 3rd/4th? For simplicity, replay the down (do not advance)
    pushLog(`Penalty on offense — Holding (-${penYds})`);
    tick(10);
    render();
    return;
  }

  const roll = roll3d6();
  const table = card.tables[playType] || [];
  const res = parseResult(lookup(table, roll));
  let desc = `${card.name} ${playType} roll ${roll}`;

  // Clock
  tick(res.incomplete ? 0 : 30);

  if(playType==='punt'){
    const net = Math.max(30, res.yards||40);
    state.yardLine = clamp(state.yardLine - net, 1, 99);
    changePossession();
    pushLog(desc + ` — punt ${net} yds`);
    render();
    return;
  }
  if(playType==='fieldGoal'){
    // Use res.yards as "accuracy" gate (>=3 good, else miss). Tie to yardLine: < 45-yard attempt gets +1
    const mod = (state.yardLine > 60 ? -2 : 1);
    const made = (res.yards||0) + mod >= 3;
    if(made){
      if(state.possession==='home') state.homeScore += 3; else state.awayScore += 3;
      pushLog(desc + ' — FG GOOD');
      startKickoff(state.possession); // scoring team kicks
    } else {
      pushLog(desc + ' — FG NO GOOD');
      changePossession();
      state.yardLine = 25;
    }
    render();
    return;
  }

  // Regular plays
  if(res.td){
    pushLog(desc + ' — TOUCHDOWN!');
    if(state.possession==='home') state.homeScore += 6; else state.awayScore += 6;
    state.pendingPAT = true;
    state.scoringTeam = state.possession;
    render();
    return;
  }
  if(res.turnover){
    pushLog(desc + ` — ${res.turnover}`);
    changePossession();
    render();
    return;
  }
  if(res.incomplete){
    pushLog(desc + ' — incomplete');
    // downs
    if(state.down===4){
      pushLog('Turnover on downs');
      changePossession();
    } else {
      state.down += 1;
    }
    render();
    return;
  }

  // Yardage gain
  const gain = res.yards||0;
  state.yardLine = clamp(state.yardLine + gain, 1, 99);
  if(gain >= state.distance){
    pushLog(desc + ` — gain ${gain} (First down)`);
    firstDown();
  } else {
    state.distance -= Math.max(0,gain);
    if(state.down===4){
      pushLog(desc + ` — gain ${gain} (Turnover on downs)`);
      changePossession();
    } else {
      state.down += 1;
      pushLog(desc + ` — gain ${gain} (${state.down} & ${state.distance})`);
    }
  }
  render();
}

// PAT handlers
kickPatBtn.addEventListener('click', ()=>{
  if(!state.pendingPAT) return;
  // Simple PAT: 95% good
  const good = Math.random() < 0.95;
  if(good){
    if(state.scoringTeam==='home') state.homeScore += 1; else state.awayScore += 1;
    pushLog('PAT — GOOD');
  } else {
    pushLog('PAT — NO GOOD');
  }
  state.pendingPAT = false;
  // kickoff by scoring team
  startKickoff(state.scoringTeam);
  render();
});
twoPtBtn.addEventListener('click', ()=>{
  if(!state.pendingPAT) return;
  // 45% success
  const good = Math.random() < 0.45;
  if(good){
    if(state.scoringTeam==='home') state.homeScore += 2; else state.awayScore += 2;
    pushLog('Two-point try — SUCCESS');
  } else {
    pushLog('Two-point try — FAILED');
  }
  state.pendingPAT = false;
  startKickoff(state.scoringTeam);
  render();
});

// Wire play buttons
document.querySelectorAll('.btns button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(state.pendingPAT){ pushLog('Complete the Extra Point first.'); return; }
    const play = btn.dataset.play;
    const offense = state.possession==='home' ? state.home : state.away;
    const card = (play==='shortPass' || play==='longPass') ? offense.QB : offense.RB;
    if(!card){ pushLog('No player card available for this play.'); return; }
    applyPlay(card, play);
  });
});

// Start button
startBtn.addEventListener('click', ()=>{
  const h = homeSel.value, a = awaySel.value;
  state.home = { id:h, roster: teams[h] || null };
  state.away = { id:a, roster: teams[a] || null };
  state.homeScore = state.awayScore = 0;
  state.quarter = 1; state.clock = 15*60; state.possession='home';
  state.down=1; state.distance=10; state.yardLine=25; state.log=[];
  state.pendingPAT = false; state.scoringTeam = null;
  const hQB = state.home.roster?.offense?.QB || null;
  const hRB = state.home.roster?.offense?.RB || null;
  const aQB = state.away.roster?.offense?.QB || null;
  const aRB = state.away.roster?.offense?.RB || null;
  state.home.QB = hQB? cardById[hQB]: null;
  state.home.RB = hRB? cardById[hRB]: null;
  state.away.QB = aQB? cardById[aQB]: null;
  state.away.RB = aRB? cardById[aRB]: null;
  qbName.textContent = (state.home.QB?.name || '—') + ' / ' + (state.away.QB?.name || '—');
  rbName.textContent = (state.home.RB?.name || '—') + ' / ' + (state.away.RB?.name || '—');
  setup.classList.add('hidden'); game.classList.remove('hidden');
  render();
});
