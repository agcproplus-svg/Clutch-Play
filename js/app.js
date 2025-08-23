
// Enhanced: offense vs defense play interaction + field graphic + dice engine
const state = {
  teams: [], players: {},
  userTeam: null, oppTeam: null,
  possession: "user", // "user" or "opp"
  quarter: 1, clock: 900, down: 1, toGo: 10, yardline: 25, // yardline: 0..100 from user's goal line
  score: { user: 0, opp: 0 },
  log: [], auto: false,
  pendingDefenseChoice: null,
};

const $ = (s, el=document)=>el.querySelector(s);

function addLog(msg){
  state.log.push(msg);
  const entry = document.createElement("div");
  entry.className = "entry";
  entry.textContent = msg;
  $("#log").prepend(entry);
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
function rng(n){ return Math.floor(Math.random()*n); }
function rollD6(){ return 1 + rng(6); }
function roll2D6(){ return rollD6() + rollD6(); }

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
  renderRoster(); renderPlays(); renderDefensePlays(); renderScore(); renderField(true);
}

function renderRoster(){
  const ps = state.players[state.userTeam]||[];
  const t = teamById(state.userTeam);
  $("#roster").innerHTML = ps.map(p=>`
    <div class="roster-card">
      <img src="${cardUrl(p.id)}" alt="${p.name} card"/>
      <div>
        <div><strong>${p.name}</strong> — ${p.pos}</div>
        <div>OVR ${p.ovr} · P ${p.pass} · R ${p.run} · C ${p.catch} · D ${p.def}</div>
      </div>
      <img src="${logoUrl(t.id)}" alt="${t.id}" style="margin-left:auto;width:36px;height:36px;border-radius:8px"/>
    </div>
  `).join("");
}

const OFF_PLAYS = [
  {id:"inside_run", name:"Inside Run", type:"run", sub:"RB/FB"},
  {id:"outside_run", name:"Outside Run", type:"run", sub:"RB"},
  {id:"screen", name:"Screen Pass", type:"pass", depth:"short"},
  {id:"short_pass", name:"Short Pass", type:"pass", depth:"short"},
  {id:"deep_shot", name:"Deep Shot", type:"pass", depth:"deep"},
  {id:"draw", name:"Draw", type:"run"}
];


// --- Penalties & Special Teams ---

const PENALTIES = {
  offense: [
    {id:"hold", name:"Offensive Holding", yards:10, repeatDown:true, freq:0.03},
    {id:"false_start", name:"False Start", yards:5, repeatDown:true, preSnap:true, freq:0.02},
    {id:"opih", name:"Illegal Hands", yards:10, repeatDown:true, freq:0.005},
  ],
  defense: [
    {id:"offsides", name:"Offside", yards:5, autoFirst:false, freq:0.02},
    {id:"dpi", name:"Defensive Pass Interference", yards:"spot", autoFirst:true, passOnly:true, deepBias:true, freq:0.02},
    {id:"dhold", name:"Defensive Holding", yards:5, autoFirst:true, freq:0.01},
  ]
};

function maybePenalty(offPlay){
  // Roll for pre-snap first
  if(Math.random() < 0.02) return {side:"offense", p:PENALTIES.offense[1]}; // false start
  // In-play penalties
  const pool = [...PENALTIES.offense.filter(p=>!p.preSnap), ...PENALTIES.defense];
  for(const p of pool){
    if(p.passOnly && offPlay.type!=="pass") continue;
    if(p.deepBias && offPlay.depth!=="deep" && Math.random()<0.5) continue;
    if(Math.random() < p.freq) return {side: PENALTIES.offense.includes(p)?"offense":"defense", p};
  }
  return null;
}

