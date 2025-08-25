
const $ = (sel)=>document.querySelector(sel);
const el = (tag, attrs={}, ...kids)=>{
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k==='class') n.className=v;
    else if(k==='html') n.innerHTML=v;
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.substring(2), v);
    else n.setAttribute(k, v);
  });
  kids.forEach(k=> typeof k==='string' ? n.appendChild(document.createTextNode(k)) : (k && n.appendChild(k)));
  return n;
};

const state = {
  teams: [],
  cards: [],
  user: null,
  cpu: null,
  possession: 'USER',
  yard: 25,
  down: 1,
  toGo: 10,
  quarter: 1,
  clock: 15*60,
  score: { USER:0, CPU:0 },
  log: []
};

async function loadData(){
  const [teams, cards] = await Promise.all([
    fetch('data/2008/team-meta.json').then(r=>r.json()),
    fetch('data/2008/sample-cards.json').then(r=>r.json())
  ]);
  state.teams = teams;
  state.cards = cards;
  populateSelects();
}

function populateSelects(){
  const u = $('#userTeam'), c = $('#cpuTeam');
  state.teams.forEach(t=>{
    const opt1 = el('option', { value:t.abbr }, `${t.abbr} — ${t.name}`);
    const opt2 = el('option', { value:t.abbr }, `${t.abbr} — ${t.name}`);
    u.appendChild(opt1); c.appendChild(opt2);
  });
  u.value = 'NYG'; c.value = 'DAL';
}

function startGame(){
  const userAbbr = $('#userTeam').value;
  const cpuAbbr = $('#cpuTeam').value;
  if(userAbbr===cpuAbbr){ alert('Pick different teams'); return; }
  state.user = state.teams.find(t=>t.abbr===userAbbr);
  state.cpu = state.teams.find(t=>t.abbr===cpuAbbr);
  $('#setup').classList.add('hidden');
  $('#game').classList.remove('hidden');
  $('#homeLogo').src = state.user.logo;
  $('#homeName').textContent = state.user.name;
  $('#homeAbbr').textContent = state.user.abbr;
  $('#awayLogo').src = state.cpu.logo;
  $('#awayName').textContent = state.cpu.name;
  $('#awayAbbr').textContent = state.cpu.abbr;
  resetDrive('USER', true);
  renderPlays();
  pushLog(`Kickoff: ${state.user.abbr} receives at the 25.`);
}

function resetDrive(pos, kickoff=false){
  state.possession = pos;
  state.down = 1; state.toGo = 10;
  state.yard = kickoff ? 25 : state.yard;
  updateField();
  updateBadges();
}

function updateField(){
  const x = Math.min(99, Math.max(1, state.yard));
  $('#ball').style.left = `${x}%`;
  $('#downDist').textContent = `${['1st','2nd','3rd','4th'][state.down-1]} & ${state.toGo} @ ${Math.round(state.yard)}`;
  $('#homeScore').textContent = state.score.USER;
  $('#awayScore').textContent = state.score.CPU;
}

function updateBadges(){
  $('#posBadge').textContent = (state.possession==='USER'?'USER':'CPU') + ' ball';
  if(state.possession==='USER'){
    $('#playsTitle').textContent = 'Your Offense';
    $('#offense').classList.remove('hidden');
    $('#defense').classList.add('hidden');
  } else {
    $('#playsTitle').textContent = 'Your Defense';
    $('#offense').classList.add('hidden');
    $('#defense').classList.remove('hidden');
  }
}

function pushLog(msg){
  state.log.push(msg);
  const row = el('div', {}, msg);
  const log = $('#log'); log.appendChild(row); log.scrollTop = log.scrollHeight;
}

function dice(){ return Math.floor(Math.random()*100)+1; }

function getTables(teamAbbr, pos){
  // pick a representative card by position
  const pool = state.cards.filter(c=> c.teamId===teamAbbr && c.position===pos);
  if(pool.length) return pool[0].tables;
  // fallback to any card
  return (state.cards[0]||{}).tables || {};
}

