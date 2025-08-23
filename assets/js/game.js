let teams = ["Patriots","Jets","Giants","Cowboys","Packers","Steelers","Bears","Colts"]; // placeholder

let gameState = {
  userTeam: null,
  cpuTeam: null,
  userScore: 0,
  cpuScore: 0,
  possession: "USER",
  ballYard: 25,
  down: 1,
  toGo: 10,
  quarter: 1,
  clock: 900
};

function initTeams() {
  let uSel = document.getElementById("user-team");
  let cSel = document.getElementById("cpu-team");
  teams.forEach(t=>{
    let o1 = document.createElement("option");
    o1.value = t; o1.textContent = t; uSel.appendChild(o1);
    let o2 = document.createElement("option");
    o2.value = t; o2.textContent = t; cSel.appendChild(o2);
  });
}

function startGame() {
  let uSel = document.getElementById("user-team");
  let cSel = document.getElementById("cpu-team");
  if(uSel.value===cSel.value){ alert("Pick different teams!"); return; }
  gameState.userTeam=uSel.value;
  gameState.cpuTeam=cSel.value;
  document.getElementById("start-screen").style.display="none";
  document.getElementById("game-screen").style.display="flex";
  renderPlays();
  logMsg("Game start: "+gameState.userTeam+" vs "+gameState.cpuTeam);
}

function renderPlays() {
  let offenseDiv=document.getElementById("offense-buttons");
  let defenseDiv=document.getElementById("defense-buttons");
  offenseDiv.innerHTML="";
  defenseDiv.innerHTML="";
  if(gameState.possession==="USER"){
    document.getElementById("play-title").innerText="Your Offense";
    ["Run","Short Pass","Long Pass"].forEach(p=>{
      let b=document.createElement("button"); b.innerText=p;
      b.onclick=()=>resolvePlay("USER",p);
      offenseDiv.appendChild(b);
    });
  } else {
    document.getElementById("play-title").innerText="Your Defense";
    ["Blitz","Zone","Man"].forEach(p=>{
      let b=document.createElement("button"); b.innerText=p;
      b.onclick=()=>resolvePlay("CPU",p);
      defenseDiv.appendChild(b);
    });
  }
}

function resolvePlay(side,play) {
  let yards = Math.floor(Math.random()*7)-1; // -1 to +5
  if(play.includes("Long")) yards+=5;
  if(play==="Blitz") yards-=2;
  gameState.ballYard+=yards;
  gameState.down++;
  if(gameState.ballYard>=100){ logMsg("TOUCHDOWN "+side); if(side==="USER") gameState.userScore+=7; else gameState.cpuScore+=7; resetDrive(); }
  else if(gameState.down>4){ logMsg(side+" drive ends, turnover on downs."); switchPossession(); }
  updateScoreboard();
  updateField();
  renderPlays();
  logMsg(side+" ran "+play+" for "+yards+" yards. Ball on "+gameState.ballYard+".");
}

function resetDrive(){ gameState.ballYard=25; gameState.down=1; gameState.toGo=10; }
function switchPossession(){ gameState.down=1; gameState.toGo=10; gameState.possession=(gameState.possession==="USER"?"CPU":"USER"); gameState.ballYard=25; renderPlays(); }

function updateScoreboard(){
  document.getElementById("user-score").innerText=gameState.userScore;
  document.getElementById("cpu-score").innerText=gameState.cpuScore;
}
function updateField(){
  let bm=document.getElementById("ball-marker");
  let pct=gameState.ballYard/100; bm.style.left=(pct*90+5)+"%";
}
function logMsg(msg){
  let log=document.getElementById("log");
  let line=document.createElement("div"); line.textContent=msg;
  log.appendChild(line);
  log.scrollTop=log.scrollHeight;
}

document.getElementById("start-btn").onclick=startGame;
initTeams();