function applyPenalty(pen, gained, offTid, defTid, offPlay){
  // returns {adjustedGain, repeatDown, autoFirst}
  let adjusted = gained;
  let repeatDown = false;
  let autoFirst = false;
  if(pen.p.yards==="spot"){ // DPI: ball at spot of foul = intended gain + up to deep yardage band
    adjusted = Math.max(adjusted, 10 + rng(25)); // enforce decent gain on DPI
    autoFirst = true; repeatDown = false;
    addLog(`${pen.p.name} — spot foul, automatic first down.`);
  }else{
    const yds = pen.p.yards;
    if(pen.side==="offense"){
      adjusted = Math.max(-yds, gained - yds);
      repeatDown = !!pen.p.repeatDown;
    }else{
      adjusted = gained + yds;
      autoFirst = !!pen.p.autoFirst;
    }
    addLog(`${pen.p.name} — ${pen.side==="offense"?"-": "+"}${yds} yards.`);
  }
  return {adjustedGain:adjusted, repeatDown, autoFirst};
}

// Special teams helpers
function getKicker(teamId){
  const r = state.players[teamId]||[];
  return r.find(p=>p.pos==="K") || {name:"Generic K", kick:75};
}
function getPunter(teamId){
  const r = state.players[teamId]||[];
  return r.find(p=>p.pos==="P") || {name:"Generic P", punt:75};
}

function attemptFieldGoal(){
  const off = state.possession==="user"?state.userTeam:state.oppTeam;
  const k = getKicker(off);
  // distance from current LOS (yardline) toward opponent goal
  const dist = (state.possession==="user" ? (100 - state.yardline) : state.yardline) + 17;
  const base = Math.max(0.1, Math.min(0.95, (k.kick||75)/100 - (dist-35)*0.006));
  const good = Math.random() < base;
  addLog(`${k.name} attempts ${dist}-yard FG — ${good?"GOOD! +3":"No good."}`);
  if(good){
    if(state.possession==="user") state.score.user += 3; else state.score.opp += 3;
    kickoff( state.possession==="user" ? "opp":"user" );
  }else{
    // Miss: ball at spot (or at 20 if deep)
    changePossession();
    state.down=1; state.toGo=10;
  }
  advanceClock(); renderScore();
}

function puntBall(){
  const off = state.possession==="user"?state.userTeam:state.oppTeam;
  const def = state.possession==="user"?state.oppTeam:state.userTeam;
  const p = getPunter(off);
  const base = (p.punt||75);
  const gross = Math.round(35 + (base-60) + rng(25)); // simple model
  const returnChance = Math.random();
  let net = gross;
  if(returnChance>0.4){
    const ret = 5 + rng(25);
    net = Math.max(10, gross - ret);
    addLog(`${p.name} punts ${gross} yards, return ${ret} yards.`);
  }else{
    addLog(`${p.name} punts ${gross} yards, fair catch.`);
  }
  // Move ball: net yards toward opponent when user punts; reverse when opp punts
  state.yardline += (state.possession==="user"?1:-1)*(-net);
  if(state.yardline<5) state.yardline=5
  if(state.yardline>95) state.yardline=95
  changePossession();
  state.down=1; state.toGo=10;
  advanceClock(); renderScore();
}

function kickoff(toSide){
  // toSide: "user" or "opp" to receive
  state.possession = toSide;
  state.down=1; state.toGo=10;
  // Set to receiving 25 with some variability
  const touchback = Math.random()<0.6;
  const start = touchback ? 25 : 20 + rng(25);
  state.yardline = toSide==="user" ? start : (100 - start);
  addLog(`Kickoff${touchback?" — touchback":""}. ${toSide==="user"?"Your ball":"Opponent ball"} at ${start}.`);
}