function resolveFromTable(tables, playType, roll){
  const band = (tables[playType]||[]).find(r=> roll>=r.min && roll<=r.max);
  if(!band) return { yards: 0, note: 'no result' };
  const m = /^([a-z]+):(-?\d+)(?:,(.*))?$/.exec(band.result);
  if(!m) return { yards: 0, note: band.result };
  const kind = m[1], val = parseInt(m[2],10);
  switch(kind){
    case 'gain': return { yards: val };
    case 'sack': return { yards: -val, note: 'sacked' };
    case 'int': return { yards: -val, note: 'intercepted', turnover:true };
    case 'td': return { yards: val, td:true };
    case 'pen': return { yards: 0, pen: m[3]||'penalty' };
    default: return { yards: 0, note: band.result };
  }
}

function advance(y){
  state.yard += y;
  state.toGo -= y;
  if(state.yard>=100){
    state.score[state.possession==='USER'?'USER':'CPU'] += 7;
    pushLog(`TOUCHDOWN ${state.possession==='USER'?state.user.abbr:state.cpu.abbr}!`);
    kickoffNext();
    return true;
  }
  if(state.toGo<=0){ state.down=1; state.toGo=10; pushLog('First down.'); }
  else { state.down++; }
  if(state.down>4){
    pushLog('Turnover on downs.');
    state.possession = (state.possession==='USER'?'CPU':'USER');
    state.yard = 25; state.down=1; state.toGo=10;
  }
  return false;
}

function kickoffNext(){
  state.yard = 25; state.down=1; state.toGo=10;
  state.possession = (state.possession==='USER'?'CPU':'USER');
  updateField(); updateBadges(); renderPlays();
  pushLog(`Kickoff: ${state.possession==='USER'?state.user.abbr:state.cpu.abbr} ball at 25.`);
}

function doPunt(){
  const net = 35 + Math.floor(Math.random()*20); // rough net
  state.yard += net;
  if(state.yard>=100){ state.yard = 20; } // touchback
  state.possession = (state.possession==='USER'?'CPU':'USER');
  state.down=1; state.toGo=10;
  updateField(); updateBadges(); renderPlays();
  pushLog(`Punt of ${net} yards. ${state.possession==='USER'?state.user.abbr:state.cpu.abbr} ball.`);
}

function doFieldGoal(){
  const dist = 100 - state.yard + 17; // end zone + snap distance
  const make = dist <= 50 ? 0.85 : dist <= 57 ? 0.65 : 0.35;
  const good = Math.random() < make;
  if(good){
    state.score[state.possession==='USER'?'USER':'CPU'] += 3;
    pushLog(`Field goal good from ${dist} yards.`);
    kickoffNext();
  } else {
    pushLog(`Field goal missed from ${dist} yards.`);
    state.possession = (state.possession==='USER'?'CPU':'USER');
    state.yard = 100 - dist; // spot of kick
    state.down=1; state.toGo=10;
  }
}

function callCPUDefense(){
  const r = Math.random();
  if(r<0.4) return 'insideRun';
  if(r<0.6) return 'outsideRun';
  if(r<0.85) return 'shortPass';
  return 'longPass';
}

function runOffense(playType){
  const offenseTables = getTables(state.possession==='USER'?state.user.abbr:state.cpu.abbr, playType.includes('Pass')?'QB':'RB');
  const roll = dice();
  const res = resolveFromTable(offenseTables, playType, roll);
  let desc = `${playType} roll ${roll}: `;
  if(res.td){ desc += 'TD!'; }
  else if(res.turnover){ desc += `Turnover (${res.note||''}).`; }
  else if(res.pen){ desc += res.pen; }
  else { desc += `${res.yards>=0?'+':''}${res.yards} yards.`; }
  pushLog(desc);
  if(!res.pen){
    let ended = advance(res.yards);
    if(!ended){
      updateField(); updateBadges(); renderPlays();
    } else {
      updateField(); updateBadges(); renderPlays();
    }
  } else {
    // simple 10 yard penalty on offense
    state.yard = Math.max(1, state.yard-10);
    state.toGo += 10;
    updateField(); updateBadges(); renderPlays();
  }
}

