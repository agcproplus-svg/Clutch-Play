
// Client-only Strat‑O‑Matic–style web game (2008-based, fan project)
const state = {
  teams: [], players: {},
  userTeam: null, oppTeam: null,
  possession: "user", quarter: 1, clock: 900, down: 1, toGo: 10, yardline: 25,
  score: { user: 0, opp: 0 },
  log: [], auto: false,
};
const $ = (s, el=document)=>el.querySelector(s);

function addLog(msg){
  state.log.push(msg);
  const entry = document.createElement("div");
  entry.className = "entry";
  entry.textContent = msg;
  $("#log").append(entry);
  $("#log").scrollTop = $("#log").scrollHeight;
}

async function loadData(){
  const teams = await fetch("data/teams.json").then(r=>r.json());
  const players = await fetch("data/players.json").then(r=>r.json());
  const saved = JSON.parse(localStorage.getItem("card-tactics-override")||"{}");
  state.teams = teams;
  state.players = {...players, ...(saved.players||{})};
}

function teamById(id){ return state.teams.find(t=>t.id===id); }
function cardUrl(id){ return `assets/cards/${id}.svg`; }
function logoUrl(id){ return `assets/logos/${id}.svg`; }

function renderSetup(){
  const opts = state.teams.map(t=>`<option value="${t.id}">${t.id} — ${t.name} ${t.nickname}</option>`).join("");
  $("#teamSelect").innerHTML = `<label>Your Team</label><select id="userTeam">${opts}</select>`;
  $("#opponentSelect").innerHTML = `<label>Opponent</label><select id="oppTeam">${opts}</select>`;
  $("#userTeam").addEventListener("change", e=>{ state.userTeam = e.target.value; renderRoster(); renderPlays(); renderScore(); });
  $("#oppTeam").addEventListener("change", e=>{ state.oppTeam = e.target.value; renderScore(); });
  state.userTeam = state.teams[0].id;
  state.oppTeam = state.teams[1].id;
  $("#userTeam").value = state.userTeam;
  $("#oppTeam").value = state.oppTeam;
  renderRoster(); renderPlays(); renderScore();
}

function renderRoster(){
  const ps = state.players[state.userTeam]||[];
  const t = teamById(state.userTeam);
  const rosterEl = document.createElement("div");
  rosterEl.innerHTML = ps.map(p=>`
    <div class="roster-card">
      <img src="${cardUrl(p.id)}" alt="${p.name} card"/>
      <div>
        <div><strong>${p.name}</strong> — ${p.pos}</div>
        <div>OVR ${p.ovr} · P ${p.pass} · R ${p.run} · C ${p.catch} · D ${p.def}</div>
      </div>
      <img src="${logoUrl(t.id)}" alt="${t.id}" style="margin-left:auto;width:36px;height:36px;border-radius:8px"/>
    </div>
  `).join("");
  $("#roster").innerHTML = rosterEl.innerHTML;
}

function renderPlays(){
  const roster = state.players[state.userTeam]||[];
  const skill = roster.filter(p=>["RB","WR","TE"].includes(p.pos));
  const qb = roster.find(p=>p.pos==="QB");
  const plays = [
    {id:"inside_run", name:"Inside Run", type:"run"},
    {id:"outside_run", name:"Outside Run", type:"run"},
    {id:"short_pass", name:"Short Pass", type:"pass"},
    {id:"deep_shot", name:"Deep Shot", type:"pass"},
    {id:"screen", name:"Screen", type:"pass"},
    {id:"draw", name:"Draw", type:"run"}
  ];
  const container = document.createElement("div");
  container.className = "card-grid";
  plays.forEach(pl => {
    const targets = pl.type==="run" ? roster.filter(p=>p.pos==="RB") : [...skill];
    (targets.length?targets:skill).slice(0,6).forEach(t => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `<img src="${cardUrl(t.id)}"/><div><div><strong>${pl.name}</strong></div><div class="hint">Target: ${t.name} (${t.pos})</div></div>`;
      el.addEventListener("click", ()=>runPlay(pl,t));
      container.appendChild(el);
    });
  });
  $("#playCards").innerHTML = container.innerHTML;
}