// Extend UI: add special teams quick cards on offense (Punt/FG)
function renderSpecialTeamsCards(){
  const canFG = (state.possession==="user" && (100 - state.yardline) <= 60) ||
                (state.possession==="opp" && state.yardline <= 60);
  const st = document.createElement("div");
  st.className = "card-grid";
  const puntCard = document.createElement("div");
  puntCard.className = "card";
  puntCard.innerHTML = `<img src="${logoUrl(teamById(state.userTeam).id)}"/><div><div><strong>Punt</strong></div><div class="hint">Flip the field</div></div>`;
  puntCard.addEventListener("click", ()=>puntBall());
  const fgCard = document.createElement("div");
  fgCard.className = "card";
  fgCard.innerHTML = `<img src="${logoUrl(teamById(state.userTeam).id)}"/><div><div><strong>Field Goal</strong></div><div class="hint">Take the points</div></div>`;
  fgCard.addEventListener("click", ()=>attemptFieldGoal());
  st.appendChild(puntCard);
  if(canFG) st.appendChild(fgCard);
  return st.innerHTML;
}
const DEF_PLAYS = [
  {id:"run_blitz", name:"Run Blitz", vs:"run"},
  {id:"run_contain", name:"Run Contain", vs:"run"},
  {id:"pass_zone", name:"Zone Coverage", vs:"pass"},
  {id:"pass_man", name:"Man Coverage", vs:"pass"},
  {id:"prevent", name:"Prevent", vs:"pass"}
];

function renderPlays(){
  const roster = state.players[state.userTeam]||[];
  const skill = roster.filter(p=>["RB","WR","TE"].includes(p.pos));
  const container = document.createElement("div");
  container.className = "card-grid";
  OFF_PLAYS.forEach(pl => {
    const targets = pl.type==="run" ? roster.filter(p=>p.pos==="RB") : [...skill];
    (targets.length?targets:skill).slice(0,6).forEach(t => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `<img src="${cardUrl(t.id)}"/><div><div><strong>${pl.name}</strong></div><div class="hint">Target: ${t.name} (${t.pos})</div></div>`;
      el.addEventListener("click", ()=>userOffenseSelect(pl,t));
      container.appendChild(el);
    });
  });
  // add ST options when appropriate
  if(state.possession==="user" && state.down>=4){
    const st = renderSpecialTeamsCards();
    container.innerHTML += st;
  }
  $("#playCards").innerHTML = container.innerHTML;
  updatePlayCardStates();
}

