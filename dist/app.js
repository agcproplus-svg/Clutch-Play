
// Minimal Clutch Play static app (fallback simplified engine). This file shows how cards map to plays, renders strat-style card and uses defense modifiers.
async function loadJSON(path){ const r = await fetch(path); return r.json(); }
const teamMeta = await loadJSON('./data/team-meta.json');
const teams = await loadJSON('./data/sample-teams.json');
const cards = await loadJSON('./data/sample-cards.json');
const cardById = Object.fromEntries(cards.map(c=>[c.id,c]));

document.getElementById('root').innerHTML = `
  <header><div><h1>Clutch Play</h1></div><div><button id="adminBtn">Admin</button></div></header>
  <section id="setup"><label>Home<select id="homeSelect"></select></label><label>Away<select id="awaySelect"></select></label><button id="startBtn">Start Game</button></section>
  <section id="game" style="display:none">
    <div style="display:flex;gap:20px"><div id="homePlayers"></div><div id="field"><img src="./assets/field.svg" style="width:700px"/></div><div id="awayPlayers"></div></div>
    <div id="log"></div>
  </section>
`;

const homeSel = document.getElementById('homeSelect');
const awaySel = document.getElementById('awaySelect');
for(const t of teamMeta){ const o = document.createElement('option'); o.value=t.id; o.textContent = `${t.abbr} - ${t.name}`; homeSel.appendChild(o); const o2 = o.cloneNode(true); awaySel.appendChild(o2); }
homeSel.value='NYG'; awaySel.value='DAL';
const startBtn = document.getElementById('startBtn');
const homePlayers = document.getElementById('homePlayers');
const awayPlayers = document.getElementById('awayPlayers');
const logEl = document.getElementById('log');

function renderPlayers(side, teamId){
  const roster = teams[teamId] || {};
  const qbId = roster?.offense?.QB || null;
  const rbId = roster?.offense?.RB || null;
  const qb = qbId && cardById[qbId] ? cardById[qbId] : cardById['GEN-QB'];
  const rb = rbId && cardById[rbId] ? cardById[rbId] : cardById['GEN-RB'];
  const container = side==='home' ? homePlayers : awayPlayers;
  container.innerHTML = '';
  const qbEl = document.createElement('div'); qbEl.textContent = 'QB: ' + qb.name; qbEl.style.cursor='pointer'; qbEl.dataset.card = qb.id;
  const rbEl = document.createElement('div'); rbEl.textContent = 'RB: ' + rb.name; rbEl.style.cursor='pointer'; rbEl.dataset.card = rb.id;
  container.appendChild(qbEl); container.appendChild(rbEl);

  // hover show strat card
  [qbEl, rbEl].forEach(el=>{
    el.addEventListener('mouseenter', ()=>{
      const id = el.dataset.card; const card = cardById[id]; showStratCard(card, 'insideRun');
    });
    el.addEventListener('mouseleave', ()=>{ hideStratCard(); });
  });
}

function showStratCard(card, playType){
  hideStratCard();
  const div = document.createElement('div'); div.id='stratCard'; div.style.position='absolute'; div.style.background='#032'; div.style.padding='8px'; div.style.border='1px solid #063'; div.style.color='#cff';
  const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(16,38px)'; grid.style.gap='4px';
  for(let r=3;r<=18;r++){ const cell = document.createElement('div'); cell.style.width='36px'; cell.style.height='28px'; cell.style.display='flex'; cell.style.alignItems='center'; cell.style.justifyContent='center'; cell.style.fontSize='12px';
    const tab = (card.tables && card.tables[playType])||[]; const row = tab.find(x=> r>=x.min && r<=x.max); const txt = row?row.result:'—'; cell.textContent = txt; if(txt==='TD') cell.style.background='#0b6'; if(txt==='INT') cell.style.background='#f43'; grid.appendChild(cell); }
  div.appendChild(document.createElement('div')).textContent = card.name + ' — ' + playType;
  div.appendChild(grid); document.body.appendChild(div);
  // position near mouse? center of screen
  div.style.left = (window.innerWidth/2 - 240) + 'px'; div.style.top = '120px';
}
function hideStratCard(){ const s = document.getElementById('stratCard'); if(s) s.remove(); }

startBtn.addEventListener('click', ()=>{
  const h = homeSel.value, a = awaySel.value;
  document.getElementById('setup').style.display='none';
  document.getElementById('game').style.display='block';
  renderPlayers('home', h); renderPlayers('away', a);
  logEl.innerHTML = '<div>Game started: '+h+' vs '+a+'</div>';
});