function fmtClock(sec){ const m=Math.floor(sec/60), s=(sec%60).toString().padStart(2,"0"); return `${m}:${s}`; }
function renderScore(){
  const us = teamById(state.userTeam), op = teamById(state.oppTeam);
  $("#scorebar").innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <img src="${logoUrl(us.id)}" style="width:28px;height:28px;border-radius:8px"/><strong>${us.id}</strong> ${state.score.user}
    </div>
    <div>Q${state.quarter} — ${fmtClock(state.clock)} · ${state.down} & ${state.toGo} at ${state.yardline}</div>
    <div style="display:flex;align-items:center;gap:8px">
      <strong>${op.id}</strong> ${state.score.opp}<img src="${logoUrl(op.id)}" style="width:28px;height:28px;border-radius:8px"/>
    </div>`;
}

function advanceClock(){
  state.clock -= 20 + Math.floor(Math.random()*25);
  if(state.clock <= 0){
    state.quarter += 1; state.clock = 900;
    addLog(`-- Start of Q${state.quarter} --`);
    if(state.quarter > 4){ addLog("Final whistle!"); state.auto=false; }
  }
}

function changePossession(){ state.possession = state.possession==="user"?"opp":"user"; state.down=1; state.toGo=10; }

function yardsFromDefense(oppTeamId, playType){
  const defenders = (state.players[oppTeamId]||[]).filter(p=>["S","LB","DL"].includes(p.pos));
  const best = defenders.reduce((a,b)=>(!a||b.def>a.def)?b:a, null);
  const mod = best ? (best.def - 70)/10 : 0;
  const base = playType==="pass" ? -1 : 0;
  return base - Math.max(0, mod);
}

function simulateOutcome(play, target, offTid, defTid){
  const qb = (state.players[offTid]||[]).find(p=>p.pos==="QB");
  const defMod = yardsFromDefense(defTid, play.type);
  let yardage = 0, turnOver=false;
  if(play.type==="run"){
    yardage = Math.round((target.run/10)*(Math.random()*1.4+0.3)+defMod);
    if(Math.random() < target.run/300) yardage += Math.round(10+Math.random()*30);
    if(Math.random() < 0.02) { turnOver=true; addLog(`${target.name} fumbles!`); }
  }else{
    const accuracy = qb ? qb.pass : 60;
    const completed = Math.random() < ((accuracy + target.catch)/220);
    if(completed){
      yardage = Math.round((target.catch/8)*(Math.random()*1.6+0.2)+defMod);
      if(Math.random() < target.catch/400) yardage += Math.round(15+Math.random()*35);
    }else{
      yardage = 0; addLog(`Incomplete to ${target.name}.`);
    }
    if(Math.random() < 0.02){ turnOver=true; addLog(`Intercepted!`); }
  }
  return {yardage, turnOver};
}

function spotBall(yards){
  state.yardline += yards * (state.possession==="user"?1:-1);
  if(state.yardline >= 100){
    if(state.possession==="user"){ state.score.user += 7; addLog("Touchdown! +7"); }
    else { state.score.opp += 7; addLog("Opponent scores! +7"); }
    state.yardline = 25; state.down=1; state.toGo=10; changePossession();
  } else if(state.yardline <= 0){
    if(state.possession==="user"){ state.score.opp += 2; addLog("Safety! Opponent +2"); }
    else { state.score.user += 2; addLog("Safety! +2"); }
    state.yardline = 35; changePossession();
  } else {
    state.toGo -= yards;
    if(state.toGo <= 0){ state.down=1; state.toGo=10; }
    else { state.down += 1; if(state.down>4){ addLog("Turnover on downs."); changePossession(); } }
  }
}

function runPlay(play, target){
  if(state.quarter>4){ addLog("Game over. Start a new game."); return; }
  const off = state.possession==="user" ? state.userTeam : state.oppTeam;
  const def = state.possession==="user" ? state.oppTeam : state.userTeam;
  const out = simulateOutcome(play, target, off, def);
  if(out.yardage>0) addLog(`${play.name} to ${target.name} for +${out.yardage} yards.`);
  if(out.yardage===0 && play.type==="run") addLog(`${play.name} to ${target.name} for no gain.`);
  spotBall(out.yardage);
  if(out.turnOver) changePossession();
  advanceClock();
  renderScore();
  if(state.possession==="opp"){ aiTurn(); }
}

function aiChoosePlay(teamId){
  const roster = state.players[teamId]||[];
  const rb = roster.filter(p=>p.pos==="RB");
  const wrte = roster.filter(p=>["WR","TE"].includes(p.pos));
  const qb = roster.find(p=>p.pos==="QB");
  const isPass = Math.random() < 0.55;
  if(isPass && wrte.length){
    const target = wrte[Math.floor(Math.random()*wrte.length)];
    return [{id:"short_pass",name:"Short Pass",type:"pass"}, target];
  }else if(rb.length){
    const target = rb[Math.floor(Math.random()*rb.length)];
    return [{id:"inside_run",name:"Inside Run",type:"run"}, target];
  }else if(qb){
    return [{id:"screen",name:"Screen",type:"pass"}, qb];
  }
  return [{id:"draw",name:"Draw",type:"run"}, roster[0]];
}

function aiTurn(){
  if(state.quarter>4 || state.possession!=="opp") return;
  const [pl, target] = aiChoosePlay(state.oppTeam);
  setTimeout(()=>runPlay(pl,target), 350);
}

function newGame(){
  state.possession="user"; state.quarter=1; state.clock=900; state.down=1; state.toGo=10; state.yardline=25;
  state.score={user:0,opp:0};
  $("#log").innerHTML="";
  addLog(`KICKOFF — ${teamById(state.userTeam).id} vs ${teamById(state.oppTeam).id}`);
  renderScore();
}

function bindUI(){
  $("#newGameBtn").addEventListener("click", newGame);
  $("#autoBtn").addEventListener("click", ()=>{
    state.auto = !state.auto;
    $("#autoBtn").textContent = state.auto ? "Stop Auto" : "Auto Next";
    if(state.auto){
      const loop = ()=>{
        if(!state.auto) return;
        const roster = state.players[state.userTeam]||[];
        const skill = roster.filter(p=>["WR","TE","RB"].includes(p.pos));
        if(skill.length){
          const target = skill[Math.floor(Math.random()*skill.length)];
          const play = Math.random()<0.5?{id:"inside_run",name:"Inside Run",type:"run"}:{id:"short_pass",name:"Short Pass",type:"pass"};
          runPlay(play, target);
        }
        setTimeout(loop, 700);
      };
      loop();
    }
  });

  // Admin
  const adminModal = document.querySelector("#adminModal");
  document.querySelector("#adminBtn").addEventListener("click", ()=>adminModal.showModal());
  const teamSel = document.querySelector("#adminTeam");
  teamSel.innerHTML = state.teams.map(t=>`<option value="${t.id}">${t.id}</option>`).join("");
  teamSel.addEventListener("change", populateAdminPlayers);
  document.querySelector("#savePlayer").addEventListener("click", saveAdminEdits);
  document.querySelector("#exportData").addEventListener("click", exportData);
  document.querySelector("#importData").addEventListener("change", importData);
  populateAdminPlayers();
}

function populateAdminPlayers(){
  const tid = document.querySelector("#adminTeam").value || state.teams[0].id;
  const plist = state.players[tid]||[];
  const playerSel = document.querySelector("#adminPlayer");
  playerSel.innerHTML = plist.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");
  playerSel.addEventListener("change", fillEditor, {once:true});
  fillEditor();
}

function fillEditor(){
  const tid = document.querySelector("#adminTeam").value;
  const pid = document.querySelector("#adminPlayer").value;
  const p = (state.players[tid]||[]).find(x=>x.id===pid);
  if(!p) return;
  document.querySelector("#adminPos").value = p.pos;
  document.querySelector("#adminOvr").value = p.ovr;
  document.querySelector("#adminPass").value = p.pass;
  document.querySelector("#adminRun").value = p.run;
  document.querySelector("#adminCatch").value = p.catch;
  document.querySelector("#adminDef").value = p.def;
}

function saveAdminEdits(){
  const tid = document.querySelector("#adminTeam").value;
  const pid = document.querySelector("#adminPlayer").value;
  const plist = state.players[tid]||[];
  const idx = plist.findIndex(x=>x.id===pid);
  if(idx===-1) return;
  const p = {...plist[idx]};
  p.pos = document.querySelector("#adminPos").value;
  p.ovr = +document.querySelector("#adminOvr").value;
  p.pass = +document.querySelector("#adminPass").value;
  p.run  = +document.querySelector("#adminRun").value;
  p.catch= +document.querySelector("#adminCatch").value;
  p.def  = +document.querySelector("#adminDef").value;
  plist[idx]=p; state.players[tid]=plist;
  const override = JSON.parse(localStorage.getItem("card-tactics-override")||"{}");
  override.players = {...override.players, [tid]: plist};
  localStorage.setItem("card-tactics-override", JSON.stringify(override));
  addLog(`Saved edits for ${p.name}.`);
}

function exportData(){
  const data = { teams: state.teams, players: state.players };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="card-tactics-data.json"; a.click();
  URL.revokeObjectURL(url);
}

function importData(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(data.players){ state.players = data.players; addLog("Imported player data."); }
    }catch{ alert("Invalid JSON"); }
  };
  reader.readAsText(file);
}

async function init(){ await loadData(); renderSetup(); bindUI(); newGame(); }
init();