function renderDefensePlays(){
  const container = document.createElement("div");
  container.className = "card-grid";
  DEF_PLAYS.forEach(pl => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<img src="${logoUrl(teamById(state.oppTeam).id)}"/><div><div><strong>${pl.name}</strong></div><div class="hint">Defense</div></div>`;
    el.addEventListener("click", ()=>userDefenseSelect(pl));
    container.appendChild(el);
  });
  $("#defenseCards").innerHTML = container.innerHTML;
  updatePlayCardStates();
}

function updatePlayCardStates(){
  // If user has ball: offense cards enabled, defense cards disabled
  const offenseEnabled = state.possession==="user";
  document.querySelectorAll("#playCards .card").forEach(el=>{
    el.classList.toggle("disabled", !offenseEnabled);
  });
  // If opponent has ball: defense cards enabled
  const defenseEnabled = state.possession==="opp";
  document.querySelectorAll("#defenseCards .card").forEach(el=>{
    el.classList.toggle("disabled", !defenseEnabled);
  });
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
  updatePlayCardStates();
  renderField();
}

function renderField(first=false){
  // draw yard lines once
  const yl = document.getElementById("yardlines");
  if(first && yl && yl.childElementCount===0){
    for(let i=0;i<=10;i++){
      const x = 50 + i*90;
      const line = document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1", x); line.setAttribute("y1", 20);
      line.setAttribute("x2", x); line.setAttribute("y2", 220);
      line.setAttribute("stroke", "#3b7a4e");
      line.setAttribute("stroke-width", i%5===0?2:1);
      yl.appendChild(line);
      if(i>0 && i<10){
        const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
        txt.setAttribute("x", x-6);
        txt.setAttribute("y", 38);
        txt.setAttribute("fill", "#cfe9d6");
        txt.setAttribute("font-size", "10");
        txt.textContent = (i*10).toString();
        yl.appendChild(txt);
      }
    }
  }
  const x = 50 + (Math.max(0, Math.min(100, state.yardline))) * 9;
  const ball = document.getElementById("ballDot");
  if(ball) ball.setAttribute("cx", x);
}

function advanceClock(){
  state.clock -= 20 + Math.floor(Math.random()*25);
  if(state.clock <= 0){
    state.quarter += 1; state.clock = 900;
    addLog(`-- Start of Q${state.quarter} --`);
    if(state.quarter > 4){ addLog("Final whistle!"); state.auto=false; }
  }
}

function changePossession(){
  state.possession = state.possession==="user"?"opp":"user";
  state.down=1; state.toGo=10;
}

function yardsFromDefense(defTid, playType, defPlay){
  const defenders = (state.players[defTid]||[]).filter(p=>["S","LB","DL"].includes(p.pos));
  const best = defenders.reduce((a,b)=>(!a||b.def>b.def)?b:a, null);
  const base = playType==="pass" ? -1 : 0;
  const skill = best ? (best.def - 70)/10 : 0;
  let vsAdj = 0;
  if(playType==="run"){
    if(defPlay.id==="run_blitz") vsAdj -= 2 + rng(3);
    if(defPlay.id==="run_contain") vsAdj -= 1 + rng(2);
    if(defPlay.id==="pass_zone"||defPlay.id==="pass_man"||defPlay.id==="prevent") vsAdj += 2;
  }else{
    if(defPlay.id==="pass_zone") vsAdj -= 1 + rng(2);
    if(defPlay.id==="pass_man") vsAdj -= 2 + rng(2);
    if(defPlay.id==="prevent") vsAdj -= 3; // deep discouraged
    if(defPlay.id==="run_blitz") vsAdj += 2;
  }
  return base + skill + vsAdj;
}

// Non-infringing, Strat-O-Matic–inspired dice engine:
// Use 2d6 to select outcome band; 1d6 to refine within band.
function outcomeFromDice(play, target, qb, defPlay){
  const roll = roll2D6();
  const sub = rollD6();
  // Base expected yards based on attributes
  const attr = play.type==="run" ? target.run : Math.round((target.catch + (qb?qb.pass:70))/2);
  let yards = 0, complete = true, turnover = false, bigPlay=false;
  if(play.type==="run"){
    const base = Math.round(attr/10);
    if(roll<=4){ yards = rng(3)-1; }             // stuff / loss / no gain
    else if(roll<=6){ yards = Math.max(0, base + rng(3)); }
    else if(roll<=8){ yards = base + 2 + rng(5); }
    else if(roll<=10){ yards = base + 5 + rng(10); }
    else { yards = base + 10 + rng(25); bigPlay=true; }
    if(sub===1 && defPlay.id==="run_blitz" && rng(5)===0) { turnover=true; } // forced fumble chance
  }else{
    const acc = qb?qb.pass:70;
    const catchSkill = target.catch;
    const compChance = (acc + catchSkill)/2/100; // ~0.6–0.95
    complete = Math.random() < compChance * (
      defPlay.id==="pass_man" ? 0.85 :
      defPlay.id==="pass_zone" ? 0.9 :
      defPlay.id==="prevent" && play.depth==="deep" ? 0.7 :
      defPlay.id==="run_blitz" ? 1.05 : 1.0
    );
    if(!complete) { yards = 0; }
    else {
      const base = Math.round((attr)/9);
      if(play.depth==="short"){
        if(roll<=5){ yards = Math.max(0, base + rng(4)); }
        else if(roll<=8){ yards = base + 4 + rng(8); }
        else if(roll<=10){ yards = base + 8 + rng(12); }
        else { yards = base + 15 + rng(25); bigPlay=true; }
      }else{ // deep
        if(roll<=5){ yards = base + 5 + rng(10); }
        else if(roll<=8){ yards = base + 10 + rng(20); }
        else if(roll<=10){ yards = base + 20 + rng(30); bigPlay=true; }
        else { yards = base + 35 + rng(35); bigPlay=true; }
      }
    }
    // INT chance slightly higher in man/zone vs deep
    const intBase = play.depth==="deep" ? 0.05 : 0.02;
    const intMod = defPlay.id==="pass_man" ? 0.02 : defPlay.id==="pass_zone" ? 0.01 : 0;
    if(Math.random() < intBase + intMod){ turnover = true; complete = false; }
  }
  return { yards, complete, turnover, bigPlay, roll, sub };
}

function resolvePlay(offPlay, defPlay, target, offTid, defTid){
  const qb = (state.players[offTid]||[]).find(p=>p.pos==="QB");
  const dice = outcomeFromDice(offPlay, target, qb, defPlay);
  // Apply defensive adjustment
  const defAdj = yardsFromDefense(defTid, offPlay.type, defPlay);
  let yardage = Math.round(dice.yards + defAdj);
  if(offPlay.type==="run" && defPlay.id==="run_blitz" && dice.bigPlay && rng(3)===0){
    yardage += 10 + rng(20); // break through the blitz
  }
  // Floor/ceiling
  if(yardage < -5) yardage = -5;
  if(yardage > 80) yardage = 80;
  return { yardage, turnover: dice.turnover, complete: dice.complete, meta: dice };
}

function spotBall(yards){
  // yards are positive toward user's end zone (yardline 100) regardless of possession
  state.yardline += yards * (state.possession==="user"?1:-1);
  if(state.yardline >= 100){
    if(state.possession==="user"){ state.score.user += 7; addLog("Touchdown! +7"); kickoff("opp"); }
    else { state.score.opp += 7; addLog("Opponent touchdown! +7"); kickoff("user"); }
    return;
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

function userOffenseSelect(play, target){
  if(state.possession!=="user" || state.quarter>4) return;
  const defChoice = aiDefenseChoice();
  runCombined(play, defChoice, target);
}

function userDefenseSelect(defPlay){
  if(state.possession!=="opp" || state.quarter>4) return;
  state.pendingDefenseChoice = defPlay;
  const [pl, target] = aiChoosePlay(state.oppTeam);
  addLog(`Opponent calls ${pl.name}${target?` targeting ${target.name}`:""}. You answered with ${defPlay.name}.`);
  runCombined(pl, defPlay, target);
  state.pendingDefenseChoice = null;
}

function aiDefenseChoice(){
  // Simple situation-aware AI
  const needYds = state.toGo;
  if(needYds >= 10 && rng(2)===0) return DEF_PLAYS.find(p=>p.id==="pass_zone");
  if(needYds <= 2 && rng(3)===0) return DEF_PLAYS.find(p=>p.id==="run_blitz");
  if(Math.random() < 0.4) return DEF_PLAYS.find(p=>p.id==="pass_man");
  return DEF_PLAYS[rng(DEF_PLAYS.length)];
}

function aiChoosePlay(teamId){
  const roster = state.players[teamId]||[];
  const rb = roster.filter(p=>p.pos==="RB");
  const wrte = roster.filter(p=>["WR","TE"].includes(p.pos));
  const qb = roster.find(p=>p.pos==="QB");
  const longYds = state.toGo >= 8;
  const isPass = longYds ? Math.random()<0.7 : Math.random()<0.5;
  if(isPass && wrte.length){
    const deep = Math.random()<(longYds?0.5:0.25);
    const target = wrte[rng(wrte.length)];
    return [deep?OFF_PLAYS.find(p=>p.id==="deep_shot"):OFF_PLAYS.find(p=>p.id==="short_pass"), target];
  }else if(rb.length){
    const outside = Math.random()<0.5;
    const target = rb[rng(rb.length)];
    return [outside?OFF_PLAYS.find(p=>p.id==="outside_run"):OFF_PLAYS.find(p=>p.id==="inside_run"), target];
  }else if(qb){
    return [OFF_PLAYS.find(p=>p.id==="screen"), qb];
  }
  return [OFF_PLAYS.find(p=>p.id==="draw"), roster[0]];
}

function runCombined(offPlay, defPlay, target){
  if(state.quarter>4){ addLog("Game over. Start a new game."); return; }
  const off = state.possession==="user" ? state.userTeam : state.oppTeam;
  const def = state.possession==="user" ? state.oppTeam : state.userTeam;
  const out = resolvePlay(offPlay, defPlay, target, off, def);
  if(offPlay.type==="pass" && !out.complete && !out.turnover) addLog(`Incomplete (${offPlay.name}).`);
  if(out.yardage>0) addLog(`${offPlay.name}${target?` to ${target.name}`:""} for +${out.yardage} yards (vs ${defPlay.name}).`);
  if(out.yardage<0) addLog(`${offPlay.name}${target?` to ${target.name}`:""} for ${out.yardage} yards (vs ${defPlay.name}).`);
  // Penalties check
  const pen = maybePenalty(offPlay);
  if(pen){
    const adj = applyPenalty(pen, out.yardage, off, def, offPlay);
    if(adj.autoFirst){ state.down=1; state.toGo=10; }
    if(adj.repeatDown){ /* down repeats, yardage applied */ }
    out.yardage = adj.adjustedGain;
  }
  if(out.turnover){ addLog(`Turnover!`); changePossession(); }
  else { spotBall(out.yardage); }
  advanceClock();
  renderScore();
  if(state.possession==="opp"){ // opponent ball -> wait for user defense, unless auto
    if(state.auto){
      const [pl, target] = aiChoosePlay(state.oppTeam);
      const d = DEF_PLAYS[rng(DEF_PLAYS.length)];
      runCombined(pl, d, target);
    }
  }else{ // user ball, continue if auto
    if(state.auto){
      const roster = state.players[state.userTeam]||[];
      const skill = roster.filter(p=>["WR","TE","RB"].includes(p.pos));
      if(skill.length){
        const target2 = skill[rng(skill.length)];
        const play2 = Math.random()<0.5?OFF_PLAYS.find(p=>p.id==="inside_run"):OFF_PLAYS.find(p=>p.id==="short_pass");
        const d2 = aiDefenseChoice();
        runCombined(play2, d2, target2);
      }
    }
  }
}

function newGame(){
  state.possession="user"; state.quarter=1; state.clock=900; state.down=1; state.toGo=10; state.yardline=25;
  state.score={user:0,opp:0};
  $("#log").innerHTML="";
  addLog(`KICKOFF — ${teamById(state.userTeam).id} vs ${teamById(state.oppTeam).id}`);
  renderScore(); renderField();
}

function bindUI(){
  $("#newGameBtn").addEventListener("click", newGame);
  $("#autoBtn").addEventListener("click", ()=>{
    state.auto = !state.auto;
    $("#autoBtn").textContent = state.auto ? "Stop Auto" : "Auto Next";
    if(state.auto){
      const loop = ()=>{
        if(!state.auto) return;
        // If it's opponent's ball, simulate both sides; otherwise call a quick play for user
        if(state.possession==="opp"){
          const [pl, target] = aiChoosePlay(state.oppTeam);
          const d = DEF_PLAYS[rng(DEF_PLAYS.length)];
          runCombined(pl, d, target);
        }else{
          const roster = state.players[state.userTeam]||[];
          const skill = roster.filter(p=>["WR","TE","RB"].includes(p.pos));
          if(skill.length){
            const target = skill[rng(skill.length)];
            const play = Math.random()<0.5?OFF_PLAYS.find(p=>p.id==="inside_run"):OFF_PLAYS.find(p=>p.id==="short_pass");
            const d = aiDefenseChoice();
            runCombined(play, d, target);
          }
        }
        setTimeout(loop, 700);
      };
      loop();
    }
  });

  // Admin bindings preserved from previous version
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

async function init(){ await loadData(); renderSetup(); bindUI(); newGame(); renderField(true); }
init();