function runDefenseResponse(playType){
  // For CPU offense, user clicks a defense button simply to trigger; we keep same outcome logic for now.
  runOffense(playType);
}

function renderPlays(){
  const off = $('#offense'), def = $('#defense');
  off.innerHTML=''; def.innerHTML='';
  const offenseBtns = [
    ['insideRun','assets/ui/btn-run.svg'],
    ['outsideRun','assets/ui/btn-sweep.svg'],
    ['shortPass','assets/ui/btn-pass.svg'],
    ['longPass','assets/ui/btn-bomb.svg']
  ];
  const defenseBtns = [
    ['insideRun','assets/ui/btn-run.svg'],
    ['outsideRun','assets/ui/btn-sweep.svg'],
    ['shortPass','assets/ui/btn-pass.svg'],
    ['longPass','assets/ui/btn-bomb.svg']
  ];

  if(state.possession==='USER'){
    offenseBtns.forEach(([k,src])=>{
      const b = el('button', {'data-play':k, onclick:()=>runOffense(k)}, el('img',{src, alt:k}));
      off.appendChild(b);
    });
    $('#special').classList.remove('hidden');
  } else {
    defenseBtns.forEach(([k,src])=>{
      const b = el('button', {'data-play':k, onclick:()=>runDefenseResponse(k)}, el('img',{src, alt:k}));
      def.appendChild(b);
    });
    $('#special').classList.add('hidden');
  }
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('adminBtn').addEventListener('click', ()=>{
  pushLog('Admin panel not implemented in static demo (will use localStorage edits).');
});
document.querySelector('#special [data-play="punt"]').addEventListener('click', doPunt);
document.querySelector('#special [data-play="fieldGoal"]').addEventListener('click', doFieldGoal);

loadData();


// --- Admin Editor UI ---
function showAdminEditor() {
  const editor = document.createElement('div');
  editor.id = 'admin-editor';
  editor.innerHTML = `
    <div style="background:#fff;padding:1em;border:2px solid #333;max-width:600px;">
      <h3>Admin: Edit Player Cards</h3>
      <textarea id="admin-cards" style="width:100%;height:200px;">${JSON.stringify(window.cards||[],null,2)}</textarea>
      <button id="save-cards">Save</button>
      <button id="close-editor">Close</button>
    </div>`;
  document.body.appendChild(editor);
  document.getElementById('save-cards').onclick = () => {
    try {
      window.cards = JSON.parse(document.getElementById('admin-cards').value);
      alert('Cards updated!');
    } catch(e) {
      alert('Invalid JSON');
    }
  };
  document.getElementById('close-editor').onclick = () => editor.remove();
}
document.getElementById('admin-btn').onclick = showAdminEditor;

// --- Expanded Outcomes ---
function resolvePlay(offense, defense) {
  const roll = Math.random();
  let yards = 0;
  let note = "";
  if (roll < 0.05) {
    note = "Penalty on offense, -10 yards";
    yards = -10;
  } else if (roll < 0.10) {
    note = "Penalty on defense, automatic first down";
    yards = 10;
  } else if (roll < 0.30) {
    yards = Math.floor(Math.random()*3); // short gain
    note = "Stuffed at the line";
  } else if (roll < 0.60) {
    yards = 3 + Math.floor(Math.random()*5);
    note = "Solid gain";
  } else if (roll < 0.85) {
    yards = 8 + Math.floor(Math.random()*12);
    note = "Big play!";
  } else {
    yards = 20 + Math.floor(Math.random()*30);
    note = "Breakaway!";
  }
  return {yards, note};
}
